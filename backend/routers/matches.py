from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_object
from backend.models import Match, MatchBase, MatchPublic, MatchUpdate

router = APIRouter(prefix="/matches", tags=["matches"])


@router.post("/")
def create_match(match_obj: MatchBase, session: SessionDep) -> MatchPublic:
    db_match = Match.model_validate(match_obj)
    try:
        session.add(db_match)
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
def delete_match(id: int, session: SessionDep):
    match_obj = find_object(model=Match, identifier=id, session=session)
    session.delete(match_obj)
    session.commit()
    return {"ok": True}


@router.patch("/{id}")
def update_match(id: int, match_obj: MatchUpdate, session: SessionDep) -> MatchPublic:
    db_match = find_object(model=Match, identifier=id, session=session)
    db_match.sqlmodel_update(match_obj.model_dump(exclude_unset=True))
    db_match.updated_at = datetime.now()
    try:
        session.add(db_match)
        session.commit()
        session.refresh(db_match)
    except IntegrityError as e:
        error_message = f"IntegrityError: {e.orig}"
        raise HTTPException(400, detail=error_message)
    return db_match
