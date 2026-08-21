from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, select

from backend.auth import ModeratorDep
from backend.dependencies import SessionDep
from backend.enums import ExternalRatingSource
from backend.external import (
    ExternalApiError,
    ExternalPlayerResult,
    ExternalRatingProvider,
    ProviderNotConfiguredError,
    get_provider,
    name_matches,
)
from backend.models import (
    ExternalIdMatchPublic,
    ExternalIdMatchRequest,
    ExternalIdMatchResult,
    ExternalIdMatchSkip,
    ExternalRating,
    ExternalRatingImportRequest,
    ExternalRatingImportResult,
    Player,
    PlayerExternalId,
)

router = APIRouter(prefix="/external", tags=["external"])

# The external API takes the whole batch in one request, so this is a guard
# against a runaway import rather than a cost limit.
MAX_IMPORT_BATCH_SIZE = 500

# Matching costs one request per player, so this one is a real cost limit.
MAX_MATCH_BATCH_SIZE = 200

# Enough hits to see that a name is ambiguous without paging through everyone
# who shares a surname.
MATCH_SEARCH_LIMIT = 20


def find_provider(source: ExternalRatingSource) -> ExternalRatingProvider:
    try:
        return get_provider(source)
    except ProviderNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


def api_error(exc: Exception) -> HTTPException:
    """Turn a provider failure into the response it deserves.

    A source can also turn out to be unconfigured mid-call — whether the rating
    database holds anything for this federation is only known once it answers —
    so that is the same 503 as a missing provider, not a 502.
    """
    if isinstance(exc, ProviderNotConfiguredError):
        return HTTPException(status_code=503, detail=str(exc))
    return HTTPException(status_code=502, detail=str(exc))


@router.get("/{source}/search/")
def search_external_players(
    source: ExternalRatingSource,
    query: Annotated[str, Query(min_length=2)],
    _: ModeratorDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ExternalPlayerResult]:
    provider = find_provider(source)
    try:
        return provider.search_players(query, limit=limit)
    except (ExternalApiError, ProviderNotConfiguredError) as exc:
        raise api_error(exc)


@router.post("/{source}/import/")
def import_external_ratings(
    source: ExternalRatingSource,
    request: ExternalRatingImportRequest,
    session: SessionDep,
    _: ModeratorDep,
) -> ExternalRatingImportResult:
    """Import rating snapshots from an external source for a batch of players.

    Which players: those in request.player_ids, or every player when it is
    None. Only players that have an external id for the source are looked up;
    the rest are reported back as players_without_id. Players that already
    have a snapshot at the list date are skipped (counted in skipped) unless
    request.update_existing is true. Batches of more than
    MAX_IMPORT_BATCH_SIZE looked-up players are rejected with a 400.

    Which rating: the one at request.list_date ("YYYY-MM"), defaulting to the
    source's most recent list. If the source has no entry for a player at that
    exact date, the newest older entry is used instead; players unknown at the
    source (or with no entry at or before the date) are reported in not_found.

    Each fetched rating is stored as an ExternalRating snapshot under the list
    date it actually came from — inserted if that (player, list date) snapshot
    is new (counted in imported), overwritten otherwise (counted in updated).

    Returns an ExternalRatingImportResult summarizing all of the above.
    Responds 503 if the source has no configured provider and 502 if the
    external API fails.
    """
    provider = find_provider(source)

    external_id_query = select(PlayerExternalId).where(
        PlayerExternalId.source == source
    )
    if request.player_ids is not None:
        external_id_query = external_id_query.where(
            col(PlayerExternalId.player_id).in_(request.player_ids)
        )
    external_ids = list(session.exec(external_id_query).all())

    if request.player_ids is not None:
        players_with_id = {ext.player_id for ext in external_ids}
        players_without_id = [
            id for id in request.player_ids if id not in players_with_id
        ]
    else:
        players_with_id_query = select(PlayerExternalId.player_id).where(
            PlayerExternalId.source == source
        )
        players_without_id = list(
            session.exec(
                select(Player.id).where(col(Player.id).not_in(players_with_id_query))
            ).all()
        )

    try:
        list_date = request.list_date or provider.get_latest_list_date()
    except (ExternalApiError, ProviderNotConfiguredError) as exc:
        raise api_error(exc)

    skipped = 0
    if not request.update_existing:
        already_imported = set(
            session.exec(
                select(ExternalRating.player_external_id_id).where(
                    col(ExternalRating.player_external_id_id).in_(
                        [ext.id for ext in external_ids]
                    ),
                    ExternalRating.list_date == list_date,
                )
            ).all()
        )
        skipped = len(already_imported)
        external_ids = [ext for ext in external_ids if ext.id not in already_imported]

    if len(external_ids) > MAX_IMPORT_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Import batch too large ({len(external_ids)} players);"
                f" maximum is {MAX_IMPORT_BATCH_SIZE}."
            ),
        )

    try:
        ratings = provider.get_ratings(
            [ext.external_id for ext in external_ids], list_date=list_date
        )
    except (ExternalApiError, ProviderNotConfiguredError) as exc:
        raise api_error(exc)

    imported = 0
    updated = 0
    not_found: list[str] = []
    for ext in external_ids:
        record = ratings.get(ext.external_id)
        if record is None:
            not_found.append(ext.external_id)
            continue
        # The record's list date may be older than the requested one if the
        # source has no entry for that exact list; store it under its own date.
        existing = session.exec(
            select(ExternalRating).where(
                ExternalRating.player_external_id_id == ext.id,
                ExternalRating.list_date == record.list_date,
            )
        ).first()
        if existing:
            existing.rating = record.rating
            existing.imported_at = datetime.now(UTC)
            session.add(existing)
            updated += 1
        else:
            session.add(
                ExternalRating(
                    player_external_id_id=ext.id,
                    rating=record.rating,
                    list_date=record.list_date,
                )
            )
            imported += 1
    session.commit()

    return ExternalRatingImportResult(
        list_date=list_date,
        imported=imported,
        updated=updated,
        skipped=skipped,
        not_found=not_found,
        players_without_id=players_without_id,
    )


@router.post("/{source}/match/")
def match_external_ids(
    source: ExternalRatingSource,
    request: ExternalIdMatchRequest,
    session: SessionDep,
    _: ModeratorDep,
) -> ExternalIdMatchResult:
    """Find the external id of players by searching the source for their name.

    Which players: those in request.player_ids, or every player when it is
    None, in both cases only the ones that have no external id for the source
    yet. Existing ids are never overwritten. Batches of more
    than MAX_MATCH_BATCH_SIZE players are rejected with a 400: unlike a rating
    import, this costs one request to the source per player.

    Which id: the one of the single player at the source whose name equals the
    Petlom player's (see backend.external.matching). A name that several
    players there carry, or none, leaves the player without an id and is
    reported in skipped, as is a name whose match is already another Petlom
    player's id.

    Returns an ExternalIdMatchResult listing both. Responds 503 if the source
    has no configured provider and 502 if the external API fails; ids matched
    before the failure are saved, so a retry picks up where it left off.
    """
    provider = find_provider(source)

    players_with_id = select(PlayerExternalId.player_id).where(
        PlayerExternalId.source == source
    )
    player_query = select(Player).where(col(Player.id).not_in(players_with_id))
    if request.player_ids is not None:
        player_query = player_query.where(col(Player.id).in_(request.player_ids))
    players = list(session.exec(player_query).all())

    if len(players) > MAX_MATCH_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Match batch too large ({len(players)} players);"
                f" maximum is {MAX_MATCH_BATCH_SIZE}."
            ),
        )

    taken_ids = set(
        session.exec(
            select(PlayerExternalId.external_id).where(
                PlayerExternalId.source == source
            )
        ).all()
    )

    matched: list[ExternalIdMatchPublic] = []
    skipped: list[ExternalIdMatchSkip] = []

    def skip(player: Player, reason: str) -> None:
        skipped.append(
            ExternalIdMatchSkip(
                player_id=player.id,  # type: ignore[arg-type]
                player_name=player.name,
                reason=reason,  # type: ignore[arg-type]
            )
        )

    for player in players:
        try:
            hits = provider.search_players(player.name, limit=MATCH_SEARCH_LIMIT)
        except (ExternalApiError, ProviderNotConfiguredError) as exc:
            # Everything matched so far is worth keeping: the run is long and
            # searching again for the same player yields the same answer.
            session.commit()
            raise api_error(exc)
        candidates = name_matches(player.name, hits)
        if len(candidates) != 1:
            skip(player, "ambiguous" if candidates else "not_found")
            continue
        hit = candidates[0]
        if hit.external_id in taken_ids:
            skip(player, "taken")
            continue
        taken_ids.add(hit.external_id)
        session.add(
            PlayerExternalId(
                player_id=player.id,  # type: ignore[arg-type]
                source=source,
                external_id=hit.external_id,
            )
        )
        matched.append(
            ExternalIdMatchPublic(
                player_id=player.id,  # type: ignore[arg-type]
                player_name=player.name,
                external_id=hit.external_id,
                external_name=hit.name,
            )
        )
    session.commit()

    return ExternalIdMatchResult(
        source=source,
        searched=len(players),
        matched=matched,
        skipped=skipped,
    )
