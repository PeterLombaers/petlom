import re
from collections.abc import Callable

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.config import settings
from backend.external import ExternalApiError, FideProvider
from backend.models import LIST_DATE_PATTERN, ExternalRating, Player, PlayerExternalId

BASE_URL = "http://fide-api.test/api/fide"
SETTINGS_URL = "http://fide-api.test/api/usf/settings"


def history_entry(fide_id: int, rating: int, list_date: str, name="Test, Player"):
    return {
        "fideID": fide_id,
        "name": name,
        "country": "NED",
        "title": None,
        "rating": rating,
        "listDate": list_date,
    }


@pytest.fixture
def provider() -> FideProvider:
    return FideProvider(BASE_URL)


@pytest.fixture
def fide_configured(monkeypatch):
    monkeypatch.setattr(settings, "fide_api_base_url", BASE_URL)


@pytest.fixture
def mock_settings_endpoint():
    respx.get(SETTINGS_URL).respond(json={"KRLdate": "x", "FRLdate": "2026-06"})


def test_provider_derives_settings_url(provider: FideProvider):
    assert provider.settings_url == SETTINGS_URL


@respx.mock
def test_get_latest_list_date(provider: FideProvider, mock_settings_endpoint):
    assert provider.get_latest_list_date() == "2026-06"


@respx.mock
def test_search_players_by_name(provider: FideProvider):
    route = respx.post(f"{BASE_URL}/q").respond(
        json=[history_entry(1503014, 2823, "2026-06", name="Carlsen, Magnus")]
    )
    results = provider.search_players("Carlsen")
    assert route.calls.last.request.content == b'{"Name": "Carlsen"}'
    assert len(results) == 1
    assert results[0].external_id == "1503014"
    assert results[0].name == "Carlsen, Magnus"
    assert results[0].rating == 2823
    assert results[0].country == "NED"


@respx.mock
def test_search_players_by_name_respects_limit(provider: FideProvider):
    respx.post(f"{BASE_URL}/q").respond(
        json=[history_entry(i, 2000, "2026-06") for i in range(30)]
    )
    assert len(provider.search_players("Test", limit=5)) == 5


@respx.mock
def test_search_players_by_id(provider: FideProvider):
    respx.get(f"{BASE_URL}/history/1503014").respond(
        json=[
            history_entry(1503014, 2839, "2025-08"),
            history_entry(1503014, 2823, "2026-06"),
        ]
    )
    results = provider.search_players("1503014")
    # The newest entry is used, regardless of response order.
    assert len(results) == 1
    assert results[0].rating == 2823
    assert results[0].list_date == "2026-06"


@respx.mock
def test_search_players_by_unknown_id(provider: FideProvider):
    respx.get(f"{BASE_URL}/history/999").respond(json=[])
    assert provider.search_players("999") == []


@respx.mock
def test_search_players_upstream_error(provider: FideProvider):
    respx.post(f"{BASE_URL}/q").respond(status_code=500)
    with pytest.raises(ExternalApiError):
        provider.search_players("Carlsen")


@respx.mock
def test_get_ratings(provider: FideProvider, mock_settings_endpoint):
    respx.get(f"{BASE_URL}/history/111").respond(
        json=[
            history_entry(111, 2000, "2025-08"),
            history_entry(111, 2100, "2026-06"),
        ]
    )
    respx.get(f"{BASE_URL}/history/222").respond(json=[])
    ratings = provider.get_ratings(["111", "222"])
    assert ratings["111"].rating == 2100
    assert ratings["111"].list_date == "2026-06"
    assert ratings["222"] is None


@respx.mock
def test_get_ratings_falls_back_to_older_list(provider: FideProvider):
    respx.get(f"{BASE_URL}/history/111").respond(
        json=[
            history_entry(111, 2000, "2025-08"),
            history_entry(111, 2100, "2026-06"),
        ]
    )
    ratings = provider.get_ratings(["111"], list_date="2026-01")
    assert ratings["111"].rating == 2000
    assert ratings["111"].list_date == "2025-08"


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


def test_search_endpoint_requires_auth(client: TestClient):
    res = client.get("/external/fide/search/", params={"query": "Carlsen"})
    assert res.status_code == 401


def test_search_endpoint_unconfigured(auth_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "fide_api_base_url", None)
    res = auth_client.get("/external/fide/search/", params={"query": "Carlsen"})
    assert res.status_code == 503


def test_search_endpoint_unknown_source(auth_client: TestClient):
    res = auth_client.get("/external/foo/search/", params={"query": "Carlsen"})
    assert res.status_code == 422


def test_search_endpoint_query_too_short(auth_client: TestClient, fide_configured):
    res = auth_client.get("/external/fide/search/", params={"query": "C"})
    assert res.status_code == 422


@respx.mock
def test_search_endpoint(auth_client: TestClient, fide_configured):
    respx.post(f"{BASE_URL}/q").respond(
        json=[history_entry(1503014, 2823, "2026-06", name="Carlsen, Magnus")]
    )
    res = auth_client.get("/external/fide/search/", params={"query": "Carlsen"})
    res.raise_for_status()
    results = res.json()
    assert len(results) == 1
    assert results[0]["source"] == "fide"
    assert results[0]["external_id"] == "1503014"


@respx.mock
def test_search_endpoint_upstream_error(auth_client: TestClient, fide_configured):
    respx.post(f"{BASE_URL}/q").mock(side_effect=httpx.ConnectError)
    res = auth_client.get("/external/fide/search/", params={"query": "Carlsen"})
    assert res.status_code == 502


@respx.mock
def test_import_endpoint(
    auth_client: TestClient,
    session: Session,
    player_factory: Callable[..., Player],
    player_external_id_factory: Callable[..., PlayerExternalId],
    fide_configured,
    mock_settings_endpoint,
):
    ext_1 = player_external_id_factory(external_id="111")
    ext_2 = player_external_id_factory(external_id="222")
    player_without_id = player_factory()
    respx.get(f"{BASE_URL}/history/111").respond(
        json=[history_entry(111, 2100, "2026-06")]
    )
    respx.get(f"{BASE_URL}/history/222").respond(json=[])

    res = auth_client.post("/external/fide/import/", json={})
    res.raise_for_status()
    result = res.json()
    assert result["list_date"] == "2026-06"
    assert result["imported"] == 1
    assert result["updated"] == 0
    assert result["not_found"] == ["222"]
    assert result["players_without_id"] == [player_without_id.id]

    ratings = session.exec(select(ExternalRating)).all()
    assert len(ratings) == 1
    assert ratings[0].player_external_id_id == ext_1.id
    assert ratings[0].rating == 2100
    assert ratings[0].list_date == "2026-06"
    assert ext_2.external_ratings == []


@respx.mock
def test_import_endpoint_reimport_skips_existing(
    auth_client: TestClient,
    session: Session,
    player_external_id_factory: Callable[..., PlayerExternalId],
    fide_configured,
    mock_settings_endpoint,
):
    player_external_id_factory(external_id="111")
    route = respx.get(f"{BASE_URL}/history/111")
    route.respond(json=[history_entry(111, 2100, "2026-06")])
    auth_client.post("/external/fide/import/", json={}).raise_for_status()

    route.respond(json=[history_entry(111, 2150, "2026-06")])
    res = auth_client.post("/external/fide/import/", json={})
    res.raise_for_status()
    result = res.json()
    assert result["imported"] == 0
    assert result["updated"] == 0
    assert result["skipped"] == 1
    # The existing snapshot is not re-requested at the source.
    assert route.call_count == 1

    ratings = session.exec(select(ExternalRating)).all()
    assert len(ratings) == 1
    assert ratings[0].rating == 2100


@respx.mock
def test_import_endpoint_reimport_updates_when_requested(
    auth_client: TestClient,
    session: Session,
    player_external_id_factory: Callable[..., PlayerExternalId],
    fide_configured,
    mock_settings_endpoint,
):
    player_external_id_factory(external_id="111")
    route = respx.get(f"{BASE_URL}/history/111")
    route.respond(json=[history_entry(111, 2100, "2026-06")])
    auth_client.post("/external/fide/import/", json={}).raise_for_status()

    route.respond(json=[history_entry(111, 2150, "2026-06")])
    res = auth_client.post("/external/fide/import/", json={"update_existing": True})
    res.raise_for_status()
    result = res.json()
    assert result["imported"] == 0
    assert result["updated"] == 1
    assert result["skipped"] == 0

    ratings = session.exec(select(ExternalRating)).all()
    assert len(ratings) == 1
    assert ratings[0].rating == 2150


@respx.mock
def test_import_endpoint_selected_players(
    auth_client: TestClient,
    session: Session,
    player_external_id_factory: Callable[..., PlayerExternalId],
    fide_configured,
    mock_settings_endpoint,
):
    ext_1 = player_external_id_factory(external_id="111")
    player_external_id_factory(external_id="222")
    respx.get(f"{BASE_URL}/history/111").respond(
        json=[history_entry(111, 2100, "2026-06")]
    )

    res = auth_client.post(
        "/external/fide/import/", json={"player_ids": [ext_1.player_id]}
    )
    res.raise_for_status()
    result = res.json()
    assert result["imported"] == 1
    assert result["players_without_id"] == []
    ratings = session.exec(select(ExternalRating)).all()
    assert len(ratings) == 1


def test_import_endpoint_requires_auth(client: TestClient):
    res = client.post("/external/fide/import/", json={})
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Live tests against the real FIDE API (run with --external or
# EXTERNAL_TESTS=true; FIDE_API_BASE_URL must be set in .env)
# ---------------------------------------------------------------------------

CARLSEN_ID = "1503014"
GIRI_ID = "24116068"


@pytest.fixture(scope="session")
def live_provider() -> FideProvider:
    if not settings.fide_api_base_url:
        pytest.skip("FIDE_API_BASE_URL is not configured")
    return FideProvider(settings.fide_api_base_url)


@pytest.fixture(scope="session")
def live_list_date(live_provider: FideProvider) -> str:
    list_date = live_provider.get_latest_list_date()
    assert re.match(LIST_DATE_PATTERN, list_date)
    return list_date


@pytest.mark.external
def test_live_search_players(live_provider: FideProvider, live_list_date: str):
    by_name = live_provider.search_players("Carlsen, Magnus")
    assert CARLSEN_ID in [result.external_id for result in by_name]

    by_id = live_provider.search_players(GIRI_ID)
    assert len(by_id) == 1
    assert "Giri" in by_id[0].name


@pytest.mark.external
def test_live_get_ratings(live_provider: FideProvider, live_list_date: str):
    ratings = live_provider.get_ratings([CARLSEN_ID, GIRI_ID], list_date=live_list_date)
    for external_id in (CARLSEN_ID, GIRI_ID):
        record = ratings[external_id]
        assert record is not None
        assert record.rating > 2500
        assert record.list_date <= live_list_date
