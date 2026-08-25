from collections.abc import Callable

import pytest
import respx
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.competitions import CompetitionType
from backend.config import settings
from backend.enums import ExternalRatingSource
from backend.models import (
    Competition,
    CompetitionPublic,
    CompetitionRating,
    ExternalRating,
    Match,
    MatchPublic,
    Player,
    PlayerDetail,
    PlayerExternalId,
    PlayerPublic,
    Result,
    RoundRegistration,
)


def test_create_competition(session: Session, auth_client: TestClient):
    competition_name = "interne"
    res = auth_client.post(
        "/competitions/",
        json={
            "name": competition_name,
            "type": "simkro",
            "rating_type": {"algorithm": "elo"},
        },
    )
    res.raise_for_status()
    competition = session.scalars(select(Competition)).all()
    assert len(competition) == 1
    competition = competition[0]
    assert competition.name == competition_name
    assert competition.type == CompetitionType.SIMKRO
    for key in ("created_at", "updated_at"):
        assert key in dict(competition)


def test_create_competition_duplicate_name(auth_client: TestClient):
    body = {"name": "interne", "type": "simkro", "rating_type": {"algorithm": "elo"}}
    auth_client.post("/competitions/", json=body)
    res = auth_client.post("/competitions/", json=body)
    assert res.status_code == 409
    detail = res.json()["detail"]
    assert any(
        e["loc"] == ["body", "name"] and "already exists" in e["msg"] for e in detail
    )


def test_get_competition(competition: Competition, client: TestClient):
    res = client.get(f"/competitions/{competition.name}/")
    res.raise_for_status()
    res_competition = res.json()
    assert res_competition.pop("n_rounds") == 0
    assert res_competition.pop("rating_type") is not None
    assert res_competition == jsonable_encoder(
        CompetitionPublic.model_validate(competition)
    )


def test_get_competition_n_rounds(
    simkro_setup: tuple[Competition, list[Player], list[Match]], client: TestClient
):
    (competition, _, matches) = simkro_setup
    n_rounds = max(m.round for m in matches)
    res = client.get(f"/competitions/{competition.name}/")
    res.raise_for_status()
    res_competition = res.json()
    assert res_competition.pop("n_rounds") == n_rounds


def test_list_competition(competition_factory, client):
    c0, c1 = competition_factory(name="c0"), competition_factory(name="c1")
    res = client.get("/competitions/")
    res.raise_for_status()
    competition = res.json()
    assert len(competition) == 2
    assert jsonable_encoder(CompetitionPublic.model_validate(c0)) == competition[0]
    assert jsonable_encoder(CompetitionPublic.model_validate(c1)) == competition[1]


def test_update_competition(competition, auth_client, session):
    new_name = "foo"
    res = auth_client.patch(
        f"/competitions/{competition.name}/", json={"name": new_name}
    )
    res.raise_for_status()
    session.refresh(competition)
    assert competition.name == new_name


def test_delete_competition(competition, auth_client, session):
    res = auth_client.delete(f"/competitions/{competition.name}/")
    res.raise_for_status()
    assert len(session.scalars(select(Competition)).all()) == 0


def test_delete_competition_cascade_matches(
    competition: Competition,
    match_factory: Callable[..., Match],
    auth_client: TestClient,
    session: Session,
):
    match_factory(competition=competition)
    res = auth_client.delete(f"/competitions/{competition.name}/")
    res.raise_for_status()
    matches = session.scalars(select(Match)).all()
    assert len(matches) == 0


def test_create_player(session: Session, auth_client: TestClient):
    player_name = "Peter"
    res = auth_client.post("/players/", json={"name": player_name})
    res.raise_for_status()
    players = session.scalars(select(Player)).all()
    assert len(players) == 1
    player = players[0]
    assert player.name == player_name
    for key in ("id", "created_at", "updated_at"):
        assert key in dict(player)


def test_create_player_empty_name_fail(auth_client: TestClient):
    res = auth_client.post("/players/", json={"name": ""})
    assert res.status_code == 422
    res = auth_client.post("/players/", json={"name": " "})
    assert res.status_code == 422


def test_get_player(player: Player, client: TestClient):
    res = client.get(f"/players/{player.id}/")
    res.raise_for_status()
    res_player = res.json()
    assert res_player == jsonable_encoder(PlayerDetail.model_validate(player))


def test_create_player_with_external_id(session: Session, auth_client: TestClient):
    res = auth_client.post(
        "/players/",
        json={
            "name": "Peter",
            "external_ids": [{"source": "fide", "external_id": "1023456"}],
        },
    )
    res.raise_for_status()
    assert res.json()["external_ids"][0]["external_id"] == "1023456"
    external_ids = session.scalars(select(PlayerExternalId)).all()
    assert len(external_ids) == 1
    assert external_ids[0].source == ExternalRatingSource.FIDE
    assert external_ids[0].external_id == "1023456"


def test_create_player_duplicate_external_id(auth_client: TestClient):
    body = {
        "name": "Peter",
        "external_ids": [{"source": "fide", "external_id": "1023456"}],
    }
    auth_client.post("/players/", json=body).raise_for_status()
    res = auth_client.post("/players/", json={**body, "name": "Petra"})
    assert res.status_code == 409


def test_set_player_external_id(
    player: Player, session: Session, auth_client: TestClient
):
    res = auth_client.put(
        f"/players/{player.id}/external-ids/fide/", json={"external_id": "1023456"}
    )
    res.raise_for_status()
    session.refresh(player)
    assert len(player.external_ids) == 1
    assert player.external_ids[0].external_id == "1023456"
    # Updating the same source overwrites instead of adding a second id.
    res = auth_client.put(
        f"/players/{player.id}/external-ids/fide/", json={"external_id": "2034567"}
    )
    res.raise_for_status()
    session.refresh(player)
    assert len(player.external_ids) == 1
    assert player.external_ids[0].external_id == "2034567"


def test_set_player_external_id_conflict(
    player_factory: Callable[..., Player], auth_client: TestClient
):
    p0, p1 = player_factory(), player_factory()
    auth_client.put(
        f"/players/{p0.id}/external-ids/fide/", json={"external_id": "1023456"}
    ).raise_for_status()
    res = auth_client.put(
        f"/players/{p1.id}/external-ids/fide/", json={"external_id": "1023456"}
    )
    assert res.status_code == 409


def test_set_player_external_id_requires_auth(player: Player, client: TestClient):
    res = client.put(
        f"/players/{player.id}/external-ids/fide/", json={"external_id": "1023456"}
    )
    assert res.status_code == 401


def test_delete_player_external_id(
    player_external_id_factory: Callable[..., PlayerExternalId],
    external_rating_factory: Callable[..., ExternalRating],
    session: Session,
    auth_client: TestClient,
):
    external_id = player_external_id_factory()
    external_rating_factory(player_external_id=external_id)
    res = auth_client.delete(f"/players/{external_id.player_id}/external-ids/fide/")
    res.raise_for_status()
    assert len(session.scalars(select(PlayerExternalId)).all()) == 0
    # Rating snapshots are deleted along with the identifier.
    assert len(session.scalars(select(ExternalRating)).all()) == 0


def test_delete_player_external_id_not_found(player: Player, auth_client: TestClient):
    res = auth_client.delete(f"/players/{player.id}/external-ids/fide/")
    assert res.status_code == 404


def test_list_player_external_ratings(
    player_external_id_factory: Callable[..., PlayerExternalId],
    external_rating_factory: Callable[..., ExternalRating],
    client: TestClient,
):
    external_id = player_external_id_factory()
    external_rating_factory(
        player_external_id=external_id, rating=1900.0, list_date="2026-05"
    )
    external_rating_factory(
        player_external_id=external_id, rating=1950.0, list_date="2026-06"
    )
    res = client.get(f"/players/{external_id.player_id}/external-ratings/")
    res.raise_for_status()
    ratings = res.json()
    assert [(r["list_date"], r["rating"], r["source"]) for r in ratings] == [
        ("2026-06", 1950.0, "fide"),
        ("2026-05", 1900.0, "fide"),
    ]


@pytest.fixture
def rated_external_id(
    player_external_id_factory: Callable[..., PlayerExternalId],
    external_rating_factory: Callable[..., ExternalRating],
) -> PlayerExternalId:
    """An external id with a rating snapshot in three consecutive months."""
    external_id = player_external_id_factory()
    for list_date, rating in [
        ("2026-04", 1850.0),
        ("2026-05", 1900.0),
        ("2026-06", 1950.0),
    ]:
        external_rating_factory(
            player_external_id=external_id, rating=rating, list_date=list_date
        )
    return external_id


@pytest.mark.parametrize("endpoint", ["list", "retrieve"])
def test_player_rating_defaults_to_newest_snapshot(
    rated_external_id: PlayerExternalId, endpoint: str, client: TestClient
):
    url = (
        "/players/"
        if endpoint == "list"
        else f"/players/{rated_external_id.player_id}/"
    )
    res = client.get(url)
    res.raise_for_status()
    player = res.json()[0] if endpoint == "list" else res.json()
    rating = player["external_ids"][0]["rating"]
    assert (rating["list_date"], rating["rating"], rating["source"]) == (
        "2026-06",
        1950.0,
        "fide",
    )


@pytest.mark.parametrize("endpoint", ["list", "retrieve"])
def test_player_rating_at_list_date(
    rated_external_id: PlayerExternalId, endpoint: str, client: TestClient
):
    url = (
        "/players/"
        if endpoint == "list"
        else f"/players/{rated_external_id.player_id}/"
    )
    # The newest snapshot at or before the requested date, even when there is
    # no snapshot for that month itself.
    for list_date, expected in [("2026-05", 1900.0), ("2026-12", 1950.0)]:
        res = client.get(url, params={"list_date": list_date})
        res.raise_for_status()
        player = res.json()[0] if endpoint == "list" else res.json()
        assert player["external_ids"][0]["rating"]["rating"] == expected

    # Nothing has been published yet at that date.
    res = client.get(url, params={"list_date": "2026-01"})
    res.raise_for_status()
    player = res.json()[0] if endpoint == "list" else res.json()
    assert player["external_ids"][0]["rating"] is None


def test_player_rating_without_snapshots(
    player_external_id_factory: Callable[..., PlayerExternalId], client: TestClient
):
    external_id = player_external_id_factory()
    res = client.get(f"/players/{external_id.player_id}/")
    res.raise_for_status()
    assert res.json()["external_ids"][0]["rating"] is None


@pytest.mark.parametrize("list_date", ["2026", "2026-5", "june"])
def test_player_invalid_list_date(list_date: str, client: TestClient):
    assert client.get("/players/", params={"list_date": list_date}).status_code == 422


def test_list_player(player_factory: Callable[..., Player], client):
    p0, p1 = player_factory(), player_factory()
    res = client.get("/players/")
    res.raise_for_status()
    res_players = res.json()
    assert len(res_players) == 2
    assert jsonable_encoder(PlayerPublic.model_validate(p0)) == res_players[0]
    assert jsonable_encoder(PlayerPublic.model_validate(p1)) == res_players[1]


def test_list_player_status_filter(player_factory: Callable[..., Player], client):
    player_factory()
    player_factory()
    inactive = player_factory(is_active=False)

    # Soft-deleted players are left out by default.
    res = client.get("/players/")
    res.raise_for_status()
    assert len(res.json()) == 2

    res = client.get("/players/", params={"status": "active"})
    res.raise_for_status()
    assert len(res.json()) == 2

    res = client.get("/players/", params={"status": "inactive"})
    res.raise_for_status()
    assert [p["id"] for p in res.json()] == [inactive.id]

    res = client.get("/players/", params={"status": "all"})
    res.raise_for_status()
    assert len(res.json()) == 3


def test_list_player_unknown_status_fail(client):
    res = client.get("/players/", params={"status": "deleted"})
    assert res.status_code == 422


def test_update_player(player, auth_client, session):
    new_name = "foo"
    res = auth_client.patch(f"/players/{player.id}/", json={"name": new_name})
    res.raise_for_status()
    session.refresh(player)
    assert player.name == new_name
    assert player.is_active


def test_update_player_empty_name_fail(player, auth_client):
    res = auth_client.patch(f"/players/{player.id}/", json={"name": ""})
    assert res.status_code == 422
    res = auth_client.patch(f"/players/{player.id}/", json={"name": " \n"})
    assert res.status_code == 422


def test_delete_player(player: Player, auth_client: TestClient, session: Session):
    res = auth_client.delete(f"/players/{player.id}/")
    res.raise_for_status()
    assert len(session.scalars(select(Player)).all()) == 0


def test_delete_player_is_active_false(
    player: Player, auth_client: TestClient, session: Session, match_factory
):
    match_factory(player_white=player, player_black=player)
    assert player.is_active
    res = auth_client.delete(f"/players/{player.id}/")
    res.raise_for_status()
    session.refresh(player)
    assert not player.is_active


def test_delete_player_registered_for_round(
    player: Player,
    competition: Competition,
    auth_client: TestClient,
    session: Session,
):
    session.add(
        RoundRegistration(competition_id=competition.id, round=1, player_id=player.id)
    )
    session.commit()
    res = auth_client.delete(f"/players/{player.id}/")
    res.raise_for_status()
    session.refresh(player)
    assert not player.is_active
    assert len(session.scalars(select(RoundRegistration)).all()) == 1


def test_merge_players(
    player_factory: Callable[..., Player],
    match_factory: Callable[..., Match],
    competition: Competition,
    auth_client: TestClient,
    session: Session,
):
    keeper = player_factory(name="Jan Colijn")
    duplicate = player_factory(name="Jan Collijn")
    other = player_factory()
    white = match_factory(
        competition=competition, player_white=duplicate, player_black=other
    )
    black = match_factory(
        competition=competition, player_white=other, player_black=duplicate
    )
    session.add(
        RoundRegistration(
            competition_id=competition.id, round=1, player_id=duplicate.id
        )
    )
    session.commit()

    res = auth_client.post(
        f"/players/{keeper.id}/merge/",
        json={"other_id": duplicate.id, "name": "Jan Collijn"},
    )
    res.raise_for_status()
    assert res.json()["name"] == "Jan Collijn"

    session.refresh(keeper)
    session.refresh(white)
    session.refresh(black)
    assert session.get(Player, duplicate.id) is None
    assert keeper.name == "Jan Collijn"
    assert white.player_white_id == keeper.id
    assert black.player_black_id == keeper.id
    registration = session.scalars(select(RoundRegistration)).one()
    assert registration.player_id == keeper.id


def test_merge_players_keeps_name_by_default(
    player_factory: Callable[..., Player], auth_client: TestClient, session: Session
):
    keeper = player_factory(name="Jan Colijn")
    duplicate = player_factory(name="Jan Collijn")
    res = auth_client.post(
        f"/players/{keeper.id}/merge/", json={"other_id": duplicate.id}
    )
    res.raise_for_status()
    session.refresh(keeper)
    assert keeper.name == "Jan Colijn"


def test_merge_players_reactivates(
    player_factory: Callable[..., Player], auth_client: TestClient, session: Session
):
    keeper = player_factory(is_active=False)
    duplicate = player_factory()
    res = auth_client.post(
        f"/players/{keeper.id}/merge/", json={"other_id": duplicate.id}
    )
    res.raise_for_status()
    session.refresh(keeper)
    assert keeper.is_active


def test_merge_players_takes_over_external_id(
    player_factory: Callable[..., Player],
    external_rating_factory: Callable[..., ExternalRating],
    player_external_id_factory: Callable[..., PlayerExternalId],
    auth_client: TestClient,
    session: Session,
):
    keeper = player_factory()
    duplicate = player_factory()
    external_id = player_external_id_factory(
        player=duplicate, source=ExternalRatingSource.FIDE, external_id="4242424"
    )
    external_rating_factory(player_external_id=external_id, rating=1750.0)

    res = auth_client.post(
        f"/players/{keeper.id}/merge/", json={"other_id": duplicate.id}
    )
    res.raise_for_status()

    session.refresh(keeper)
    assert [(e.source, e.external_id) for e in keeper.external_ids] == [
        (ExternalRatingSource.FIDE, "4242424")
    ]
    ratings = session.scalars(select(ExternalRating)).all()
    assert len(ratings) == 1
    assert ratings[0].player_external_id.player_id == keeper.id


def test_merge_players_played_each_other_conflict(
    player_factory: Callable[..., Player],
    match_factory: Callable[..., Match],
    auth_client: TestClient,
    session: Session,
):
    keeper = player_factory()
    duplicate = player_factory()
    match_factory(player_white=keeper, player_black=duplicate)

    res = auth_client.post(
        f"/players/{keeper.id}/merge/", json={"other_id": duplicate.id}
    )
    assert res.status_code == 409
    assert "played each other" in res.json()["detail"]
    assert session.get(Player, duplicate.id) is not None
    assert len(session.scalars(select(Match)).all()) == 1


def test_merge_players_same_round_conflict(
    player_factory: Callable[..., Player],
    competition: Competition,
    auth_client: TestClient,
    session: Session,
):
    keeper = player_factory()
    duplicate = player_factory()
    for player in (keeper, duplicate):
        session.add(
            RoundRegistration(
                competition_id=competition.id, round=2, player_id=player.id
            )
        )
    session.commit()

    res = auth_client.post(
        f"/players/{keeper.id}/merge/", json={"other_id": duplicate.id}
    )
    assert res.status_code == 409
    assert "round 2" in res.json()["detail"]
    assert session.get(Player, duplicate.id) is not None
    assert len(session.scalars(select(RoundRegistration)).all()) == 2


def test_merge_players_same_competition_rating_conflict(
    player_factory: Callable[..., Player],
    competition: Competition,
    auth_client: TestClient,
    session: Session,
):
    keeper = player_factory()
    duplicate = player_factory()
    for player in (keeper, duplicate):
        session.add(
            CompetitionRating(
                player_id=player.id,
                rating_type_id=competition.rating_type.id,
                initial_rating=1500.0,
                current_rating=1500.0,
            )
        )
    session.commit()

    res = auth_client.post(
        f"/players/{keeper.id}/merge/", json={"other_id": duplicate.id}
    )
    assert res.status_code == 409
    assert competition.name in res.json()["detail"]
    assert len(session.scalars(select(CompetitionRating)).all()) == 2


def test_merge_players_different_external_ids_conflict(
    player_factory: Callable[..., Player],
    player_external_id_factory: Callable[..., PlayerExternalId],
    auth_client: TestClient,
    session: Session,
):
    keeper = player_factory()
    duplicate = player_factory()
    player_external_id_factory(
        player=keeper, source=ExternalRatingSource.FIDE, external_id="1111111"
    )
    player_external_id_factory(
        player=duplicate, source=ExternalRatingSource.FIDE, external_id="2222222"
    )

    res = auth_client.post(
        f"/players/{keeper.id}/merge/", json={"other_id": duplicate.id}
    )
    assert res.status_code == 409
    assert "fide" in res.json()["detail"]
    assert len(session.scalars(select(PlayerExternalId)).all()) == 2


def test_merge_players_failures(player: Player, auth_client: TestClient):
    assert (
        auth_client.post(
            f"/players/{player.id}/merge/", json={"other_id": player.id}
        ).status_code
        == 400
    )
    assert (
        auth_client.post(
            f"/players/{player.id}/merge/", json={"other_id": 9999}
        ).status_code
        == 404
    )


def test_merge_players_requires_auth(player: Player, client: TestClient):
    res = client.post(f"/players/{player.id}/merge/", json={"other_id": 9999})
    assert res.status_code == 401


def test_create_match(
    competition: Competition,
    player_factory: Callable[..., Player],
    session: Session,
    auth_client: TestClient,
):
    player_white = player_factory()
    player_black = player_factory()
    old_updated_at = competition.updated_at
    data = {
        "competition_name": competition.name,
        "player_white_id": player_white.id,
        "player_black_id": player_black.id,
        "round": 1,
        "board": 1,
    }
    res = auth_client.post("/matches/", json=data)
    res.raise_for_status()
    matches = session.scalars(select(Match)).all()
    assert len(matches) == 1
    match_obj = matches[0]
    assert match_obj.competition == competition
    session.refresh(competition)
    assert competition.updated_at > old_updated_at
    assert match_obj.player_white == player_white
    assert match_obj.player_black == player_black
    assert match_obj.round == 1
    assert match_obj.board == 1
    for key in ("created_at", "updated_at"):
        assert key in dict(match_obj)

    player_white = player_factory()
    player_black = player_factory()
    data = {
        "competition_name": competition.name,
        "player_white_id": player_white.id,
        "player_black_id": player_black.id,
        "round": 1,
        "board": 2,
        "result": "1/2-1/2",
    }
    res = auth_client.post("/matches/", json=data)
    res.raise_for_status()
    matches = session.scalars(select(Match)).all()
    assert len(matches) == 2
    match_obj = session.get(Match, res.json()["id"])
    assert match_obj.result == Result.DRAW


def test_get_match(match_obj: Match, client: TestClient):
    res = client.get(f"/matches/{match_obj.id}/")
    res.raise_for_status()
    res_match = res.json()
    res_match.pop("player_white")
    res_match.pop("player_black")
    assert res_match == jsonable_encoder(
        MatchPublic.model_validate(match_obj).model_dump(
            exclude={"player_white", "player_black"}
        )
    )


def test_list_matches(
    competition: Competition, match_factory: Callable[..., Match], client: TestClient
):
    m0, m1 = (
        match_factory(competition=competition),
        match_factory(competition=competition),
    )
    res = client.get("/matches/")
    res.raise_for_status()
    match_objects = res.json()
    for match_obj in match_objects:
        match_obj.pop("player_white")
        match_obj.pop("player_black")
    assert len(match_objects) == 2
    assert (
        jsonable_encoder(
            MatchPublic.model_validate(m0).model_dump(
                exclude={"player_white", "player_black"}
            )
        )
        == match_objects[0]
    )
    assert (
        jsonable_encoder(
            MatchPublic.model_validate(m1).model_dump(
                exclude={"player_white", "player_black"}
            )
        )
        == match_objects[1]
    )


def test_update_match(match_obj: Match, auth_client: TestClient, session: Session):
    assert match_obj.result is None
    competition = match_obj.competition
    old_updated_at = competition.updated_at
    res = auth_client.patch(f"/matches/{match_obj.id}/", json={"result": "1-0"})
    res.raise_for_status()
    session.refresh(match_obj)
    session.refresh(competition)
    assert match_obj.result == Result.WHITE_WIN
    assert competition.updated_at > old_updated_at


def test_delete_match(match_obj: Match, auth_client: TestClient, session: Session):
    competition = match_obj.competition
    old_updated_at = competition.updated_at
    res = auth_client.delete(f"/matches/{match_obj.id}/")
    res.raise_for_status()
    assert len(session.scalars(select(Match)).all()) == 0
    session.refresh(competition)
    assert competition.updated_at > old_updated_at


def test_create_match_unique_constraint(
    match_obj: Match, auth_client: TestClient, session: Session
):
    data = {
        # The following three should be unique together, so we should get an error.
        "competition_name": match_obj.competition.name,
        "round": match_obj.round,
        "board": match_obj.board,
        # The following don't need to be unique together.
        "player_white_id": match_obj.player_white_id,
        "player_black_id": match_obj.player_black_id,
    }
    res = auth_client.post("/matches/", json=data)
    assert res.status_code == 409


def test_update_match_unique_constraint(
    match_factory: Callable[..., Match], auth_client: TestClient, session: Session
):
    match_obj_1 = match_factory()
    match_obj_2 = match_factory(competition=match_obj_1.competition)
    update_data = {
        "round": match_obj_1.round,
        "board": match_obj_1.board,
    }
    res = auth_client.patch(f"/matches/{match_obj_2.id}/", json=update_data)
    assert res.status_code == 409


def test_retrieve_pairing(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    client: TestClient,
    competition_factory: Callable[..., Competition],
    match_factory: Callable[..., Match],
):
    (competition, _, matches) = simkro_setup
    other_competition = competition_factory(name="other")
    other_match = match_factory(competition=other_competition, round=1)
    r1_matches = [m for m in matches if m.round == 1]
    res = client.get(
        f"/competitions/{competition.name}/pairing", params={"round_nr": 1}
    )
    res.raise_for_status()
    res_matches = res.json()
    for m in res_matches:
        assert m["competition_name"] == competition.name
    assert {m["id"] for m in res_matches} == {m.id for m in r1_matches}
    assert other_match.id not in {m["id"] for m in res_matches}


def test_retrieve_pairing_latest(
    simkro_setup: tuple[Competition, list[Player], list[Match]], client: TestClient
):
    (competition, _, matches) = simkro_setup
    latest_round_nr = max(m.round for m in matches)
    latest_round_matches = [m for m in matches if m.round == latest_round_nr]
    res = client.get(f"/competitions/{competition.name}/pairing")
    res.raise_for_status()
    res_matches = res.json()
    for m in res_matches:
        assert m["round"] == latest_round_nr
    assert {m["id"] for m in res_matches} == {m.id for m in latest_round_matches}


def test_create_pairing(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    player_factory: Callable[..., Player],
    competition_factory: Callable[..., Competition],
    match_factory: Callable[..., Match],
    auth_client: TestClient,
):
    (competition, players, matches) = simkro_setup
    players += [player_factory() for _ in range(20)]
    player_ids = [player.id for player in players]
    max_round_nr = max(m.round for m in matches)

    # Create data in other competition to check it does not interfere with current
    # competition.
    other_competition = competition_factory(name="other")
    other_match = match_factory(competition=other_competition, round=max_round_nr + 1)
    match_factory(competition=other_competition, round=max_round_nr + 2)
    # Check only the next round can be created.
    for round_nr in range(1, max_round_nr + 1):
        res = auth_client.post(
            f"/competitions/{competition.name}/pairing",
            json={"round_nr": round_nr, "player_ids": player_ids},
        )
        assert res.status_code == 400
    res = auth_client.post(
        f"/competitions/{competition.name}/pairing",
        json={"round_nr": max_round_nr + 2, "player_ids": player_ids},
    )
    assert res.status_code == 400

    correct_round_nr = max_round_nr + 1
    res = auth_client.post(
        f"/competitions/{competition.name}/pairing",
        json={"round_nr": correct_round_nr, "player_ids": player_ids},
    )
    res.raise_for_status()
    created_matches = res.json()
    assert len(created_matches) == len(player_ids) // 2
    created_player_ids = [m["player_white_id"] for m in created_matches] + [
        m["player_black_id"] for m in created_matches
    ]
    assert set(created_player_ids) == set(player_ids)
    assert {m["board"] for m in created_matches} == set(
        range(1, len(player_ids) // 2 + 1)
    )
    assert other_match.id not in {m["id"] for m in created_matches}


def test_create_pairing_odd_number_of_players(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    auth_client: TestClient,
):
    (competition, players, matches) = simkro_setup
    player_ids = [player.id for player in players][:-1]
    assert len(player_ids) % 2 == 1

    res = auth_client.post(
        f"/competitions/{competition.name}/pairing",
        json={"round_nr": max(m.round for m in matches) + 1, "player_ids": player_ids},
    )
    assert res.status_code == 422
    assert "even" in res.text


def test_create_pairing_no_players(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    auth_client: TestClient,
):
    (competition, _, matches) = simkro_setup

    res = auth_client.post(
        f"/competitions/{competition.name}/pairing",
        json={"round_nr": max(m.round for m in matches) + 1, "player_ids": []},
    )
    assert res.status_code == 422


def test_create_pairing_duplicate_players(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    auth_client: TestClient,
):
    (competition, players, matches) = simkro_setup
    player_ids = [player.id for player in players] + [players[0].id, players[1].id]

    res = auth_client.post(
        f"/competitions/{competition.name}/pairing",
        json={"round_nr": max(m.round for m in matches) + 1, "player_ids": player_ids},
    )
    assert res.status_code == 422
    assert "unique" in res.text


def test_delete_pairing(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    auth_client: TestClient,
    session: Session,
):
    (competition, _, matches) = simkro_setup
    assert len([m for m in matches if m.round == 2]) > 0
    res = auth_client.delete(
        f"/competitions/{competition.name}/pairing", params={"round_nr": 2}
    )
    res.raise_for_status()
    db_matches = session.exec(select(Match)).all()
    for m in matches:
        if m.round == 2:
            assert m not in db_matches
        else:
            assert m in db_matches


def test_competition_ranking(
    simkro_setup: tuple[Competition, list[Player], list[Match]], client: TestClient
):
    competition, players, _ = simkro_setup
    # Without round_nr defaults to latest round (all players).
    res = client.post(f"/competitions/{competition.name}/ranking")
    res.raise_for_status()
    ranking = res.json()
    assert len(ranking) == len(players)

    # Last two players did not play in the first round.
    res = client.post(
        f"/competitions/{competition.name}/ranking", params={"round_nr": 1}
    )
    res.raise_for_status()
    ranking = res.json()
    assert len(ranking) == len(players) - 2


def test_round_registrations_add_remove(
    competition: Competition,
    player_factory: Callable[..., Player],
    auth_client: TestClient,
    session: Session,
):
    p1, p2, p3 = player_factory(), player_factory(), player_factory()
    # Add players.
    res = auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id, p2.id, p3.id]},
    )
    res.raise_for_status()
    assert len(res.json()) == 3

    # Adding duplicate should not create a second entry.
    res = auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id]},
    )
    res.raise_for_status()
    assert len(res.json()) == 3

    # Remove a player.
    res = auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_remove": [p2.id]},
    )
    res.raise_for_status()
    players = res.json()
    assert len(players) == 2
    assert {rp["player"]["id"] for rp in players} == {p1.id, p3.id}

    # Adding a non-existent player should fail.
    res = auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_add": [9999]},
    )
    assert res.status_code == 404


def test_round_registrations_bye(
    competition: Competition,
    player_factory: Callable[..., Player],
    auth_client: TestClient,
):
    p1, p2, p3 = player_factory(), player_factory(), player_factory()
    auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id, p2.id, p3.id]},
    ).raise_for_status()

    # Set bye player.
    res = auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"bye_player_id": p2.id},
    )
    res.raise_for_status()
    players = res.json()
    bye_players = [rp for rp in players if rp["is_bye"]]
    assert len(bye_players) == 1
    assert bye_players[0]["player"]["id"] == p2.id

    # Change bye player.
    res = auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"bye_player_id": p3.id},
    )
    res.raise_for_status()
    players = res.json()
    bye_players = [rp for rp in players if rp["is_bye"]]
    assert len(bye_players) == 1
    assert bye_players[0]["player"]["id"] == p3.id

    # Clear bye.
    res = auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"clear_bye": True},
    )
    res.raise_for_status()
    players = res.json()
    assert all(not rp["is_bye"] for rp in players)


def test_delete_round_registrations(
    competition: Competition,
    player_factory: Callable[..., Player],
    auth_client: TestClient,
    session: Session,
):
    p1, p2 = player_factory(), player_factory()
    auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id, p2.id]},
    ).raise_for_status()

    res = auth_client.delete(
        f"/competitions/{competition.name}/registrations", params={"round_nr": 1}
    )
    res.raise_for_status()
    assert len(session.exec(select(RoundRegistration)).all()) == 0


def test_retrieve_round_registrations(
    competition: Competition,
    player_factory: Callable[..., Player],
    auth_client: TestClient,
):
    p1, p2 = player_factory(), player_factory()
    auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id, p2.id]},
    ).raise_for_status()

    res = auth_client.get(
        f"/competitions/{competition.name}/registrations", params={"round_nr": 1}
    )
    res.raise_for_status()
    players = res.json()
    assert len(players) == 2
    assert {rp["player"]["id"] for rp in players} == {p1.id, p2.id}


CLUB_PAGE_URL = "https://club.test/?page_id=1"
SIGNUP_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/SIGNUPS/pub"


@pytest.fixture
def club_site(monkeypatch: pytest.MonkeyPatch) -> Callable[..., None]:
    """Point the import at a stub club website, to be stocked with names."""
    monkeypatch.setattr(settings, "club_registration_url", CLUB_PAGE_URL)

    def setup(*names: str) -> None:
        respx.get(CLUB_PAGE_URL).respond(
            text=(
                '<html><body><iframe src="https://docs.google.com/spreadsheets'
                '/d/e/SIGNUPS/pubhtml"></iframe></body></html>'
            )
        )
        rows = "\n".join(f"{i},{name}" for i, name in enumerate(names, start=1))
        respx.get(SIGNUP_SHEET_URL).respond(text=f"#,Naam\n{rows}\n")

    return setup


def import_preview(client: TestClient, competition: Competition):
    return client.get(
        f"/competitions/{competition.name}/registrations/import-preview",
        params={"round_nr": 1},
    )


@respx.mock
def test_preview_registration_import(
    competition: Competition,
    player_factory: Callable[..., Player],
    auth_client: TestClient,
    club_site: Callable[..., None],
):
    registered = player_factory(name="Sander Bakker")
    player_factory(name="Marijke de Vries")
    player_factory(name="Wouter Nijhuis")
    auth_client.patch(
        f"/competitions/{competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_add": [registered.id]},
    ).raise_for_status()

    club_site(
        "Sander Bakker",
        "Marijke de Vries",
        "Wouter Nijhuys",
        "Tom Verhoeven afgemeld",
    )
    res = import_preview(auth_client, competition)
    res.raise_for_status()
    preview = res.json()

    assert preview["source_url"] == CLUB_PAGE_URL
    assert preview["scraped_count"] == 4
    assert [(m["player"]["name"], m["approximate"]) for m in preview["matched"]] == [
        ("Sander Bakker", False),
        ("Marijke de Vries", False),
        ("Wouter Nijhuis", True),
    ]
    assert [m["already_registered"] for m in preview["matched"]] == [True, False, False]
    assert preview["unmatched"] == ["Tom Verhoeven afgemeld"]
    assert preview["ambiguous"] == []


@respx.mock
def test_preview_registration_import_reports_ambiguity(
    competition: Competition,
    player_factory: Callable[..., Player],
    auth_client: TestClient,
    club_site: Callable[..., None],
):
    player_factory(name="Lieke van den Bosch")
    player_factory(name="Lieke van der Bosch")

    club_site("Lieke van de Bosch")
    res = import_preview(auth_client, competition)
    res.raise_for_status()
    preview = res.json()

    assert preview["matched"] == []
    assert preview["ambiguous"][0]["scraped_name"] == "Lieke van de Bosch"
    assert {c["name"] for c in preview["ambiguous"][0]["candidates"]} == {
        "Lieke van den Bosch",
        "Lieke van der Bosch",
    }


@respx.mock
def test_preview_registration_import_ignores_inactive_players(
    competition: Competition,
    player_factory: Callable[..., Player],
    auth_client: TestClient,
    club_site: Callable[..., None],
):
    player_factory(name="Sander Bakker", is_active=False)

    club_site("Sander Bakker")
    res = import_preview(auth_client, competition)
    res.raise_for_status()

    assert res.json()["unmatched"] == ["Sander Bakker"]


@respx.mock
def test_preview_registration_import_when_the_site_is_down(
    competition: Competition,
    auth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "club_registration_url", CLUB_PAGE_URL)
    respx.get(CLUB_PAGE_URL).respond(status_code=403)

    assert import_preview(auth_client, competition).status_code == 502


def test_preview_registration_import_requires_a_moderator(
    competition: Competition, client: TestClient
):
    assert import_preview(client, competition).status_code == 401


# ---------------------------------------------------------------------------
# Finishing a competition
# ---------------------------------------------------------------------------


@pytest.fixture
def finished_competition(
    simkro_setup: tuple[Competition, list[Player], list[Match]], session: Session
) -> Competition:
    """The `simkro_setup` competition, frozen."""
    (competition, _, _) = simkro_setup
    competition.is_finished = True
    session.add(competition)
    session.commit()
    session.refresh(competition)
    return competition


def test_competition_is_finished_is_exposed(
    competition: Competition, client: TestClient
):
    res = client.get(f"/competitions/{competition.name}/")
    res.raise_for_status()
    assert res.json()["is_finished"] is False

    res = client.get("/competitions/")
    res.raise_for_status()
    assert res.json()[0]["is_finished"] is False


def test_competition_is_created_open(session: Session, auth_client: TestClient):
    res = auth_client.post(
        "/competitions/",
        json={
            "name": "interne",
            "type": "simkro",
            "rating_type": {"algorithm": "elo"},
            # A competition is always created open, so this is ignored.
            "is_finished": True,
        },
    )
    res.raise_for_status()
    assert res.json()["is_finished"] is False


def test_finish_and_reopen_competition(
    competition: Competition, auth_client: TestClient, session: Session
):
    res = auth_client.patch(
        f"/competitions/{competition.name}/", json={"is_finished": True}
    )
    res.raise_for_status()
    assert res.json()["is_finished"] is True
    session.refresh(competition)
    assert competition.is_finished

    # Renaming is frozen while finished ...
    assert (
        auth_client.patch(
            f"/competitions/{competition.name}/", json={"name": "foo"}
        ).status_code
        == 409
    )

    # ... but reopening is always allowed, and unfreezes the rest.
    res = auth_client.patch(
        f"/competitions/{competition.name}/", json={"is_finished": False}
    )
    res.raise_for_status()
    assert res.json()["is_finished"] is False
    auth_client.patch(
        f"/competitions/{competition.name}/", json={"name": "foo"}
    ).raise_for_status()


def test_finishing_and_renaming_at_once_is_rejected(
    finished_competition: Competition, auth_client: TestClient
):
    res = auth_client.patch(
        f"/competitions/{finished_competition.name}/",
        json={"is_finished": False, "name": "foo"},
    )
    assert res.status_code == 409


def test_finished_competition_rejects_rating_update(
    finished_competition: Competition, auth_client: TestClient
):
    res = auth_client.patch(
        f"/competitions/{finished_competition.name}/rating",
        json={"default_initial_rating": 1500},
    )
    assert res.status_code == 409
    assert "is finished" in res.json()["detail"]


def test_finished_competition_rejects_pairing(
    finished_competition: Competition,
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    auth_client: TestClient,
):
    (_, players, matches) = simkro_setup
    next_round = max(m.round for m in matches) + 1
    res = auth_client.post(
        f"/competitions/{finished_competition.name}/pairing",
        json={"round_nr": next_round, "player_ids": [p.id for p in players]},
    )
    assert res.status_code == 409

    res = auth_client.delete(
        f"/competitions/{finished_competition.name}/pairing", params={"round_nr": 1}
    )
    assert res.status_code == 409


def test_finished_competition_rejects_registration_changes(
    finished_competition: Competition,
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    auth_client: TestClient,
):
    (_, players, _) = simkro_setup
    res = auth_client.patch(
        f"/competitions/{finished_competition.name}/registrations",
        params={"round_nr": 1},
        json={"player_ids_to_add": [players[0].id]},
    )
    assert res.status_code == 409

    res = auth_client.delete(
        f"/competitions/{finished_competition.name}/registrations",
        params={"round_nr": 1},
    )
    assert res.status_code == 409


def test_finished_competition_rejects_match_writes(
    finished_competition: Competition,
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    auth_client: TestClient,
    session: Session,
):
    (_, players, matches) = simkro_setup
    match_obj = matches[0]

    res = auth_client.post(
        "/matches/",
        json={
            "competition_name": finished_competition.name,
            "round": 99,
            "board": 1,
            "player_white_id": players[0].id,
            "player_black_id": players[1].id,
        },
    )
    assert res.status_code == 409

    res = auth_client.patch(f"/matches/{match_obj.id}/", json={"result": "0-1"})
    assert res.status_code == 409

    res = auth_client.delete(f"/matches/{match_obj.id}/")
    assert res.status_code == 409

    session.refresh(match_obj)
    assert match_obj.result == Result.WHITE_WIN


def test_match_cannot_be_moved_into_a_finished_competition(
    finished_competition: Competition,
    competition_factory: Callable[..., Competition],
    match_factory: Callable[..., Match],
    auth_client: TestClient,
    session: Session,
):
    match_obj = match_factory(competition=competition_factory(name="open"))
    res = auth_client.patch(
        f"/matches/{match_obj.id}/",
        json={"competition_name": finished_competition.name},
    )
    assert res.status_code == 409
    session.refresh(match_obj)
    assert match_obj.competition_id != finished_competition.id


def test_finished_competition_can_still_be_deleted(
    finished_competition: Competition, auth_client: TestClient, session: Session
):
    res = auth_client.delete(f"/competitions/{finished_competition.name}/")
    res.raise_for_status()
    assert session.get(Competition, finished_competition.id) is None


def test_finished_competition_ranking_still_renders(
    finished_competition: Competition, auth_client: TestClient
):
    res = auth_client.post(f"/competitions/{finished_competition.name}/ranking")
    res.raise_for_status()
    assert res.json()
