from typing import Annotated

from fastapi import Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from backend.db import engine
from backend.models import Competition

MAX_PAGE_LENGTH = 100


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


def find_object[T: SQLModel](
    model: type[T], identifier: str | int, session: SessionDep
) -> T:
    obj = session.get(model, identifier)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return obj


def find_competition(name: str, session: SessionDep) -> Competition:
    """Look up a competition by name.

    Competitions are addressed by name in the API but keyed by id in the
    database, so this cannot go through `find_object`.
    """
    competition = session.exec(
        select(Competition).where(Competition.name == name)
    ).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    return competition
