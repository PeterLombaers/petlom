from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from backend.auth import ModeratorDep
from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_object
from backend.models import (
    ExternalRating,
    Player,
    PlayerCreate,
    PlayerPublic,
    PlayerUpdate,
)

router = APIRouter(prefix="/players", tags=["players"])


@router.post("/")
def create_player(
    player: PlayerCreate, session: SessionDep, _: ModeratorDep
) -> PlayerPublic:
    external_ratings_data = player.external_ratings or []
    db_player = Player.model_validate(player.model_dump(exclude={"external_ratings"}))
    session.add(db_player)
    session.flush()
    for rating_data in external_ratings_data:
        session.add(ExternalRating(player_id=db_player.id, **rating_data.model_dump()))
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
    query = select(Player)
    if is_active is not None:
        query = query.where(Player.is_active == is_active)
    query = query.offset(offset).limit(limit)
    players = session.exec(query).all()
    return players


@router.get("/{id}/")
def retrieve_player(id: int, session: SessionDep) -> PlayerPublic:
    return find_object(model=Player, identifier=id, session=session)


@router.delete("/{id}/")
def delete_player(id: int, session: SessionDep, _: ModeratorDep):
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
def update_player(
    id: int, player: PlayerUpdate, session: SessionDep, _: ModeratorDep
) -> PlayerPublic:
    db_player = find_object(model=Player, identifier=id, session=session)
    db_player.sqlmodel_update(player.model_dump(exclude_unset=True))
    db_player.updated_at = datetime.now()
    session.add(db_player)
    session.commit()
    session.refresh(db_player)
    return db_player
