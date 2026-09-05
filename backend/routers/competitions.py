from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func
from sqlmodel import col, select

from backend.auth import ModeratorDep
from backend.club_site import ClubSiteError, fetch_registered_names
from backend.competitions.ranking import compute_ranking, current_ratings
from backend.competitions.simkro import create_matchups
from backend.config import settings
from backend.dependencies import (
    MAX_PAGE_LENGTH,
    SessionDep,
    ensure_competition_open,
    find_competition,
)
from backend.models import (
    Competition,
    CompetitionCreate,
    CompetitionDetail,
    CompetitionPublic,
    CompetitionRating,
    CompetitionRatingPublic,
    CompetitionRatingType,
    CompetitionRatingTypePublic,
    CompetitionRatingTypeUpdate,
    CompetitionUpdate,
    ImportedRegistrationAmbiguity,
    ImportedRegistrationMatch,
    Match,
    MatchPublic,
    PairingCreate,
    Player,
    RegistrationImportPreview,
    RoundRegistration,
    RoundRegistrationPublic,
    RoundRegistrationUpdate,
    SimkroRank,
)
from backend.registration_import import match_names

router = APIRouter(prefix="/competitions", tags=["competitions"])


def get_latest_round_nr(competition: Competition, session: SessionDep) -> int:
    n_rounds_stmt = select(func.max(Match.round)).where(
        Match.competition_id == competition.id
    )
    return session.scalar(n_rounds_stmt) or 0


def to_competition_response(
    competition: Competition, session: SessionDep
) -> CompetitionDetail:
    return CompetitionDetail(
        name=competition.name,
        type=competition.type,
        created_at=competition.created_at,
        updated_at=competition.updated_at,
        is_finished=competition.is_finished,
        n_rounds=get_latest_round_nr(competition, session),
        rating_type=competition.rating_type,
    )


@router.post("/")
def create_competition(
    competition: CompetitionCreate, session: SessionDep, _: ModeratorDep
) -> CompetitionDetail:
    if session.exec(
        select(Competition).where(Competition.name == competition.name)
    ).first():
        raise HTTPException(
            status_code=409,
            detail=[
                {
                    "loc": ["body", "name"],
                    "msg": "A competition with this name already exists.",
                    "type": "value_error.duplicate",
                }
            ],
        )
    db_competition = Competition.model_validate(
        competition.model_dump(exclude={"rating_type"})
    )
    session.add(db_competition)
    session.flush()

    rating_type = competition.rating_type
    session.add(
        CompetitionRatingType(
            name=rating_type.name or f"{competition.name}_rating",
            algorithm=rating_type.algorithm,
            algorithm_config=rating_type.algorithm_config,
            default_initial_rating=rating_type.default_initial_rating,
            competition_id=db_competition.id,
        )
    )
    session.commit()
    session.refresh(db_competition)
    return to_competition_response(db_competition, session)


@router.get("/")
def list_competitions(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
) -> list[CompetitionPublic]:
    competitions = session.exec(
        select(Competition).order_by(col(Competition.id)).offset(offset).limit(limit)
    ).all()
    return competitions


@router.get("/{name}")
def retrieve_competition(name: str, session: SessionDep) -> CompetitionDetail:
    competition = find_competition(name, session)
    return to_competition_response(competition, session)


@router.delete("/{name}")
def delete_competition(name: str, session: SessionDep, _: ModeratorDep):
    competition = find_competition(name, session)
    session.delete(competition)
    session.commit()
    return {"ok": True}


@router.patch("/{name}")
def update_competition(
    name: str, competition: CompetitionUpdate, session: SessionDep, _: ModeratorDep
) -> CompetitionDetail:
    db_competition = find_competition(name, session)
    update_data = competition.model_dump(exclude_unset=True)
    # Flipping `is_finished` is always allowed; that is how a competition is
    # reopened. Any other field is a write to a possibly frozen competition.
    if set(update_data) - {"is_finished"}:
        ensure_competition_open(db_competition)
    db_competition.sqlmodel_update(update_data)
    db_competition.updated_at = datetime.now(UTC)
    session.add(db_competition)
    session.commit()
    session.refresh(db_competition)
    return to_competition_response(db_competition, session)


# ---------------------------------------------------------------------------
# Rating type endpoints
# ---------------------------------------------------------------------------


@router.get("/{name}/rating")
def retrieve_rating(name: str, session: SessionDep) -> CompetitionRatingTypePublic:
    competition = find_competition(name, session)
    return competition.rating_type


@router.patch("/{name}/rating")
def update_rating(
    name: str,
    update: CompetitionRatingTypeUpdate,
    session: SessionDep,
    _: ModeratorDep,
) -> CompetitionRatingTypePublic:
    competition = find_competition(name, session)
    ensure_competition_open(competition)
    competition.rating_type.sqlmodel_update(update.model_dump(exclude_unset=True))
    competition.rating_type.updated_at = datetime.now(UTC)
    session.add(competition.rating_type)
    session.commit()
    session.refresh(competition.rating_type)
    return competition.rating_type


# ---------------------------------------------------------------------------
# Player ratings endpoint
# ---------------------------------------------------------------------------


@router.get("/{name}/player-ratings")
def retrieve_player_ratings(
    name: str, session: SessionDep
) -> list[CompetitionRatingPublic]:
    competition = find_competition(name, session)
    ratings = session.exec(
        select(CompetitionRating).where(
            CompetitionRating.rating_type_id == competition.rating_type.id
        )
    ).all()
    derived = current_ratings(competition, session)
    return [
        CompetitionRatingPublic.model_validate(
            rating, update={"current_rating": derived.get(rating.player_id)}
        )
        for rating in ratings
    ]


# ---------------------------------------------------------------------------
# Pairing endpoints
# ---------------------------------------------------------------------------


@router.get("/{name}/pairing")
def retrieve_pairing(
    name: str, session: SessionDep, round_nr: int | None = None
) -> list[MatchPublic]:
    competition = find_competition(name, session)
    if round_nr is None:
        round_nr = get_latest_round_nr(competition, session)
    return session.exec(
        select(Match)
        .where(Match.competition_id == competition.id)
        .where(Match.round == round_nr)
    ).all()


@router.post("/{name}/pairing")
def create_pairing(
    name: str, pairing: PairingCreate, session: SessionDep, _: ModeratorDep
) -> list[MatchPublic]:
    competition = find_competition(name, session)
    ensure_competition_open(competition)
    round_nr = pairing.round_nr
    player_ids = pairing.player_ids

    # Check if the previous round exists and the current or later rounds do not exist.
    if round_nr > 1:
        previous_round_match = session.exec(
            select(Match)
            .where(Match.round == round_nr - 1)
            .where(Match.competition == competition)
        ).first()
        if not previous_round_match:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unable to create round {round_nr} when round {round_nr - 1}"
                    " does not yet exist."
                ),
            )
    later_round_matches = session.exec(
        select(Match)
        .where(Match.round >= round_nr)
        .where(Match.competition == competition)
    ).all()
    if later_round_matches:
        later_round_nrs = sorted({m.round for m in later_round_matches})
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unable to create round {round_nr} when matches in rounds"
                f" {later_round_nrs} already exist."
            ),
        )

    # Check if the players all exist.
    db_players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    db_player_ids = {db_player.id for db_player in db_players}
    non_existing_player_ids = [
        player_id for player_id in player_ids if player_id not in db_player_ids
    ]
    if non_existing_player_ids:
        raise HTTPException(
            status_code=404, detail=f"Player ids not found: {non_existing_player_ids}"
        )

    previous_matches = session.exec(
        select(Match)
        .where(Match.competition == competition)
        .where(Match.round < round_nr)
    ).all()
    matches = create_matchups(
        matches=previous_matches,
        players=db_players,
        round_nr=round_nr,
        competition=competition,
    )
    session.add_all(matches)
    competition.updated_at = datetime.now(UTC)
    session.add(competition)
    session.commit()
    return matches


@router.delete("/{name}/pairing")
def delete_pairing(name: str, round_nr: int, session: SessionDep, _: ModeratorDep):
    competition = find_competition(name, session)
    ensure_competition_open(competition)
    round_matches = session.exec(
        select(Match)
        .where(Match.round == round_nr)
        .where(Match.competition == competition)
    )
    for m in round_matches:
        session.delete(m)
    competition.updated_at = datetime.now(UTC)
    session.add(competition)
    session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Ranking endpoint
# ---------------------------------------------------------------------------


@router.get("/{name}/ranking")
def retrieve_ranking(
    name: str, session: SessionDep, round_nr: int | None = None
) -> list[SimkroRank]:
    competition = find_competition(name, session)
    if round_nr is None:
        round_nr = get_latest_round_nr(competition, session)
    return compute_ranking(competition, round_nr, session)


# ---------------------------------------------------------------------------
# Round registration endpoints
# ---------------------------------------------------------------------------
#
# A RoundRegistration is a player's intent to play one round. Sign-ups
# arrive over days — in person, or imported from the club website — so they are
# stored here rather than passed in when the pairing is generated.
#
# A bye marks the odd player out so that the round's field is even. If the number of
# players is not even and there is no bye, you can not generate pairings from the
# registrations.
#
# Manual edits to the matches do not propagate back to the round registrations. So if
# you perform manual edits to the matches and then re-run the generation of pairings,
# your edits are not respected.
#
# Registering a player also seeds their CompetitionRating for the competition:
# one row per player per competition, holding the initial rating they entered it
# with. The initial rating of a player together with the matches they played are enough
# to calculate their competition rating.


def get_round_registrations(
    competition: Competition, round_nr: int, session: SessionDep
) -> Sequence[RoundRegistration]:
    return session.exec(
        select(RoundRegistration).where(
            RoundRegistration.competition_id == competition.id,
            RoundRegistration.round == round_nr,
        )
    ).all()


def get_or_create_competition_rating(
    player: Player,
    rating_type: CompetitionRatingType,
    manual_rating: float | None,
    existing_ratings: dict[int, CompetitionRating],
    session: SessionDep,
) -> CompetitionRating:
    """Return the player's rating for this competition, creating it if needed.

    A manually provided rating takes precedence over the rating type default."""
    comp_rating = existing_ratings.get(player.id)
    if comp_rating is not None:
        return comp_rating

    if manual_rating is not None:
        rating, is_manual = manual_rating, True
    elif rating_type.default_initial_rating is not None:
        rating, is_manual = rating_type.default_initial_rating, False
    else:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Player '{player.name}' has no rating for this competition."
                " Provide an initial rating or configure a default."
            ),
        )

    comp_rating = CompetitionRating(
        player_id=player.id,
        rating_type_id=rating_type.id,
        initial_rating=rating,
        is_manual=is_manual,
    )
    session.add(comp_rating)
    existing_ratings[player.id] = comp_rating
    return comp_rating


def add_round_registrations(
    competition: Competition,
    round_nr: int,
    player_ids: list[int],
    initial_ratings: dict[int, float],
    session: SessionDep,
) -> None:
    db_players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    players_by_id = {p.id: p for p in db_players}
    missing = [pid for pid in player_ids if pid not in players_by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"Player ids not found: {missing}")

    rating_type = competition.rating_type
    existing_ratings: dict[int, CompetitionRating] = {
        cr.player_id: cr
        for cr in session.exec(
            select(CompetitionRating).where(
                CompetitionRating.rating_type_id == rating_type.id,
                CompetitionRating.player_id.in_(player_ids),
            )
        ).all()
    }
    already_added = {
        reg.player_id for reg in get_round_registrations(competition, round_nr, session)
    }
    # A player seeded below is not in here yet, so their snapshot falls back to
    # the initial rating they are being seeded with.
    derived_ratings = current_ratings(competition, session)

    for player_id in player_ids:
        if player_id in already_added:
            continue
        comp_rating = get_or_create_competition_rating(
            players_by_id[player_id],
            rating_type,
            initial_ratings.get(player_id),
            existing_ratings,
            session,
        )
        session.add(
            RoundRegistration(
                competition_id=competition.id,
                round=round_nr,
                player_id=player_id,
                initial_rating=derived_ratings.get(
                    player_id, comp_rating.initial_rating
                ),
            )
        )
        already_added.add(player_id)


def remove_round_registrations(
    competition: Competition,
    round_nr: int,
    player_ids: list[int],
    session: SessionDep,
) -> None:
    to_remove = set(player_ids)
    for reg in get_round_registrations(competition, round_nr, session):
        if reg.player_id in to_remove:
            session.delete(reg)


def update_bye(
    competition: Competition,
    round_nr: int,
    bye_player_id: int | None,
    session: SessionDep,
) -> None:
    """Clear any existing bye and, if given, assign the bye to `bye_player_id`."""
    new_bye_player = None
    for reg in get_round_registrations(competition, round_nr, session):
        if reg.is_bye:
            reg.is_bye = False
            session.add(reg)
        if reg.player_id == bye_player_id:
            new_bye_player = reg

    if bye_player_id is None:
        return
    if new_bye_player is None:
        raise HTTPException(
            status_code=404,
            detail=f"Player id for bye is not found: {bye_player_id}",
        )
    new_bye_player.is_bye = True
    session.add(new_bye_player)


@router.get("/{name}/registrations")
def retrieve_round_registrations(
    name: str, round_nr: int, session: SessionDep
) -> list[RoundRegistrationPublic]:
    competition = find_competition(name, session)
    return get_round_registrations(competition, round_nr, session)


@router.get("/{name}/registrations/import-preview")
def preview_registration_import(
    name: str, round_nr: int, session: SessionDep, _: ModeratorDep
) -> RegistrationImportPreview:
    """Report what signing up on the club website would add to this round.

    Read-only on purpose: the names come from a form people type into, so the
    moderator gets to see what was matched to whom before anything is
    registered.
    """
    competition = find_competition(name, session)
    url = settings.club_registration_url
    try:
        names = fetch_registered_names(url)
    except ClubSiteError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    players = session.exec(select(Player).where(Player.is_active)).all()
    result = match_names(names, players)
    registered = {
        reg.player_id for reg in get_round_registrations(competition, round_nr, session)
    }

    return RegistrationImportPreview(
        source_url=url,
        scraped_count=len(names),
        matched=[
            ImportedRegistrationMatch(
                scraped_name=m.scraped_name,
                player=m.player,
                approximate=m.approximate,
                already_registered=m.player.id in registered,
            )
            for m in result.matched
        ],
        unmatched=result.unmatched,
        ambiguous=[
            ImportedRegistrationAmbiguity(
                scraped_name=a.scraped_name, candidates=a.candidates
            )
            for a in result.ambiguous
        ],
    )


@router.patch("/{name}/registrations")
def update_round_registrations(
    name: str,
    round_nr: int,
    update: RoundRegistrationUpdate,
    session: SessionDep,
    _: ModeratorDep,
) -> list[RoundRegistrationPublic]:
    competition = find_competition(name, session)
    ensure_competition_open(competition)

    if update.player_ids_to_add:
        add_round_registrations(
            competition,
            round_nr,
            update.player_ids_to_add,
            update.initial_ratings or {},
            session,
        )
    if update.player_ids_to_remove:
        remove_round_registrations(
            competition, round_nr, update.player_ids_to_remove, session
        )
    if update.clear_bye or update.bye_player_id is not None:
        update_bye(competition, round_nr, update.bye_player_id, session)

    session.commit()

    return get_round_registrations(competition, round_nr, session)


@router.delete("/{name}/registrations")
def delete_round_registrations(
    name: str, round_nr: int, session: SessionDep, _: ModeratorDep
):
    competition = find_competition(name, session)
    ensure_competition_open(competition)
    for reg in get_round_registrations(competition, round_nr, session):
        session.delete(reg)
    session.commit()
    return {"ok": True}
