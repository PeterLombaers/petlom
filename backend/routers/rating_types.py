from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from sqlmodel import select

from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_object
from backend.models import (
    RatingType,
    RatingTypeBase,
    RatingTypePublic,
    RatingTypeUpdate,
)

router = APIRouter(prefix="/rating_types", tags=["rating_types"])


@router.post("/")
def create_rating_type(
    rating_type: RatingTypeBase, session: SessionDep
) -> RatingTypePublic:
    db_rating_type = RatingType.model_validate(rating_type)
    session.add(db_rating_type)
    session.commit()
    session.refresh(db_rating_type)
    return db_rating_type


@router.get("/")
def list_rating_types(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
) -> list[RatingTypePublic]:
    rating_types = session.exec(select(RatingType).offset(offset).limit(limit)).all()
    return rating_types


@router.get("/{name}")
def retrieve_rating_type(name: str, session: SessionDep) -> RatingTypePublic:
    return find_object(model=RatingType, identifier=name, session=session)


@router.delete("/{name}")
def delete_rating_type(name: str, session: SessionDep):
    rating_type = find_object(model=RatingType, identifier=name, session=session)
    session.delete(rating_type)
    session.commit()
    return {"ok": True}


@router.patch("/{name}")
def update_rating_type(
    name: str, rating_type: RatingTypeUpdate, session: SessionDep
) -> RatingTypePublic:
    db_rating_type = find_object(model=RatingType, identifier=name, session=session)
    db_rating_type.sqlmodel_update(rating_type.model_dump(exclude_unset=True))
    db_rating_type.updated_at = datetime.now()
    session.add(db_rating_type)
    session.commit()
    session.refresh(db_rating_type)
    return db_rating_type
