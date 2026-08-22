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
    Competition,
    CompetitionRating,
    ExternalRating,
    ExternalRatingPublic,
    Match,
    Player,
    PlayerCreate,
    PlayerDetail,
    PlayerExternalId,
    PlayerExternalIdPublic,
    PlayerExternalIdUpdate,
    PlayerMerge,
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


@router.post("/{id}/merge/")
def merge_player(
    id: int, merge: PlayerMerge, session: SessionDep, _: ModeratorDep
) -> PlayerPublic:
    """Fold another player into this one, and delete them.

    The same person is sometimes entered twice, usually with a spelling mistake
    in one of the names. This moves every match, round registration, competition
    rating and external id of `other_id` onto `id`, so the history ends up in
    one place.

    The merge is strict: it only proceeds when the two players' data is
    disjoint. Anything that would collapse two rows into one — a match they
    played against each other, the same round, the same competition rating, two
    different ids at the same source — is reported as a 409 and nothing is
    written.
    """
    if merge.other_id == id:
        raise HTTPException(
            status_code=400, detail="A player cannot merge into itself."
        )
    player = find_object(model=Player, identifier=id, session=session)
    other = find_object(model=Player, identifier=merge.other_id, session=session)

    conflicts = _merge_conflicts(player, other, session)
    if conflicts:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{player.name} and {other.name} cannot be merged: "
                + "; ".join(conflicts)
                + "."
            ),
        )

    matches = session.exec(
        select(Match).where(
            (Match.player_white_id == other.id) | (Match.player_black_id == other.id)
        )
    ).all()
    for match in matches:
        if match.player_white_id == other.id:
            match.player_white_id = player.id
        if match.player_black_id == other.id:
            match.player_black_id = player.id
        session.add(match)
    registrations = session.exec(
        select(RoundRegistration).where(RoundRegistration.player_id == other.id)
    ).all()
    ratings = session.exec(
        select(CompetitionRating).where(CompetitionRating.player_id == other.id)
    ).all()
    # The external rating snapshots hang off the identifier, so they come along
    # with it and need no touching of their own.
    external_ids = session.exec(
        select(PlayerExternalId).where(PlayerExternalId.player_id == other.id)
    ).all()
    for owned in (*registrations, *ratings, *external_ids):
        owned.player_id = player.id
        session.add(owned)

    if merge.name is not None:
        player.name = merge.name
    # A duplicate is often the row that was soft-deleted; the merged player is
    # active if either half was.
    player.is_active = player.is_active or other.is_active
    player.updated_at = datetime.now(UTC)
    session.add(player)

    session.flush()
    # `Player.competition_ratings` and `.external_ids` cascade-delete, and the
    # rows we just moved are still in the loaded collections. Refreshing empties
    # them, so deleting `other` takes nothing with it.
    session.refresh(other)
    session.delete(other)
    session.commit()
    session.refresh(player)
    return player


def _merge_conflicts(player: Player, other: Player, session: SessionDep) -> list[str]:
    """Everything that stops the two players from being folded into one."""
    conflicts = []

    played_each_other = session.exec(
        select(Match).where(
            ((Match.player_white_id == player.id) & (Match.player_black_id == other.id))
            | (
                (Match.player_white_id == other.id)
                & (Match.player_black_id == player.id)
            )
        )
    ).all()
    for match in played_each_other:
        conflicts.append(
            f"they played each other in {match.competition_name} round"
            f" {match.round} board {match.board}"
        )

    registrations = session.exec(
        select(RoundRegistration).where(
            col(RoundRegistration.player_id).in_([player.id, other.id])
        )
    ).all()
    seen_rounds: dict[tuple[int, int], RoundRegistration] = {}
    for registration in registrations:
        key = (registration.competition_id, registration.round)
        if key in seen_rounds:
            competition = session.get(Competition, registration.competition_id)
            conflicts.append(
                "they are both registered for round"
                f" {registration.round} of {competition.name}"
            )
        else:
            seen_rounds[key] = registration

    ratings = session.exec(
        select(CompetitionRating).where(
            col(CompetitionRating.player_id).in_([player.id, other.id])
        )
    ).all()
    seen_rating_types: set[int] = set()
    for rating in ratings:
        if rating.rating_type_id in seen_rating_types:
            conflicts.append(
                f"they both have a rating in {rating.rating_type.competition_name}"
            )
        else:
            seen_rating_types.add(rating.rating_type_id)

    # Two rows can never share an external id (source, external_id) is unique,
    # so a shared source always means two different identifiers.
    sources = {external_id.source for external_id in player.external_ids}
    for external_id in other.external_ids:
        if external_id.source in sources:
            conflicts.append(f"they have different {external_id.source.value} ids")

    return conflicts


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
