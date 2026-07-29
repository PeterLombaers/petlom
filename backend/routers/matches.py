from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from backend.auth import ModeratorDep
from backend.dependencies import (
    MAX_PAGE_LENGTH,
    SessionDep,
    find_competition,
    find_object,
)
from backend.models import Competition, Match, MatchBase, MatchPublic, MatchUpdate

router = APIRouter(prefix="/matches", tags=["matches"])


def touch_competition(session: SessionDep, competition_id: int):
    competition = session.get(Competition, competition_id)
    if competition:
        competition.updated_at = datetime.now(UTC)
        session.add(competition)


@router.post("/")
def create_match(
    match_obj: MatchBase, session: SessionDep, _: ModeratorDep
) -> MatchPublic:
    competition = find_competition(match_obj.competition_name, session)
    db_match = Match.model_validate(
        match_obj.model_dump(exclude={"competition_name"}),
        update={"competition_id": competition.id},
    )
    try:
        session.add(db_match)
        touch_competition(session, db_match.competition_id)
        session.commit()
        session.refresh(db_match)
    except IntegrityError as e:
        error_message = f"IntegrityError: {e.orig}"
        raise HTTPException(400, detail=error_message)
    return db_match


@router.get("/")
def list_matches(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
) -> list[MatchPublic]:
    matches = session.exec(select(Match).offset(offset).limit(limit)).all()
    return matches


@router.get("/{id}")
def retrieve_match(id: int, session: SessionDep) -> MatchPublic:
    match_obj = find_object(model=Match, identifier=id, session=session)
    return match_obj


@router.delete("/{id}")
def delete_match(id: int, session: SessionDep, _: ModeratorDep):
    match_obj = find_object(model=Match, identifier=id, session=session)
    session.delete(match_obj)
    touch_competition(session, match_obj.competition_id)
    session.commit()
    return {"ok": True}


@router.patch("/{id}")
def update_match(
    id: int, match_obj: MatchUpdate, session: SessionDep, _: ModeratorDep
) -> MatchPublic:
    db_match = find_object(model=Match, identifier=id, session=session)
    update_data = match_obj.model_dump(exclude_unset=True)
    new_name = update_data.pop("competition_name", None)
    if new_name is not None:
        update_data["competition_id"] = find_competition(new_name, session).id
    db_match.sqlmodel_update(update_data)
    db_match.updated_at = datetime.now(UTC)
    try:
        session.add(db_match)
        touch_competition(session, db_match.competition_id)
        session.commit()
        session.refresh(db_match)
    except IntegrityError as e:
        error_message = f"IntegrityError: {e.orig}"
        raise HTTPException(400, detail=error_message)
    return db_match
