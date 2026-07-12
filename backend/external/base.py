"""Provider abstraction for external rating sources (FIDE, KNSB, ...).

The models here are intentionally not in backend/models.py: that module owns
everything we persist or expose about our own entities, while a provider
package owns the shapes of the external data its client produces. They are
transient DTOs, never stored in the database (imported snapshots are stored
as backend.models.ExternalRating).
"""

from typing import Protocol, Sequence

from sqlmodel import SQLModel

from backend.enums import ExternalRatingSource


class ExternalApiError(Exception):
    """The external rating API could not be reached or returned an error."""


class ProviderNotConfiguredError(Exception):
    """No provider is configured for the requested source."""


class ExternalPlayerResult(SQLModel):
    """A player as found at an external rating source."""

    source: ExternalRatingSource
    external_id: str
    name: str
    country: str | None = None
    title: str | None = None
    rating: float | None = None
    list_date: str | None = None


class ExternalRatingRecord(SQLModel):
    """A player's rating at an external source at a specific list date."""

    external_id: str
    rating: float
    list_date: str


class ExternalRatingProvider(Protocol):
    """Client for an external rating source (e.g. FIDE, KNSB)."""

    source: ExternalRatingSource

    def get_latest_list_date(self) -> str:
        """Return the most recent list date ("YYYY-MM") available at the source."""
        ...

    def search_players(
        self, query: str, limit: int = 20
    ) -> list[ExternalPlayerResult]:
        """Search players at the source by name, or by external id if the query
        looks like one."""
        ...

    def get_ratings(
        self, external_ids: Sequence[str], list_date: str | None = None
    ) -> dict[str, ExternalRatingRecord | None]:
        """Fetch the rating of each external id at the given list date.

        Defaults to the latest list date. Ids unknown at the source (or without
        a rating at or before the list date) map to None."""
        ...
