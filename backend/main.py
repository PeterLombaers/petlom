from datetime import datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import func
from sqlmodel import Session, select

from backend.db import init_db, init_engine
from backend.models import (
    Competition,
    CompetitionBase,
    CompetitionPublic,
    RatingType,
    RatingTypeBase,
    RatingTypePublic,
)

app = FastAPI()
engine = init_engine(
    fp="database.db", connect_args={"check_same_thread": False}, echo=True
)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


@app.on_event("startup")
def on_startup():
    init_db(engine)


@app.post("/competitions/")
def create_competition(
    competition: CompetitionBase, session: SessionDep
) -> CompetitionPublic:
    db_competition = Competition.model_validate(competition)
    session.add(db_competition)
    session.commit()
    session.refresh(db_competition)
    return db_competition


@app.get("/competitions/")
def list_competitions(
    session: SessionDep, offset: int = 0, limit: Annotated[int, Query(le=100)] = 100
) -> list[CompetitionPublic]:
    competitions = session.exec(select(Competition).offset(offset).limit(limit)).all()
    return competitions


@app.get("/competitions/{name}")
def retrieve_competition(name: str, session: SessionDep) -> CompetitionPublic:
    competition = session.exec(
        select(Competition).where(func.lower(Competition.name) == name.lower())
    ).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    return competition


@app.delete("/competitions/{name}")
def delete_competition(name: str, session: SessionDep):
    competition = session.exec(
        select(Competition).where(func.lower(Competition.name) == name.lower())
    ).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    session.delete(competition)
    session.commit()
    return {"ok": True}


@app.patch("/competitions/{name}")
def update_competition(
    name: str, competition: CompetitionBase, session: SessionDep
) -> CompetitionPublic:
    db_competition = session.exec(
        select(Competition).where(func.lower(Competition.name) == name.lower())
    ).first()
    if not db_competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    db_competition.sqlmodel_update(competition.model_dump(exclude_unset=True))
    db_competition.updated_at = datetime.now()
    session.add(db_competition)
    session.commit()
    session.refresh(db_competition)
    return db_competition


@app.post("/rating_types/")
def create_rating_type(
    rating_type: RatingTypeBase, session: SessionDep
) -> RatingTypePublic:
    db_rating_type = RatingType.model_validate(rating_type)
    session.add(db_rating_type)
    session.commit()
    session.refresh(db_rating_type)
    return db_rating_type


@app.get("/rating_types/")
def list_rating_types(
    session: SessionDep, offset: int = 0, limit: Annotated[int, Query(le=100)] = 100
) -> list[RatingTypePublic]:
    rating_types = session.exec(select(RatingType).offset(offset).limit(limit)).all()
    return rating_types


@app.get("/rating_types/{name}")
def retrieve_rating_type(name: str, session: SessionDep) -> RatingTypePublic:
    rating_type = session.exec(
        select(RatingType).where(func.lower(RatingType.name) == name.lower())
    ).first()
    if not rating_type:
        raise HTTPException(status_code=404, detail="Rating type not found")
    return rating_type


@app.delete("/rating_types/{name}")
def delete_rating_type(name: str, session: SessionDep):
    rating_type = session.exec(
        select(RatingType).where(func.lower(RatingType.name) == name.lower())
    ).first()
    if not rating_type:
        raise HTTPException(status_code=404, detail="Rating type not found")
    session.delete(rating_type)
    session.commit()
    return {"ok": True}


@app.patch("/rating_types/{name}")
def update_rating_type(
    name: str, rating_type: RatingTypeBase, session: SessionDep
) -> RatingTypePublic:
    db_rating_type = session.exec(
        select(RatingType).where(func.lower(RatingType.name) == name.lower())
    ).first()
    if not db_rating_type:
        raise HTTPException(status_code=404, detail="Rating type not found")
    db_rating_type.sqlmodel_update(rating_type.model_dump(exclude_unset=True))
    db_rating_type.updated_at = datetime.now()
    session.add(db_rating_type)
    session.commit()
    session.refresh(db_rating_type)
    return db_rating_type
