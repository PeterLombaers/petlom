from typing import Any, Sequence

import httpx

from backend.enums import ExternalRatingSource
from backend.external.base import (
    ExternalApiError,
    ExternalPlayerResult,
    ExternalRatingRecord,
)


class FideProvider:
    """Client for the FIDE rating API.

    The API exposes (all JSON):
    - GET  {settings_url}       -> {"FRLdate": "YYYY-MM", ...} (latest FIDE list)
    - POST {base}/q             -> search; body {"Name": ..., "Country": <code>,
                                   "Active": bool}. Omitting a field disables that
                                   filter ("all countries" from the informal docs
                                   returns nothing; ListDate is ignored).
    - GET  {base}/history/{id}  -> list of rating entries per list date; [] for
                                   unknown ids.
    """

    source = ExternalRatingSource.FIDE

    def __init__(
        self, base_url: str, settings_url: str | None = None, timeout: float = 10.0
    ):
        self.base_url = base_url.rstrip("/")
        # The settings endpoint lives under a sibling path of the fide base
        # (e.g. .../api/fide -> .../api/usf/settings).
        self.settings_url = (
            settings_url or self.base_url.rsplit("/", 1)[0] + "/usf/settings"
        )
        self._client = httpx.Client(timeout=timeout)

    def _request(self, method: str, url: str, **kwargs) -> Any:
        try:
            response = self._client.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise ExternalApiError(f"FIDE API request failed: {exc}") from exc

    def get_latest_list_date(self) -> str:
        data = self._request("GET", self.settings_url)
        list_date = data.get("FRLdate") if isinstance(data, dict) else None
        if not list_date:
            raise ExternalApiError("FIDE API settings did not contain FRLdate")
        return list_date

    def _result_from_entry(self, entry: dict) -> ExternalPlayerResult:
        return ExternalPlayerResult(
            source=self.source,
            external_id=str(entry["fideID"]),
            name=entry.get("name") or "",
            country=entry.get("country"),
            title=entry.get("title"),
            rating=entry.get("rating"),
            list_date=entry.get("listDate"),
        )

    def _history(self, external_id: str) -> list[dict]:
        entries = self._request("GET", f"{self.base_url}/history/{external_id}")
        if not isinstance(entries, list):
            raise ExternalApiError("FIDE API history response was not a list")
        return sorted(entries, key=lambda e: e.get("listDate") or "", reverse=True)

    def search_players(self, query: str, limit: int = 20) -> list[ExternalPlayerResult]:
        query = query.strip()
        if query.isdigit():
            entries = self._history(query)
            return [self._result_from_entry(entries[0])] if entries else []
        entries = self._request("POST", f"{self.base_url}/q", json={"Name": query})
        if not isinstance(entries, list):
            raise ExternalApiError("FIDE API search response was not a list")
        return [self._result_from_entry(entry) for entry in entries[:limit]]

    def get_ratings(
        self, external_ids: Sequence[str], list_date: str | None = None
    ) -> dict[str, ExternalRatingRecord | None]:
        list_date = list_date or self.get_latest_list_date()
        ratings: dict[str, ExternalRatingRecord | None] = {}
        for external_id in external_ids:
            # Newest entry at or before the requested list date ("YYYY-MM"
            # strings compare chronologically).
            entry = next(
                (
                    e
                    for e in self._history(external_id)
                    if e.get("listDate")
                    and e.get("rating") is not None
                    and e["listDate"] <= list_date
                ),
                None,
            )
            ratings[external_id] = (
                ExternalRatingRecord(
                    external_id=external_id,
                    rating=entry["rating"],
                    list_date=entry["listDate"],
                )
                if entry
                else None
            )
        return ratings
