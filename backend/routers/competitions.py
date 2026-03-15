from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func
from sqlmodel import select

from backend.competitions.simkro import calculate_ranking, create_matchups
from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_object
from backend.models import (
    Competition,
    CompetitionBase,
    CompetitionPublic,
    CompetitionPublicWithNRounds,
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

router = APIRouter(prefix="/competitions", tags=["competitions"])


def get_latest_round_nr(competition: Competition, session: SessionDep) -> int:
    n_rounds_stmt = select(func.max(Match.round)).where(
        Match.competition_name == competition.name
    )
    return session.scalar(n_rounds_stmt) or 0


def add_n_rounds(competition: Competition, session: SessionDep) -> Competition:
    """Add 'n_rounds' property to `Competition` instance."""
    n_rounds = get_latest_round_nr(competition, session)
    # I have to go via the `__dict__` attribute because if you set
    # `competition.n_rounds` directly, Pydantic validation is triggered and will
    # complain that `Competition` has no attribute `n_rounds`. This means that after you
    # call `add_n_rounds` you can not fully rely on Pydantic validation, so you should
    # only call it right before returning a competition from a route.
    competition.__dict__["n_rounds"] = n_rounds
    return competition


@router.post("/")
def create_competition(
    competition: CompetitionBase, session: SessionDep
) -> CompetitionPublic:
    db_competition = Competition.model_validate(competition)
    session.add(db_competition)
    session.commit()
    session.refresh(db_competition)
    return db_competition


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
    return add_n_rounds(competition=competition, session=session)


@router.delete("/{name}")
def delete_competition(name: str, session: SessionDep):
    competition = find_object(model=Competition, identifier=name, session=session)
    session.delete(competition)
    session.commit()
    return {"ok": True}


@router.patch("/{name}")
def update_competition(
    name: str, competition: CompetitionUpdate, session: SessionDep
) -> CompetitionPublicWithNRounds:
    db_competition = find_object(model=Competition, identifier=name, session=session)
    db_competition.sqlmodel_update(competition.model_dump(exclude_unset=True))
    db_competition.updated_at = datetime.now()
    session.add(db_competition)
    session.commit()
    session.refresh(db_competition)
    return add_n_rounds(competition=db_competition, session=session)


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
    name: str, pairing: PairingCreate, session: SessionDep
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
def delete_pairing(name: str, round_nr: int, session: SessionDep):
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
    return calculate_ranking(matches)


@router.post("/{name}/players")
def create_round_players(
    name: str, round_nr: int, session: SessionDep
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
    name: str, round_nr: int, update: RoundPlayerUpdate, session: SessionDep
) -> list[RoundPlayerPublic]:
    competition = find_object(model=Competition, identifier=name, session=session)

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
        for player_id in update.player_ids_to_add:
            # Skip if already in the list.
            existing = session.exec(
                select(RoundPlayer).where(
                    RoundPlayer.competition_name == competition.name,
                    RoundPlayer.round == round_nr,
                    RoundPlayer.player_id == player_id,
                )
            ).first()
            if not existing:
                session.add(
                    RoundPlayer(
                        competition_name=competition.name,
                        round=round_nr,
                        player_id=player_id,
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
            select(RoundPlayer)
            .where(
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
def delete_round_players(name: str, round_nr: int, session: SessionDep):
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
