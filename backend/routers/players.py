from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import col, select

from backend.auth import ModeratorDep
from backend.dependencies import MAX_PAGE_LENGTH, SessionDep, find_object
from backend.enums import ExternalRatingSource, PlayerStatus
from backend.models import (
    LIST_DATE_PATTERN,
    ExternalRating,
    ExternalRatingPublic,
    Match,
    Player,
    PlayerCreate,
    PlayerDetail,
    PlayerExternalId,
    PlayerExternalIdPublic,
    PlayerExternalIdUpdate,
    PlayerPublic,
    PlayerUpdate,
    RoundRegistration,
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


ListDateQuery = Annotated[
    str | None,
    Query(
        pattern=LIST_DATE_PATTERN,
        description=(
            "Rating list to report external ratings for, as YYYY-MM. Defaults to"
            " the newest snapshot of each player."
        ),
    ),
]


@router.get("/")
def list_players(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=MAX_PAGE_LENGTH)] = MAX_PAGE_LENGTH,
    status: Annotated[
        PlayerStatus,
        Query(
            description=(
                "Which players to list. Soft-deleted players are inactive and are"
                " left out unless asked for."
            ),
        ),
    ] = PlayerStatus.ACTIVE,
    list_date: ListDateQuery = None,
) -> list[PlayerPublic]:
    query = select(Player)
    if status is not PlayerStatus.ALL:
        query = query.where(Player.is_active == (status is PlayerStatus.ACTIVE))
    query = query.order_by(col(Player.id)).offset(offset).limit(limit)
    players = session.exec(query).all()
    ratings = selected_ratings([player.id for player in players], list_date, session)
    return [
        PlayerPublic.model_validate(
            player, update={"external_ids": _external_ids_public(player, ratings)}
        )
        for player in players
    ]


@router.get("/{id}/")
def retrieve_player(
    id: int, session: SessionDep, list_date: ListDateQuery = None
) -> PlayerDetail:
    player = find_object(model=Player, identifier=id, session=session)
    ratings = selected_ratings([player.id], list_date, session)
    return PlayerDetail.model_validate(
        player, update={"external_ids": _external_ids_public(player, ratings)}
    )


def selected_ratings(
    player_ids: Sequence[int], list_date: str | None, session: SessionDep
) -> dict[int, ExternalRating]:
    """The rating snapshot to report for each external id of the given players.

    Keyed by PlayerExternalId.id. The selected snapshot is the newest one at or
    before `list_date`, or the newest one overall when no date is given — the
    same rule the external providers use, so "the rating as of month X" means
    the same thing everywhere. External ids without a snapshot are absent.
    """
    if not player_ids:
        return {}
    query = (
        select(ExternalRating)
        .join(PlayerExternalId)
        .where(col(PlayerExternalId.player_id).in_(player_ids))
    )
    if list_date is not None:
        query = query.where(ExternalRating.list_date <= list_date)
    # Ascending, so the last row written per external id is the newest one.
    query = query.order_by(col(ExternalRating.list_date))
    return {rating.player_external_id_id: rating for rating in session.exec(query)}


def external_rating_public(rating: ExternalRating) -> ExternalRatingPublic:
    """Build the response model; `source` lives on the identifier, not the snapshot."""
    return ExternalRatingPublic(
        id=rating.id,
        player_external_id_id=rating.player_external_id_id,
        source=rating.player_external_id.source,
        rating=rating.rating,
        list_date=rating.list_date,
        imported_at=rating.imported_at,
    )


def _external_ids_public(
    player: Player, ratings: dict[int, ExternalRating]
) -> list[PlayerExternalIdPublic]:
    return [
        PlayerExternalIdPublic(
            id=external_id.id,
            source=external_id.source,
            external_id=external_id.external_id,
            created_at=external_id.created_at,
            updated_at=external_id.updated_at,
            rating=(
                external_rating_public(ratings[external_id.id])
                if external_id.id in ratings
                else None
            ),
        )
        for external_id in player.external_ids
    ]


@router.delete("/{id}/")
def delete_player(id: int, session: SessionDep, _: ModeratorDep):
    """Delete a player, or deactivate them if they have competition history.

    Ratings and external ids are owned by the player and cascade away with
    them, so they don't count as history.
    """
    player = find_object(model=Player, identifier=id, session=session)
    if _has_competition_history(player, session):
        player.is_active = False
        session.add(player)
    else:
        session.delete(player)
    session.commit()
    return {"ok": True}


def _has_competition_history(player: Player, session: SessionDep) -> bool:
    """Whether any match or round registration still references the player."""
    played = session.exec(
        select(Match.id)
        .where(
            (Match.player_white_id == player.id) | (Match.player_black_id == player.id)
        )
        .limit(1)
    ).first()
    registered = session.exec(
        select(RoundRegistration.id)
        .where(RoundRegistration.player_id == player.id)
        .limit(1)
    ).first()
    return played is not None or registered is not None


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
    return [external_rating_public(rating) for rating in ratings]


def _find_external_id(
    player: Player, source: ExternalRatingSource
) -> PlayerExternalId | None:
    return next((ext for ext in player.external_ids if ext.source == source), None)
