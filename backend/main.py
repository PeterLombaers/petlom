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
    CompetitionUpdate,
    Match,
    MatchBase,
    MatchPublic,
    MatchUpdate,
    Player,
    PlayerCreate,
    PlayerPublic,
    PlayerRating,
    PlayerUpdate,
    RatingType,
    RatingTypeBase,
    RatingTypePublic,
    RatingTypeUpdate,
)

app = FastAPI()
engine = init_engine(
    fp="database.db", connect_args={"check_same_thread": False}, echo=True
)
MAX_PAGE_LENGTH = 100


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
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
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
    name: str, competition: CompetitionUpdate, session: SessionDep
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


@app.get("/competitions/{name}/round/{round_nr}")
def retrieve_competition_round(
    name: str, round_nr: int, session: SessionDep
) -> list[MatchPublic]:
    matches = session.exec(
        select(Match)
        .where(Match.competition_name == name)
        .where(Match.round == round_nr)
    ).all()
    return matches


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
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
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
    name: str, rating_type: RatingTypeUpdate, session: SessionDep
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


@app.post("/players/")
def create_player(player: PlayerCreate, session: SessionDep) -> PlayerPublic:
    ratings = player.ratings
    player.ratings = []
    db_player = Player.model_validate(player)
    if ratings is not None:
        db_player.ratings = [
            PlayerRating(
                player=db_player,
                rating_type_name=rating.rating_type_name,
                rating=rating.rating,
            )
            for rating in ratings
        ]
    session.add(db_player)
    session.commit()
    session.refresh(db_player)
    return db_player


@app.get("/players/")
def list_players(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
) -> list[PlayerPublic]:
    players = session.exec(select(Player).offset(offset).limit(limit)).all()
    return players


@app.get("/players/{player_id}/")
def retrieve_player(player_id: int, session: SessionDep) -> PlayerPublic:
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@app.delete("/players/{player_id}/")
def delete_player(player_id: int, session: SessionDep):
    player = session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    session.delete(player)
    session.commit()
    return {"ok": True}


@app.patch("/players/{player_id}/")
def update_player(
    player_id: int, player: PlayerUpdate, session: SessionDep
) -> PlayerPublic:
    db_player = session.get(Player, player_id)
    if not db_player:
        raise HTTPException(status_code=404, detail="Player not found")
    db_player.sqlmodel_update(player.model_dump(exclude_unset=True))
    db_player.updated_at = datetime.now()
    if player.ratings is not None:
        for rating in player.ratings:
            updated = False
            for db_rating in db_player.ratings:
                if db_rating.name == rating.rating_type_name:
                    db_rating.rating = rating.rating
                    updated = True
                    break
            if not updated:
                db_player.ratings.append(
                    PlayerRating(
                        player_id=db_player.id,
                        rating_type_name=rating.rating_type_name,
                        rating=rating.rating,
                    )
                )

    session.add(db_player)
    session.commit()
    session.refresh(db_player)
    return db_player


@app.post("/matches/")
def create_match(match_obj: MatchBase, session: SessionDep) -> MatchPublic:
    db_match = Match.model_validate(match_obj)
    session.add(db_match)
    session.commit()
    session.refresh(db_match)
    return db_match


@app.get("/matches/")
def list_matches(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
) -> list[MatchPublic]:
    matches = session.exec(select(Match).offset(offset).limit(limit)).all()
    return matches


@app.get("/matches/{id}")
def retrieve_match(id: int, session: SessionDep) -> MatchPublic:
    match_obj = session.get(Match, id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")
    return match_obj


@app.delete("/matches/{id}")
def delete_match(id: int, session: SessionDep):
    match_obj = match_obj = session.get(Match, id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")
    session.delete(match_obj)
    session.commit()
    return {"ok": True}


@app.patch("/matches/{id}")
def update_match(id: int, match_obj: MatchUpdate, session: SessionDep) -> MatchPublic:
    db_match = session.get(Match, id)
    if not db_match:
        raise HTTPException(status_code=404, detail="Match not found")
    db_match.sqlmodel_update(match_obj.model_dump(exclude_unset=True))
    db_match.updated_at = datetime.now()
    session.add(db_match)
    session.commit()
    session.refresh(db_match)
    return db_match
