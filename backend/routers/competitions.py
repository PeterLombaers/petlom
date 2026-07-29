from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func
from sqlmodel import col, select

from backend.auth import ModeratorDep
from backend.competitions.simkro import calculate_ranking, create_matchups
from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_competition
from backend.enums import Result
from backend.models import (
    Competition,
    CompetitionCreate,
    CompetitionPublic,
    CompetitionPublicWithNRounds,
    CompetitionRating,
    CompetitionRatingPublic,
    CompetitionRatingType,
    CompetitionRatingTypePublic,
    CompetitionRatingTypeUpdate,
    CompetitionUpdate,
    Match,
    MatchPublic,
    PairingCreate,
    Player,
    RoundPlayer,
    RoundPlayerPublic,
    RoundPlayerUpdate,
    SimkroRank,
)
from backend.ratings import calculate_ratings

router = APIRouter(prefix="/competitions", tags=["competitions"])


def get_latest_round_nr(competition: Competition, session: SessionDep) -> int:
    n_rounds_stmt = select(func.max(Match.round)).where(
        Match.competition_id == competition.id
    )
    return session.scalar(n_rounds_stmt) or 0


def to_competition_response(
    competition: Competition, session: SessionDep
) -> CompetitionPublicWithNRounds:
    return CompetitionPublicWithNRounds(
        name=competition.name,
        type=competition.type,
        created_at=competition.created_at,
        updated_at=competition.updated_at,
        n_rounds=get_latest_round_nr(competition, session),
        rating_type=competition.rating_type,
    )


@router.post("/")
def create_competition(
    competition: CompetitionCreate, session: SessionDep, _: ModeratorDep
) -> CompetitionPublicWithNRounds:
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
def retrieve_competition(
    name: str, session: SessionDep
) -> CompetitionPublicWithNRounds:
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
) -> CompetitionPublicWithNRounds:
    db_competition = find_competition(name, session)
    update_data = competition.model_dump(exclude_unset=True)
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
    return ratings


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


def update_ratings(
    competition: Competition,
    matches: Sequence[Match],
    ranking: list[SimkroRank],
    session: SessionDep,
) -> None:
    """Recalculate the competition ratings from the matches.

    Updates the stored `CompetitionRating` rows and annotates the ranking with the
    new ratings.
    """
    rating_type = competition.rating_type
    comp_ratings_list = session.exec(
        select(CompetitionRating).where(
            CompetitionRating.rating_type_id == rating_type.id
        )
    ).all()

    initial_ratings = {cr.player_id: cr.initial_rating for cr in comp_ratings_list}
    match_tuples = [
        (
            m.player_white_id,
            m.player_black_id,
            1.0
            if m.result == Result.WHITE_WIN
            else 0.5
            if m.result == Result.DRAW
            else 0.0,
        )
        for m in sorted(
            (m for m in matches if m.result is not None),
            key=lambda m: (m.round, m.board),
        )
    ]

    new_ratings = calculate_ratings(
        initial_ratings, match_tuples, rating_type.build_rating_algorithm()
    )

    for cr in comp_ratings_list:
        new_rating = new_ratings.get(cr.player_id)
        if new_rating is not None:
            cr.current_rating = new_rating
            cr.updated_at = datetime.now(UTC)
            session.add(cr)

    ratings_by_player = {cr.player_id: cr.current_rating for cr in comp_ratings_list}
    for rank in ranking:
        current = ratings_by_player.get(rank.player.id)
        if current is not None:
            rank.current_rating = current


@router.post("/{name}/ranking")
def create_ranking(
    name: str, session: SessionDep, round_nr: int | None = None
) -> list[SimkroRank]:
    competition = find_competition(name, session)
    if round_nr is None:
        round_nr = get_latest_round_nr(competition, session)
    matches = session.exec(
        select(Match)
        .where(Match.round <= round_nr)
        .where(Match.competition == competition)
    ).all()
    ranking = calculate_ranking(matches)

    update_ratings(competition, matches, ranking, session)

    session.commit()
    return ranking


# ---------------------------------------------------------------------------
# Round player endpoints
# ---------------------------------------------------------------------------


def get_round_players(
    competition: Competition, round_nr: int, session: SessionDep
) -> Sequence[RoundPlayer]:
    return session.exec(
        select(RoundPlayer).where(
            RoundPlayer.competition_id == competition.id,
            RoundPlayer.round == round_nr,
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
        current_rating=rating,
        is_manual=is_manual,
    )
    session.add(comp_rating)
    existing_ratings[player.id] = comp_rating
    return comp_rating


def add_round_players(
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
        rp.player_id for rp in get_round_players(competition, round_nr, session)
    }

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
            RoundPlayer(
                competition_id=competition.id,
                round=round_nr,
                player_id=player_id,
                initial_rating=comp_rating.current_rating,
            )
        )
        already_added.add(player_id)


def remove_round_players(
    competition: Competition,
    round_nr: int,
    player_ids: list[int],
    session: SessionDep,
) -> None:
    to_remove = set(player_ids)
    for rp in get_round_players(competition, round_nr, session):
        if rp.player_id in to_remove:
            session.delete(rp)


def update_bye(
    competition: Competition,
    round_nr: int,
    bye_player_id: int | None,
    session: SessionDep,
) -> None:
    """Clear any existing bye and, if given, assign the bye to `bye_player_id`."""
    new_bye_player = None
    for rp in get_round_players(competition, round_nr, session):
        if rp.is_bye:
            rp.is_bye = False
            session.add(rp)
        if rp.player_id == bye_player_id:
            new_bye_player = rp

    if bye_player_id is None:
        return
    if new_bye_player is None:
        raise HTTPException(
            status_code=404,
            detail=f"Player id for bye is not found: {bye_player_id}",
        )
    new_bye_player.is_bye = True
    session.add(new_bye_player)


@router.get("/{name}/players")
def retrieve_round_players(
    name: str, round_nr: int, session: SessionDep
) -> list[RoundPlayerPublic]:
    competition = find_competition(name, session)
    return get_round_players(competition, round_nr, session)


@router.patch("/{name}/players")
def update_round_players(
    name: str,
    round_nr: int,
    update: RoundPlayerUpdate,
    session: SessionDep,
    _: ModeratorDep,
) -> list[RoundPlayerPublic]:
    competition = find_competition(name, session)

    if update.player_ids_to_add:
        add_round_players(
            competition,
            round_nr,
            update.player_ids_to_add,
            update.initial_ratings or {},
            session,
        )
    if update.player_ids_to_remove:
        remove_round_players(
            competition, round_nr, update.player_ids_to_remove, session
        )
    if update.clear_bye or update.bye_player_id is not None:
        update_bye(competition, round_nr, update.bye_player_id, session)

    session.commit()

    return get_round_players(competition, round_nr, session)


@router.delete("/{name}/players")
def delete_round_players(
    name: str, round_nr: int, session: SessionDep, _: ModeratorDep
):
    competition = find_competition(name, session)
    for rp in get_round_players(competition, round_nr, session):
        session.delete(rp)
    session.commit()
    return {"ok": True}
