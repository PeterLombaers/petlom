from datetime import datetime
from typing import Annotated, Type, TypeVar

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Session, select

from backend.competitions.simkro import create_matchups
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


T = TypeVar("SQLModel")


def find_object(model: Type[T], identifier: str | int, session: SessionDep) -> T:
    obj = session.get(model, identifier)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return obj


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
    return find_object(model=Competition, identifier=name, session=session)


@app.delete("/competitions/{name}")
def delete_competition(name: str, session: SessionDep):
    competition = find_object(model=Competition, identifier=name, session=session)
    session.delete(competition)
    session.commit()
    return {"ok": True}


@app.patch("/competitions/{name}")
def update_competition(
    name: str, competition: CompetitionUpdate, session: SessionDep
) -> CompetitionPublic:
    db_competition = find_object(model=Competition, identifier=name, session=session)
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


@app.post("/competitions/{name}/round/{round_nr}")
def create_competition_round(
    name: str, round_nr: int, player_ids: list[int], session: SessionDep
) -> list[MatchPublic]:
    competition = find_object(model=Competition, identifier=name, session=session)

    # Check if the previous round exists and the current or later rounds do not exist.
    if round_nr > 1:
        previous_round_match = session.exec(
            select(Match).where(Match.round == round_nr - 1)
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
        select(Match.round).where(Match.round >= round_nr)
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

    previous_matches = session.exec(select(Match).where(Match.round < round_nr)).all()
    matches = create_matchups(
        matches=previous_matches,
        players=db_players,
        round_nr=round_nr,
        competition=competition,
    )
    session.add_all(matches)
    session.commit()
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
    return find_object(model=RatingType, identifier=name, session=session)


@app.delete("/rating_types/{name}")
def delete_rating_type(name: str, session: SessionDep):
    rating_type = find_object(model=RatingType, identifier=name, session=session)
    session.delete(rating_type)
    session.commit()
    return {"ok": True}


@app.patch("/rating_types/{name}")
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
    player = find_object(model=Player, identifier=player_id, session=session)
    session.delete(player)
    session.commit()
    return {"ok": True}


@app.patch("/players/{player_id}/")
def update_player(
    player_id: int, player: PlayerUpdate, session: SessionDep
) -> PlayerPublic:
    db_player = find_object(model=Player, identifier=player_id, session=session)
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
    match_obj = find_object(model=Match, identifier=id, session=session)
    return match_obj


@app.delete("/matches/{id}")
def delete_match(id: int, session: SessionDep):
    match_obj = find_object(model=Match, identifier=id, session=session)
    session.delete(match_obj)
    session.commit()
    return {"ok": True}


@app.patch("/matches/{id}")
def update_match(id: int, match_obj: MatchUpdate, session: SessionDep) -> MatchPublic:
    db_match = find_object(model=Match, identifier=id, session=session)
    db_match.sqlmodel_update(match_obj.model_dump(exclude_unset=True))
    db_match.updated_at = datetime.now()
    session.add(db_match)
    session.commit()
    session.refresh(db_match)
    return db_match
