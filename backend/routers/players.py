from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from backend.auth import ModeratorDep
from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_object
from backend.enums import ExternalRatingSource
from backend.models import (
    ExternalRating,
    ExternalRatingPublic,
    Player,
    PlayerCreate,
    PlayerDetailPublic,
    PlayerExternalId,
    PlayerExternalIdPublic,
    PlayerExternalIdUpdate,
    PlayerPublic,
    PlayerUpdate,
)

router = APIRouter(prefix="/players", tags=["players"])


@router.post("/")
def create_player(
    player: PlayerCreate, session: SessionDep, _: ModeratorDep
) -> PlayerPublic:
    db_player = Player.model_validate(player.model_dump(exclude={"external_ids"}))
    db_player.external_ids = [
        PlayerExternalId(source=external_id.source, external_id=external_id.external_id)
        for external_id in player.external_ids
    ]
    session.add(db_player)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="An external id in the request already belongs to another player.",
        )
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
def retrieve_player(id: int, session: SessionDep) -> PlayerDetailPublic:
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
    db_player.updated_at = datetime.now(UTC)
    session.add(db_player)
    session.commit()
    session.refresh(db_player)
    return db_player


@router.put("/{id}/external-ids/{source}/")
def set_player_external_id(
    id: int,
    source: ExternalRatingSource,
    external_id: PlayerExternalIdUpdate,
    session: SessionDep,
    _: ModeratorDep,
) -> PlayerExternalIdPublic:
    player = find_object(model=Player, identifier=id, session=session)
    db_external_id = _find_external_id(player, source)
    if db_external_id:
        db_external_id.external_id = external_id.external_id
        db_external_id.updated_at = datetime.now(UTC)
    else:
        db_external_id = PlayerExternalId(
            player_id=player.id, source=source, external_id=external_id.external_id
        )
    session.add(db_external_id)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"This {source.value} id already belongs to another player.",
        )
    session.refresh(db_external_id)
    return db_external_id


@router.delete("/{id}/external-ids/{source}/")
def delete_player_external_id(
    id: int, source: ExternalRatingSource, session: SessionDep, _: ModeratorDep
):
    player = find_object(model=Player, identifier=id, session=session)
    db_external_id = _find_external_id(player, source)
    if not db_external_id:
        raise HTTPException(status_code=404, detail="PlayerExternalId not found")
    session.delete(db_external_id)
    session.commit()
    return {"ok": True}


@router.get("/{id}/external-ratings/")
def list_player_external_ratings(
    id: int, session: SessionDep
) -> list[ExternalRatingPublic]:
    player = find_object(model=Player, identifier=id, session=session)
    ratings = session.exec(
        select(ExternalRating)
        .join(PlayerExternalId)
        .where(PlayerExternalId.player_id == player.id)
        .order_by(ExternalRating.list_date.desc())  # type: ignore[union-attr]
    ).all()
    return [
        ExternalRatingPublic(
            id=rating.id,
            player_external_id_id=rating.player_external_id_id,
            source=rating.player_external_id.source,
            rating=rating.rating,
            list_date=rating.list_date,
            imported_at=rating.imported_at,
        )
        for rating in ratings
    ]


def _find_external_id(
    player: Player, source: ExternalRatingSource
) -> PlayerExternalId | None:
    return next((ext for ext in player.external_ids if ext.source == source), None)
