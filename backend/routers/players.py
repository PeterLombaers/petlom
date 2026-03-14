from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import select

from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_object
from backend.models import (
    Player,
    PlayerCreate,
    PlayerPublic,
    PlayerRating,
    PlayerUpdate,
)

router = APIRouter(prefix="/players", tags=["players"])


@router.post("/")
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


@router.get("/")
def list_players(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
    is_active: bool | None = None,
) -> list[PlayerPublic]:
    query = select(Player).options(selectinload(Player.ratings))
    if is_active is not None:
        query = query.where(Player.is_active == is_active)
    query = query.offset(offset).limit(limit)
    players = session.exec(query).all()
    return players


@router.get("/{id}/")
def retrieve_player(id: int, session: SessionDep) -> PlayerPublic:
    return find_object(model=Player, identifier=id, session=session)


@router.delete("/{id}/")
def delete_player(id: int, session: SessionDep):
    player = find_object(model=Player, identifier=id, session=session)
    try:
        session.delete(player)
        session.commit()
    except IntegrityError:
        session.rollback()
        player.is_active = False
        session.add(player)
        session.commit()
    return {"ok": True}


@router.patch("/{id}/")
def update_player(id: int, player: PlayerUpdate, session: SessionDep) -> PlayerPublic:
    db_player = find_object(model=Player, identifier=id, session=session)
    db_player.sqlmodel_update(player.model_dump(exclude_unset=True))
    db_player.updated_at = datetime.now()
    if player.ratings is not None:
        for rating in player.ratings:
            updated = False
            for db_rating in db_player.ratings:
                if db_rating.rating_type_name == rating.rating_type_name:
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
