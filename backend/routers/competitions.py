from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func
from sqlmodel import select

from backend.auth import ModeratorDep
from backend.competitions.simkro import calculate_ranking, create_matchups
from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_object
from backend.enums import Result
from backend.models import (
    Competition,
    CompetitionCreate,
    CompetitionPublic,
    CompetitionPublicWithNRounds,
    CompetitionRating,
    CompetitionRatingPublic,
    CompetitionRatingType,
    CompetitionRatingTypeCreate,
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
        Match.competition_name == competition.name
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
    if session.get(Competition, competition.name):
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
    db_competition = Competition.model_validate(competition)
    session.add(db_competition)
    session.flush()

    if competition.rating_type is not None:
        rt = competition.rating_type
        db_rating_type = CompetitionRatingType(
            name=rt.name or f"{competition.name}_rating",
            algorithm=rt.algorithm,
            algorithm_config=rt.algorithm_config,
            default_initial_rating=rt.default_initial_rating,
            competition_name=competition.name,
        )
        session.add(db_rating_type)

    session.commit()
    session.refresh(db_competition)
    return to_competition_response(db_competition, session)


@router.get("/")
def list_competitions(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
) -> list[CompetitionPublic]:
    competitions = session.exec(select(Competition).offset(offset).limit(limit)).all()
    return competitions


@router.get("/{name}")
def retrieve_competition(
    name: str, session: SessionDep
) -> CompetitionPublicWithNRounds:
    competition = find_object(model=Competition, identifier=name, session=session)
    return to_competition_response(competition, session)


@router.delete("/{name}")
def delete_competition(name: str, session: SessionDep, _: ModeratorDep):
    competition = find_object(model=Competition, identifier=name, session=session)
    session.delete(competition)
    session.commit()
    return {"ok": True}


@router.patch("/{name}")
def update_competition(
    name: str, competition: CompetitionUpdate, session: SessionDep, _: ModeratorDep
) -> CompetitionPublicWithNRounds:
    db_competition = find_object(model=Competition, identifier=name, session=session)
    db_competition.sqlmodel_update(competition.model_dump(exclude_unset=True))
    db_competition.updated_at = datetime.now()
    session.add(db_competition)
    session.commit()
    session.refresh(db_competition)
    return to_competition_response(db_competition, session)


# ---------------------------------------------------------------------------
# Rating type endpoints
# ---------------------------------------------------------------------------


@router.get("/{name}/rating")
def retrieve_rating(name: str, session: SessionDep) -> CompetitionRatingTypePublic:
    competition = find_object(model=Competition, identifier=name, session=session)
    if not competition.rating_type:
        raise HTTPException(
            status_code=404, detail="No rating configured for this competition."
        )
    return competition.rating_type


@router.post("/{name}/rating")
def create_rating(
    name: str,
    rating_type: CompetitionRatingTypeCreate,
    session: SessionDep,
    _: ModeratorDep,
) -> CompetitionRatingTypePublic:
    competition = find_object(model=Competition, identifier=name, session=session)
    if competition.rating_type:
        raise HTTPException(
            status_code=409,
            detail="A rating is already configured for this competition.",
        )
    db_rating_type = CompetitionRatingType(
        name=rating_type.name or f"{name}_rating",
        algorithm=rating_type.algorithm,
        algorithm_config=rating_type.algorithm_config,
        default_initial_rating=rating_type.default_initial_rating,
        competition_name=name,
    )
    session.add(db_rating_type)
    session.commit()
    session.refresh(db_rating_type)
    return db_rating_type


@router.patch("/{name}/rating")
def update_rating(
    name: str,
    update: CompetitionRatingTypeUpdate,
    session: SessionDep,
    _: ModeratorDep,
) -> CompetitionRatingTypePublic:
    competition = find_object(model=Competition, identifier=name, session=session)
    if not competition.rating_type:
        raise HTTPException(
            status_code=404, detail="No rating configured for this competition."
        )
    competition.rating_type.sqlmodel_update(update.model_dump(exclude_unset=True))
    competition.rating_type.updated_at = datetime.now()
    session.add(competition.rating_type)
    session.commit()
    session.refresh(competition.rating_type)
    return competition.rating_type


@router.delete("/{name}/rating")
def delete_rating(name: str, session: SessionDep, _: ModeratorDep):
    competition = find_object(model=Competition, identifier=name, session=session)
    if not competition.rating_type:
        raise HTTPException(
            status_code=404, detail="No rating configured for this competition."
        )
    session.delete(competition.rating_type)
    session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Player ratings endpoint
# ---------------------------------------------------------------------------


@router.get("/{name}/player-ratings")
def retrieve_player_ratings(
    name: str, session: SessionDep
) -> list[CompetitionRatingPublic]:
    competition = find_object(model=Competition, identifier=name, session=session)
    if not competition.rating_type:
        return []
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
    competition = find_object(model=Competition, identifier=name, session=session)
    if round_nr is None:
        round_nr = get_latest_round_nr(competition, session)
    return session.exec(
        select(Match)
        .where(Match.competition_name == competition.name)
        .where(Match.round == round_nr)
    ).all()


@router.post("/{name}/pairing")
def create_pairing(
    name: str, pairing: PairingCreate, session: SessionDep, _: ModeratorDep
) -> list[MatchPublic]:
    competition = find_object(model=Competition, identifier=name, session=session)
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
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unable to create round {round_nr} when matches in rounds"
                f" {later_round_matches} already exist."
            ),
        )

    # Check if the players all exist.
    db_players = session.exec(select(Player).where(Player.id.in_(player_ids))).all()
    db_player_ids = set(db_player.id for db_player in db_players)
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
    competition.updated_at = datetime.now()
    session.add(competition)
    session.commit()
    return matches


@router.delete("/{name}/pairing")
def delete_pairing(name: str, round_nr: int, session: SessionDep, _: ModeratorDep):
    competition = find_object(model=Competition, identifier=name, session=session)
    round_matches = session.exec(
        select(Match)
        .where(Match.round == round_nr)
        .where(Match.competition == competition)
    )
    for m in round_matches:
        session.delete(m)
    competition.updated_at = datetime.now()
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
    competition = find_object(model=Competition, identifier=name, session=session)
    if round_nr is None:
        round_nr = get_latest_round_nr(competition, session)
    matches = session.exec(
        select(Match)
        .where(Match.round <= round_nr)
        .where(Match.competition == competition)
    ).all()
    ranking = calculate_ranking(matches)

    if competition.rating_type:
        comp_ratings_list = session.exec(
            select(CompetitionRating).where(
                CompetitionRating.rating_type_id == competition.rating_type.id
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
            initial_ratings, match_tuples, competition.rating_type.get_rating_function()
        )

        for cr in comp_ratings_list:
            new_rating = new_ratings.get(cr.player_id)
            if new_rating is not None:
                cr.current_rating = new_rating
                cr.updated_at = datetime.now()
                session.add(cr)

        ratings_by_player = {
            cr.player_id: cr.current_rating for cr in comp_ratings_list
        }
        for rank in ranking:
            current = ratings_by_player.get(rank.player.id)
            if current is not None:
                rank.current_rating = current

        session.commit()

    return ranking


# ---------------------------------------------------------------------------
# Round player endpoints
# ---------------------------------------------------------------------------


@router.post("/{name}/players")
def create_round_players(
    name: str, round_nr: int, session: SessionDep, _: ModeratorDep
) -> list[RoundPlayerPublic]:
    competition = find_object(model=Competition, identifier=name, session=session)
    # Check that matches don't already exist for this round.
    existing_match = session.exec(
        select(Match).where(
            Match.competition_name == competition.name,
            Match.round == round_nr,
        )
    ).first()
    if existing_match:
        raise HTTPException(
            status_code=400,
            detail=f"Pairing for round {round_nr} already exists.",
        )
    return session.exec(
        select(RoundPlayer).where(
            RoundPlayer.competition_name == competition.name,
            RoundPlayer.round == round_nr,
        )
    ).all()


@router.get("/{name}/players")
def retrieve_round_players(
    name: str, round_nr: int, session: SessionDep
) -> list[RoundPlayerPublic]:
    find_object(model=Competition, identifier=name, session=session)
    round_players = session.exec(
        select(RoundPlayer).where(
            RoundPlayer.competition_name == name,
            RoundPlayer.round == round_nr,
        )
    ).all()
    return round_players


@router.patch("/{name}/players")
def update_round_players(
    name: str,
    round_nr: int,
    update: RoundPlayerUpdate,
    session: SessionDep,
    _: ModeratorDep,
) -> list[RoundPlayerPublic]:
    competition = find_object(model=Competition, identifier=name, session=session)
    rating_type = competition.rating_type

    if update.player_ids_to_add:
        # Validate players exist.
        db_players = session.exec(
            select(Player).where(Player.id.in_(update.player_ids_to_add))
        ).all()
        db_player_ids = {p.id for p in db_players}
        missing = [pid for pid in update.player_ids_to_add if pid not in db_player_ids]
        if missing:
            raise HTTPException(
                status_code=404, detail=f"Player ids not found: {missing}"
            )

        # Build map of existing competition ratings if rating is configured.
        existing_comp_ratings: dict[int, CompetitionRating] = {}
        if rating_type:
            existing_comp_ratings = {
                cr.player_id: cr
                for cr in session.exec(
                    select(CompetitionRating).where(
                        CompetitionRating.rating_type_id == rating_type.id,
                        CompetitionRating.player_id.in_(update.player_ids_to_add),
                    )
                ).all()
            }

        for player in db_players:
            player_id = player.id

            # Skip if already in the list.
            existing = session.exec(
                select(RoundPlayer).where(
                    RoundPlayer.competition_name == competition.name,
                    RoundPlayer.round == round_nr,
                    RoundPlayer.player_id == player_id,
                )
            ).first()
            if existing:
                continue

            initial_rating: float | None = None

            if rating_type:
                comp_rating = existing_comp_ratings.get(player_id)
                if comp_rating is None:
                    # Determine the initial rating for this player.
                    manual_rating = (update.initial_ratings or {}).get(player_id)
                    if manual_rating is not None:
                        comp_rating = CompetitionRating(
                            player_id=player_id,
                            rating_type_id=rating_type.id,
                            initial_rating=manual_rating,
                            current_rating=manual_rating,
                            is_manual=True,
                        )
                        session.add(comp_rating)
                        session.flush()
                    elif rating_type.default_initial_rating is not None:
                        comp_rating = CompetitionRating(
                            player_id=player_id,
                            rating_type_id=rating_type.id,
                            initial_rating=rating_type.default_initial_rating,
                            current_rating=rating_type.default_initial_rating,
                            is_manual=False,
                        )
                        session.add(comp_rating)
                        session.flush()
                    else:
                        raise HTTPException(
                            status_code=422,
                            detail=(
                                f"Player '{player.name}' has no rating for this competition."
                                " Provide an initial rating or configure a default."
                            ),
                        )
                initial_rating = comp_rating.current_rating

            session.add(
                RoundPlayer(
                    competition_name=competition.name,
                    round=round_nr,
                    player_id=player_id,
                    initial_rating=initial_rating,
                )
            )

    if update.player_ids_to_remove:
        for player_id in update.player_ids_to_remove:
            rp = session.exec(
                select(RoundPlayer).where(
                    RoundPlayer.competition_name == competition.name,
                    RoundPlayer.round == round_nr,
                    RoundPlayer.player_id == player_id,
                )
            ).first()
            if rp:
                session.delete(rp)

    if update.clear_bye or update.bye_player_id is not None:
        all_rps = session.exec(
            select(RoundPlayer).where(
                RoundPlayer.competition_name == competition.name,
                RoundPlayer.round == round_nr,
                RoundPlayer.is_bye,
            )
        ).all()
        for rp in all_rps:
            rp.is_bye = False
            session.add(rp)
    if update.bye_player_id is not None:
        rp = session.exec(
            select(RoundPlayer).where(
                RoundPlayer.competition_name == competition.name,
                RoundPlayer.round == round_nr,
                RoundPlayer.player_id == update.bye_player_id,
            )
        ).first()
        if not rp:
            raise HTTPException(
                status_code=404,
                detail=f"Player id for bye is not found: {update.bye_player_id}",
            )
        rp.is_bye = True
        session.add(rp)

    session.commit()

    return session.exec(
        select(RoundPlayer).where(
            RoundPlayer.competition_name == competition.name,
            RoundPlayer.round == round_nr,
        )
    ).all()


@router.delete("/{name}/players")
def delete_round_players(
    name: str, round_nr: int, session: SessionDep, _: ModeratorDep
):
    competition = find_object(model=Competition, identifier=name, session=session)
    round_players = session.exec(
        select(RoundPlayer).where(
            RoundPlayer.competition_name == competition.name,
            RoundPlayer.round == round_nr,
        )
    ).all()
    for rp in round_players:
        session.delete(rp)
    session.commit()
    return {"ok": True}
