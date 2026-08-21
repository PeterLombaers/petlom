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
    ExternalPlayerResult,
    ProviderNotConfiguredError,
    name_matches,
    normalize_name,
    unique_match,
)
from backend.models import LIST_DATE_PATTERN, ExternalRating, Player, PlayerExternalId
from backend.routers import external_ratings

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
# Name matching
# ---------------------------------------------------------------------------


def search_result(external_id: str, name: str) -> ExternalPlayerResult:
    return ExternalPlayerResult(
        source=ExternalRatingSource.FIDE, external_id=external_id, name=name
    )


@pytest.mark.parametrize(
    "left,right",
    [
        ("Magnus Carlsen", "Carlsen, Magnus"),
        ("Jorden van Foreest", "van Foreest, Jorden"),
        ("Jorden van Foreest", "Jorden van Föreest"),
        ("Anish Giri", "GIRI, ANISH"),
        ("Jan-Krzysztof Duda", "Duda, Jan Krzysztof"),
        ("Loek  van Wely", "van Wely, Loek"),
    ],
)
def test_normalize_name_equal(left: str, right: str):
    assert normalize_name(left) == normalize_name(right)


@pytest.mark.parametrize(
    "left,right",
    [
        ("Magnus Carlsen", "Henrik Carlsen"),
        ("Anish Giri", "Anish Giri Giri"),
        ("Jan Timman", "Jan Timmen"),
    ],
)
def test_normalize_name_different(left: str, right: str):
    assert normalize_name(left) != normalize_name(right)


def test_name_matches_drops_hits_with_another_name():
    """The source matches on words, so a surname alone is not a match."""
    hits = [
        search_result("1", "Carlsen, Magnus"),
        search_result("2", "Carlsen, Henrik"),
    ]
    assert [hit.external_id for hit in name_matches("Magnus Carlsen", hits)] == ["1"]


def test_name_matches_counts_a_repeated_id_once():
    hits = [search_result("1", "Carlsen, Magnus"), search_result("1", "Magnus Carlsen")]
    assert len(name_matches("Magnus Carlsen", hits)) == 1


def test_unique_match():
    hits = [search_result("1", "Carlsen, Magnus"), search_result("2", "Doe, John")]
    assert unique_match("Magnus Carlsen", hits).external_id == "1"


def test_unique_match_namesakes():
    hits = [search_result("1", "Jansen, Piet"), search_result("2", "Jansen, Piet")]
    assert unique_match("Piet Jansen", hits) is None


def test_unique_match_no_hits():
    assert unique_match("Piet Jansen", []) is None


# ---------------------------------------------------------------------------
# Match endpoint
# ---------------------------------------------------------------------------


@respx.mock
def test_match_endpoint(
    auth_client: TestClient,
    session: Session,
    player_factory: Callable[..., Player],
    chess_db_configured,
):
    player = player_factory(name="Magnus Carlsen")
    route = respx.get(PLAYERS_URL).respond(
        json=[
            player_hit("1503014", 2823, name="Carlsen, Magnus"),
            player_hit("1503259", 2100, name="Carlsen, Henrik"),
        ]
    )

    res = auth_client.post("/external/fide/match/", json={})
    res.raise_for_status()
    result = res.json()
    assert result["searched"] == 1
    assert result["skipped"] == []
    assert result["matched"] == [
        {
            "player_id": player.id,
            "player_name": "Magnus Carlsen",
            "player_is_active": True,
            "external_id": "1503014",
            "external_name": "Carlsen, Magnus",
        }
    ]
    assert route.calls.last.request.url.params["q"] == "Magnus Carlsen"

    external_ids = session.exec(select(PlayerExternalId)).all()
    assert len(external_ids) == 1
    assert external_ids[0].player_id == player.id
    assert external_ids[0].external_id == "1503014"


@respx.mock
def test_match_endpoint_ambiguous_and_unknown(
    auth_client: TestClient,
    session: Session,
    player_factory: Callable[..., Player],
    chess_db_configured,
):
    namesake = player_factory(name="Piet Jansen")
    unknown = player_factory(name="Nobody Here")

    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.params["q"] == "Piet Jansen":
            return httpx.Response(
                200,
                json=[
                    player_hit("11", 1800, name="Jansen, Piet"),
                    player_hit("22", 1750, name="Jansen, Piet"),
                ],
            )
        return httpx.Response(200, json=[player_hit("33", 1600, name="Someone Else")])

    respx.get(PLAYERS_URL).mock(side_effect=respond)

    res = auth_client.post("/external/fide/match/", json={})
    res.raise_for_status()
    result = res.json()
    assert result["matched"] == []
    assert {skip["player_id"]: skip["reason"] for skip in result["skipped"]} == {
        namesake.id: "ambiguous",
        unknown.id: "not_found",
    }
    assert session.exec(select(PlayerExternalId)).all() == []


@respx.mock
def test_match_endpoint_leaves_existing_ids_alone(
    auth_client: TestClient,
    player_external_id_factory: Callable[..., PlayerExternalId],
    chess_db_configured,
):
    player_external_id_factory(external_id="111")
    route = respx.get(PLAYERS_URL).respond(json=[])

    res = auth_client.post("/external/fide/match/", json={})
    res.raise_for_status()
    assert res.json()["searched"] == 0
    # A player who already has an id is not worth a request.
    assert route.call_count == 0


@respx.mock
def test_match_endpoint_searches_a_source_the_player_has_no_id_for(
    auth_client: TestClient,
    session: Session,
    player_external_id_factory: Callable[..., PlayerExternalId],
    chess_db_configured,
):
    """A FIDE id says nothing about whether the KNSB id is known."""
    external_id = player_external_id_factory(external_id="111")
    player_name = external_id.player.name
    route = respx.get(PLAYERS_URL).respond(json=[player_hit("999", 1800, player_name)])

    res = auth_client.post("/external/knsb/match/", json={})
    res.raise_for_status()
    assert res.json()["matched"][0]["external_id"] == "999"
    assert route.calls.last.request.url.params["federation"] == "KNSB"

    sources = {ext.source for ext in session.exec(select(PlayerExternalId)).all()}
    assert sources == {ExternalRatingSource.FIDE, ExternalRatingSource.KNSB}


@respx.mock
def test_match_endpoint_id_already_taken(
    auth_client: TestClient,
    session: Session,
    player_factory: Callable[..., Player],
    player_external_id_factory: Callable[..., PlayerExternalId],
    chess_db_configured,
):
    """Two Petlom players cannot share one external id."""
    player_external_id_factory(external_id="111")
    namesake = player_factory(name="Piet Jansen")
    respx.get(PLAYERS_URL).respond(json=[player_hit("111", 1800, name="Jansen, Piet")])

    res = auth_client.post("/external/fide/match/", json={})
    res.raise_for_status()
    result = res.json()
    assert result["matched"] == []
    assert result["skipped"] == [
        {
            "player_id": namesake.id,
            "player_name": "Piet Jansen",
            "player_is_active": True,
            "reason": "taken",
        }
    ]
    assert len(session.exec(select(PlayerExternalId)).all()) == 1


@respx.mock
def test_match_endpoint_selected_players(
    auth_client: TestClient,
    player_factory: Callable[..., Player],
    chess_db_configured,
):
    wanted = player_factory(name="Magnus Carlsen")
    player_factory(name="Anish Giri")
    route = respx.get(PLAYERS_URL).respond(
        json=[player_hit("1503014", 2823, name="Carlsen, Magnus")]
    )

    res = auth_client.post("/external/fide/match/", json={"player_ids": [wanted.id]})
    res.raise_for_status()
    assert res.json()["searched"] == 1
    assert route.call_count == 1


@respx.mock
def test_match_endpoint_keeps_what_it_found_before_a_failure(
    auth_client: TestClient,
    session: Session,
    player_factory: Callable[..., Player],
    chess_db_configured,
):
    """A retry should pick up where the failed run left off."""
    player_factory(name="Magnus Carlsen")
    player_factory(name="Anish Giri")
    responses = [
        httpx.Response(200, json=[player_hit("1503014", 2823, name="Carlsen, Magnus")]),
        httpx.ConnectError("boom"),
    ]
    respx.get(PLAYERS_URL).mock(side_effect=responses)

    res = auth_client.post("/external/fide/match/", json={})
    assert res.status_code == 502

    external_ids = session.exec(select(PlayerExternalId)).all()
    assert [ext.external_id for ext in external_ids] == ["1503014"]


@respx.mock
def test_match_endpoint_batch_too_large(
    auth_client: TestClient,
    player_factory: Callable[..., Player],
    chess_db_configured,
    monkeypatch,
):
    monkeypatch.setattr(external_ratings, "MAX_MATCH_BATCH_SIZE", 1)
    player_factory()
    player_factory()
    route = respx.get(PLAYERS_URL).respond(json=[])

    res = auth_client.post("/external/fide/match/", json={})
    assert res.status_code == 400
    assert route.call_count == 0


def test_match_endpoint_requires_auth(client: TestClient):
    res = client.post("/external/fide/match/", json={})
    assert res.status_code == 401


def test_match_endpoint_unconfigured(auth_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "chess_db_api_base_url", None)
    res = auth_client.post("/external/fide/match/", json={})
    assert res.status_code == 503


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
