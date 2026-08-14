import re
from collections.abc import Callable

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.config import settings
from backend.enums import ExternalRatingSource
from backend.external import (
    ChessDbProvider,
    ExternalApiError,
    ProviderNotConfiguredError,
)
from backend.models import LIST_DATE_PATTERN, ExternalRating, Player, PlayerExternalId

BASE_URL = "http://chess-db.test"
FEDERATIONS_URL = f"{BASE_URL}/federations/"
PLAYERS_URL = f"{BASE_URL}/players/"
RATINGS_URL = f"{BASE_URL}/ratings/"


def player_hit(player_id: str, rating: int | None, name="Test, Player", country="NED"):
    """A search hit as chess_player_db returns it."""
    return {
        "federation_player_id": player_id,
        "name": name,
        "country": country,
        "title": None,
        "federation": {"code": "FIDE", "name": "International Chess Federation"},
        "sex": None,
        "birth_year": None,
        "is_active": True,
        "current_ratings": {} if rating is None else {"classical": rating},
        "score": 1.0,
    }


def rating_row(player_id: str, value: int, period: str):
    return {
        "federation_player_id": player_id,
        "period": period,
        "format": "classical",
        "value": value,
    }


@pytest.fixture
def provider() -> ChessDbProvider:
    return ChessDbProvider(BASE_URL, ExternalRatingSource.FIDE)


@pytest.fixture
def chess_db_configured(monkeypatch):
    monkeypatch.setattr(settings, "chess_db_api_base_url", BASE_URL)


@pytest.fixture
def mock_federations_endpoint():
    respx.get(FEDERATIONS_URL).respond(
        json=[
            {"code": "FIDE", "name": "FIDE", "latest_period": "2026-06-04"},
            {"code": "KNSB", "name": "KNSB", "latest_period": None},
        ]
    )


def test_provider_speaks_for_the_federation_of_its_source():
    provider = ChessDbProvider(BASE_URL, ExternalRatingSource.KNSB)
    assert provider.federation == "KNSB"


@respx.mock
def test_get_latest_list_date(provider: ChessDbProvider, mock_federations_endpoint):
    """The full publication date is truncated to the month we store."""
    assert provider.get_latest_list_date() == "2026-06"


@respx.mock
def test_get_latest_list_date_without_a_list(mock_federations_endpoint):
    provider = ChessDbProvider(BASE_URL, ExternalRatingSource.KNSB)
    with pytest.raises(ExternalApiError):
        provider.get_latest_list_date()


@respx.mock
def test_get_latest_list_date_unknown_federation(provider: ChessDbProvider):
    respx.get(FEDERATIONS_URL).respond(json=[])
    with pytest.raises(ProviderNotConfiguredError):
        provider.get_latest_list_date()


@respx.mock
def test_search_players_by_name(provider: ChessDbProvider):
    route = respx.get(PLAYERS_URL).respond(
        json=[player_hit("1503014", 2823, name="Carlsen, Magnus", country="NOR")]
    )
    results = provider.search_players("Carlsen")

    assert dict(route.calls.last.request.url.params) == {
        "q": "Carlsen",
        "federation": "FIDE",
        "limit": "20",
    }
    assert len(results) == 1
    assert results[0].external_id == "1503014"
    assert results[0].name == "Carlsen, Magnus"
    assert results[0].rating == 2823
    assert results[0].country == "NOR"
    assert results[0].source == ExternalRatingSource.FIDE


@respx.mock
def test_search_players_by_id(provider: ChessDbProvider):
    """An identifier is just a query; the search endpoint matches it exactly."""
    route = respx.get(PLAYERS_URL).respond(json=[player_hit("1503014", 2823)])
    assert len(provider.search_players("1503014")) == 1
    assert route.calls.last.request.url.params["q"] == "1503014"


@respx.mock
def test_search_players_clamps_the_limit(provider: ChessDbProvider):
    """Asking for more than a page would be rejected by the source."""
    route = respx.get(PLAYERS_URL).respond(json=[])
    provider.search_players("Test", limit=100)
    assert route.calls.last.request.url.params["limit"] == "50"


@respx.mock
def test_search_players_without_a_rating(provider: ChessDbProvider):
    respx.get(PLAYERS_URL).respond(json=[player_hit("111", None)])
    assert provider.search_players("Test")[0].rating is None


@respx.mock
def test_search_players_no_match(provider: ChessDbProvider):
    respx.get(PLAYERS_URL).respond(json=[])
    assert provider.search_players("Nobody") == []


@respx.mock
def test_search_players_upstream_error(provider: ChessDbProvider):
    respx.get(PLAYERS_URL).respond(status_code=500)
    with pytest.raises(ExternalApiError):
        provider.search_players("Carlsen")


@respx.mock
def test_search_players_unknown_federation(provider: ChessDbProvider):
    """No such federation in the database: nothing to search, not a failure."""
    respx.get(PLAYERS_URL).respond(status_code=404, json={"detail": "Unknown"})
    with pytest.raises(ProviderNotConfiguredError):
        provider.search_players("Carlsen")


@respx.mock
def test_get_ratings(provider: ChessDbProvider, mock_federations_endpoint):
    route = respx.get(RATINGS_URL).respond(json=[rating_row("111", 2100, "2026-06-04")])
    ratings = provider.get_ratings(["111", "222"])

    params = route.calls.last.request.url.params
    assert params.get_list("id") == ["111", "222"]
    assert params["federation"] == "FIDE"
    assert params["format"] == "classical"
    # The whole month is asked for, so a list published mid-month still counts.
    assert params["period"] == "2026-06-30"

    assert ratings["111"].rating == 2100
    assert ratings["111"].list_date == "2026-06"
    assert ratings["222"] is None


@respx.mock
def test_get_ratings_falls_back_to_an_older_list(provider: ChessDbProvider):
    """The snapshot is stored under the month it came from, not the one asked for."""
    respx.get(RATINGS_URL).respond(json=[rating_row("111", 2000, "2025-08-01")])
    ratings = provider.get_ratings(["111"], list_date="2026-01")
    assert ratings["111"].rating == 2000
    assert ratings["111"].list_date == "2025-08"


@respx.mock
def test_get_ratings_ignores_an_id_it_did_not_ask_for(provider: ChessDbProvider):
    respx.get(RATINGS_URL).respond(
        json=[
            rating_row("111", 2000, "2026-06-04"),
            rating_row("999", 1500, "2026-06-04"),
        ]
    )
    assert set(provider.get_ratings(["111"], list_date="2026-06")) == {"111"}


def test_get_ratings_without_ids_asks_nothing(provider: ChessDbProvider):
    assert provider.get_ratings([], list_date="2026-06") == {}


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


def test_search_endpoint_requires_auth(client: TestClient):
    res = client.get("/external/fide/search/", params={"query": "Carlsen"})
    assert res.status_code == 401


def test_search_endpoint_unconfigured(auth_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "chess_db_api_base_url", None)
    res = auth_client.get("/external/fide/search/", params={"query": "Carlsen"})
    assert res.status_code == 503


def test_search_endpoint_unknown_source(auth_client: TestClient):
    res = auth_client.get("/external/foo/search/", params={"query": "Carlsen"})
    assert res.status_code == 422


def test_search_endpoint_query_too_short(auth_client: TestClient, chess_db_configured):
    res = auth_client.get("/external/fide/search/", params={"query": "C"})
    assert res.status_code == 422


@respx.mock
def test_search_endpoint(auth_client: TestClient, chess_db_configured):
    respx.get(PLAYERS_URL).respond(
        json=[player_hit("1503014", 2823, name="Carlsen, Magnus")]
    )
    res = auth_client.get("/external/fide/search/", params={"query": "Carlsen"})
    res.raise_for_status()
    results = res.json()
    assert len(results) == 1
    assert results[0]["source"] == "fide"
    assert results[0]["external_id"] == "1503014"


@respx.mock
def test_search_endpoint_searches_the_source_it_was_given(
    auth_client: TestClient, chess_db_configured
):
    route = respx.get(PLAYERS_URL).respond(json=[])
    auth_client.get("/external/knsb/search/", params={"query": "Jansen"})
    assert route.calls.last.request.url.params["federation"] == "KNSB"


@respx.mock
def test_search_endpoint_upstream_error(auth_client: TestClient, chess_db_configured):
    respx.get(PLAYERS_URL).mock(side_effect=httpx.ConnectError)
    res = auth_client.get("/external/fide/search/", params={"query": "Carlsen"})
    assert res.status_code == 502


@respx.mock
def test_search_endpoint_source_without_data(
    auth_client: TestClient, chess_db_configured
):
    """A federation nobody has imported yet reads as an unconfigured source."""
    respx.get(PLAYERS_URL).respond(status_code=404, json={"detail": "Unknown"})
    res = auth_client.get("/external/knsb/search/", params={"query": "Jansen"})
    assert res.status_code == 503


@respx.mock
def test_import_endpoint(
    auth_client: TestClient,
    session: Session,
    player_factory: Callable[..., Player],
    player_external_id_factory: Callable[..., PlayerExternalId],
    chess_db_configured,
    mock_federations_endpoint,
):
    ext_1 = player_external_id_factory(external_id="111")
    ext_2 = player_external_id_factory(external_id="222")
    player_without_id = player_factory()
    route = respx.get(RATINGS_URL).respond(json=[rating_row("111", 2100, "2026-06-04")])

    res = auth_client.post("/external/fide/import/", json={})
    res.raise_for_status()
    result = res.json()
    assert result["list_date"] == "2026-06"
    assert result["imported"] == 1
    assert result["updated"] == 0
    assert result["not_found"] == ["222"]
    assert result["players_without_id"] == [player_without_id.id]
    # Both players are looked up in a single request.
    assert route.call_count == 1

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
    chess_db_configured,
    mock_federations_endpoint,
):
    player_external_id_factory(external_id="111")
    route = respx.get(RATINGS_URL)
    route.respond(json=[rating_row("111", 2100, "2026-06-04")])
    auth_client.post("/external/fide/import/", json={}).raise_for_status()

    route.respond(json=[rating_row("111", 2150, "2026-06-04")])
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
    chess_db_configured,
    mock_federations_endpoint,
):
    player_external_id_factory(external_id="111")
    route = respx.get(RATINGS_URL)
    route.respond(json=[rating_row("111", 2100, "2026-06-04")])
    auth_client.post("/external/fide/import/", json={}).raise_for_status()

    route.respond(json=[rating_row("111", 2150, "2026-06-04")])
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
    chess_db_configured,
    mock_federations_endpoint,
):
    ext_1 = player_external_id_factory(external_id="111")
    player_external_id_factory(external_id="222")
    route = respx.get(RATINGS_URL).respond(json=[rating_row("111", 2100, "2026-06-04")])

    res = auth_client.post(
        "/external/fide/import/", json={"player_ids": [ext_1.player_id]}
    )
    res.raise_for_status()
    result = res.json()
    assert result["imported"] == 1
    assert result["players_without_id"] == []
    assert route.calls.last.request.url.params.get_list("id") == ["111"]
    assert len(session.exec(select(ExternalRating)).all()) == 1


@respx.mock
def test_import_endpoint_source_without_data(
    auth_client: TestClient,
    player_external_id_factory: Callable[..., PlayerExternalId],
    chess_db_configured,
):
    player_external_id_factory(source=ExternalRatingSource.KNSB, external_id="111")
    respx.get(FEDERATIONS_URL).respond(json=[])
    res = auth_client.post("/external/knsb/import/", json={})
    assert res.status_code == 503


def test_import_endpoint_requires_auth(client: TestClient):
    res = client.post("/external/fide/import/", json={})
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Live tests against the real rating database (run with --external or
# EXTERNAL_TESTS=true; CHESS_DB_API_BASE_URL must be set in .env)
# ---------------------------------------------------------------------------

CARLSEN_ID = "1503014"
GIRI_ID = "24116068"


@pytest.fixture(scope="session")
def live_provider() -> ChessDbProvider:
    if not settings.chess_db_api_base_url:
        pytest.skip("CHESS_DB_API_BASE_URL is not configured")
    return ChessDbProvider(settings.chess_db_api_base_url, ExternalRatingSource.FIDE)


@pytest.fixture(scope="session")
def live_list_date(live_provider: ChessDbProvider) -> str:
    list_date = live_provider.get_latest_list_date()
    assert re.match(LIST_DATE_PATTERN, list_date)
    return list_date


@pytest.mark.external
def test_live_search_players(live_provider: ChessDbProvider):
    by_name = live_provider.search_players("Carlsen, Magnus")
    assert CARLSEN_ID in [result.external_id for result in by_name]

    by_id = live_provider.search_players(GIRI_ID)
    assert "Giri" in by_id[0].name


@pytest.mark.external
def test_live_get_ratings(live_provider: ChessDbProvider, live_list_date: str):
    ratings = live_provider.get_ratings([CARLSEN_ID, GIRI_ID], list_date=live_list_date)
    for external_id in (CARLSEN_ID, GIRI_ID):
        record = ratings[external_id]
        assert record is not None
        assert record.rating > 2500
        assert record.list_date <= live_list_date
