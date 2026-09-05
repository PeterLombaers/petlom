from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import col, select

from backend.auth import ModeratorDep
from backend.dependencies import (
    MAX_PAGE_LENGTH,
    SessionDep,
    ensure_competition_open,
    find_competition,
    find_object,
)
from backend.models import Competition, Match, MatchCreate, MatchPublic, MatchUpdate

router = APIRouter(prefix="/matches", tags=["matches"])


MATCH_CONFLICT_DETAIL = (
    "This competition already has a match on this round and board, "
    "or the match refers to a player that doesn't exist."
)


def touch_open_competition(session: SessionDep, competition_id: int):
    """Bump `updated_at`, rejecting a finished competition.

    Bumping a frozen competition is exactly what must not happen, so the guard
    lives here rather than in each caller.
    """
    competition = session.get(Competition, competition_id)
    if competition:
        ensure_competition_open(competition)
        competition.updated_at = datetime.now(UTC)
        session.add(competition)


@router.post("/")
def create_match(
    match_obj: MatchCreate, session: SessionDep, _: ModeratorDep
) -> MatchPublic:
    competition = find_competition(match_obj.competition_name, session)
    ensure_competition_open(competition)
    db_match = Match.model_validate(
        match_obj.model_dump(exclude={"competition_name"}),
        update={"competition_id": competition.id},
    )
    try:
        session.add(db_match)
        touch_open_competition(session, db_match.competition_id)
        session.commit()
        session.refresh(db_match)
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=MATCH_CONFLICT_DETAIL)
    return db_match


@router.get("/")
def list_matches(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
) -> list[MatchPublic]:
    matches = session.exec(
        select(Match).order_by(col(Match.id)).offset(offset).limit(limit)
    ).all()
    return matches


@router.get("/{id}")
def retrieve_match(id: int, session: SessionDep) -> MatchPublic:
    match_obj = find_object(model=Match, identifier=id, session=session)
    return match_obj


@router.delete("/{id}")
def delete_match(id: int, session: SessionDep, _: ModeratorDep):
    match_obj = find_object(model=Match, identifier=id, session=session)
    touch_open_competition(session, match_obj.competition_id)
    session.delete(match_obj)
    session.commit()
    return {"ok": True}


@router.patch("/{id}")
def update_match(
    id: int, match_obj: MatchUpdate, session: SessionDep, _: ModeratorDep
) -> MatchPublic:
    db_match = find_object(model=Match, identifier=id, session=session)
    update_data = match_obj.model_dump(exclude_unset=True)
    old_competition_id = db_match.competition_id
    new_name = update_data.pop("competition_name", None)
    if new_name is not None:
        update_data["competition_id"] = find_competition(new_name, session).id
    # Moving a match touches both sides, so both have to be open.
    touch_open_competition(session, old_competition_id)
    db_match.sqlmodel_update(update_data)
    db_match.updated_at = datetime.now(UTC)
    try:
        session.add(db_match)
        touch_open_competition(session, db_match.competition_id)
        session.commit()
        session.refresh(db_match)
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=MATCH_CONFLICT_DETAIL)
    return db_match
