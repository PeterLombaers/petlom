from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy import func

from db import init_engine, init_db

app = FastAPI()
engine = init_engine(check_same_thread=False, echo=True)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


@app.on_event("startup")
def on_startup():
    init_db(engine)


@app.post("/competitions/")
def create_competition(competition: Competition, session: SessionDep) -> Competition:
    session.add(competition)
    session.commit()
    session.refresh(competition)
    return competition


@app.get("/competitions/")
def read_competitions(
    session: SessionDep, offset: int = 0, limit: Annotated[int, Query(le=100)] = 100
) -> list[Competition]:
    competitions = session.exec(select(Competition).offset(offset).limit(limit)).all()
    return competitions


@app.get("/competitions/{name}")
def read_competition(name: str, session: SessionDep) -> Competition:
    competition = session.exec(
        select(Competition).where(func.lower(Competition.name) == name.lower())
    ).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    return competition
