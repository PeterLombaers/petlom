import calendar
import threading
from collections.abc import Iterator, Sequence
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Any

import httpx

from backend.enums import ExternalRatingSource
from backend.external.base import (
    ExternalApiError,
    ExternalPlayerResult,
    ExternalRatingRecord,
    ProviderNotConfiguredError,
)

# chess_player_db serves every time control; we track the classical rating.
RATING_FORMAT = "classical"

# The search endpoint refuses a larger page.
MAX_SEARCH_LIMIT = 50

# How many requests the rating database may be answering for us at once. A
# match run costs one request per player, so without a cap a single run would
# be all the traffic that service sees. The semaphore is module level on
# purpose: it counts every request from this process, whatever source or
# provider instance it came from, so concurrent runs share the same budget
# instead of each getting their own.
MAX_CONCURRENT_REQUESTS = 4

_request_slots = threading.Semaphore(MAX_CONCURRENT_REQUESTS)

# One client for the whole process. Providers are built per request (see
# backend.external.registry.get_provider) and never closed, so a client per
# provider would leak a connection pool per request; sharing one also lets
# connections be reused across the many searches a match run makes.
_client = httpx.Client(timeout=10.0)


class ChessDbProvider:
    """Client for a self-hosted chess_player_db instance.

    One instance per source: the service covers several federations, and which
    one this provider speaks for is fixed by the source it was built for.

    The endpoints used (all JSON):
    - GET /federations/                     -> [{"code", "name", "latest_period"}]
    - GET /players/?q=&federation=&limit=   -> search hits with current_ratings
    - GET /ratings/?federation=&id=&period= -> many players' ratings at once

    Periods are full dates there ("2026-08-13", the day the list was published)
    and months here, so they are truncated on the way in and widened to the end
    of the month on the way out -- asking for the 1st would miss a list
    published later in its own month.

    Instances are cheap and hold no connection of their own: every request goes
    through the module's shared client and its MAX_CONCURRENT_REQUESTS budget.
    """

    def __init__(self, base_url: str, source: ExternalRatingSource):
        self.base_url = base_url.rstrip("/")
        self.source = source
        self.federation = source.value.upper()

    def _request(self, method: str, path: str, **kwargs) -> Any:
        try:
            with _request_slots:
                response = _client.request(method, f"{self.base_url}{path}", **kwargs)
            if response.status_code == 404:
                # The only 404 these endpoints raise is an unknown federation,
                # which means nobody has imported that rating list yet.
                raise ProviderNotConfiguredError(
                    f"The rating database has no data for {self.federation}"
                )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise ExternalApiError(f"Rating database request failed: {exc}") from exc

    def get_latest_list_date(self) -> str:
        federations = self._request("GET", "/federations/")
        if not isinstance(federations, list):
            raise ExternalApiError(
                "Rating database federations response was not a list"
            )
        for federation in federations:
            if federation.get("code") == self.federation:
                period = federation.get("latest_period")
                if not period:
                    raise ExternalApiError(
                        f"The rating database holds no {self.federation} rating list"
                    )
                return period[:7]
        raise ProviderNotConfiguredError(
            f"The rating database does not know federation {self.federation}"
        )

    def _result_from_hit(self, hit: dict) -> ExternalPlayerResult:
        return ExternalPlayerResult(
            source=self.source,
            external_id=str(hit["federation_player_id"]),
            name=hit.get("name") or "",
            country=hit.get("country"),
            title=hit.get("title"),
            rating=(hit.get("current_ratings") or {}).get(RATING_FORMAT),
            # Deliberately absent: the hit's rating is the current one, and
            # naming its list would cost a request on every keystroke.
            list_date=None,
        )

    def search_players(self, query: str, limit: int = 20) -> list[ExternalPlayerResult]:
        """Search by name, or by external id when the query is one.

        No branch on a numeric query: the search endpoint already tries an
        exact identifier match first and falls back to the name.
        """
        hits = self._request(
            "GET",
            "/players/",
            params={
                "q": query.strip(),
                "federation": self.federation,
                "limit": min(limit, MAX_SEARCH_LIMIT),
            },
        )
        if not isinstance(hits, list):
            raise ExternalApiError("Rating database search response was not a list")
        return [self._result_from_hit(hit) for hit in hits]

    def search_players_bulk(
        self, queries: Sequence[str], limit: int = 20
    ) -> Iterator[list[ExternalPlayerResult]]:
        """Search for many names at once, yielding hits in the order asked.

        Searches run concurrently, but never more of them than
        MAX_CONCURRENT_REQUESTS allows -- the semaphore in _request is what
        holds the line, so this pool cannot outpace it however wide it is.

        Yields lazily so that a caller consuming it can keep what it got before
        a failing query: the exception surfaces at the position of the query
        that raised it, with every earlier result already handed over.
        """
        queries = list(queries)
        if not queries:
            return
        executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_REQUESTS)
        try:
            yield from executor.map(
                lambda query: self.search_players(query, limit=limit), queries
            )
        finally:
            # cancel_futures: when a query raises, or the caller walks away,
            # the searches still queued are requests nobody will read.
            executor.shutdown(wait=False, cancel_futures=True)

    def get_ratings(
        self, external_ids: Sequence[str], list_date: str | None = None
    ) -> dict[str, ExternalRatingRecord | None]:
        list_date = list_date or self.get_latest_list_date()
        ratings: dict[str, ExternalRatingRecord | None] = dict.fromkeys(external_ids)
        if not external_ids:
            return ratings

        rows = self._request(
            "GET",
            "/ratings/",
            params={
                "federation": self.federation,
                "id": list(external_ids),
                "format": RATING_FORMAT,
                "period": _end_of_month(list_date).isoformat(),
            },
        )
        if not isinstance(rows, list):
            raise ExternalApiError("Rating database ratings response was not a list")

        for row in rows:
            external_id = str(row["federation_player_id"])
            # An id we did not ask about cannot be stored: there is no player
            # to attach it to.
            if external_id not in ratings:
                continue
            ratings[external_id] = ExternalRatingRecord(
                external_id=external_id,
                rating=row["value"],
                # The list the rating actually came from, which may be older
                # than the one that was asked for.
                list_date=row["period"][:7],
            )
        return ratings


def _end_of_month(list_date: str) -> date:
    """The last day of a "YYYY-MM" month, as the cut-off date to ask for."""
    try:
        year, month = (int(part) for part in list_date.split("-"))
        return date(year, month, calendar.monthrange(year, month)[1])
    except ValueError as exc:
        raise ExternalApiError(f"Invalid list date '{list_date}'") from exc
