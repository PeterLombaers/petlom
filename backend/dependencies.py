from typing import Annotated, Type, TypeVar

from fastapi import Depends, HTTPException
from sqlmodel import Session

from backend.db import engine

MAX_PAGE_LENGTH = 100


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]

T = TypeVar("SQLModel")


def find_object(model: Type[T], identifier: str | int, session: SessionDep) -> T:
    obj = session.get(model, identifier)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return obj
