from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models import Competition, Player, RatingType


def test_create_rating_type(session: Session, client: TestClient):
    rating_name = "interne_rating"
    client.post("/rating_types/", json={"name": rating_name})
    rating_types = session.scalars(select(RatingType)).all()
    assert len(rating_types) == 1
    rating_type = rating_types[0]
    assert rating_type.name == rating_name


def test_get_rating_type(rating_type: RatingType, client: TestClient):
    response = client.get(f"/rating_types/{rating_type.name}/")
    response.raise_for_status()
    res_rating_type = response.json()
    assert res_rating_type == jsonable_encoder(rating_type)


def test_list_rating_types(rating_type_factory, client):
    r0, r1 = rating_type_factory(name="r0"), rating_type_factory(name="r1")
    response = client.get("/rating_types/")
    response.raise_for_status()
    rating_types = response.json()
    assert len(rating_types) == 2
    assert jsonable_encoder(r0) == rating_types[0]
    assert jsonable_encoder(r1) == rating_types[1]


def test_update_rating_type(rating_type, client, session):
    new_name = "foo"
    client.patch(f"/rating_types/{rating_type.name}/", json={"name": new_name})
    session.refresh(rating_type)
    assert rating_type.name == new_name


def test_delete_rating_type(rating_type, client, session):
    client.delete(f"/rating_types/{rating_type.name}/")
    assert len(session.scalars(select(RatingType)).all()) == 0


def test_create_competition(session: Session, client: TestClient):
    competition_name = "interne"
    client.post("/competitions/", json={"name": competition_name})
    competition = session.scalars(select(Competition)).all()
    assert len(competition) == 1
    competition = competition[0]
    assert competition.name == competition_name
    for key in {"id", "created_at", "updated_at"}:
        assert key in dict(competition)


def test_get_competition(competition: Competition, client: TestClient):
    response = client.get(f"/competitions/{competition.name}/")
    response.raise_for_status()
    res_competition = response.json()
    # The response gives matches as an emtpy list, the serialized object doesn't include
    # matches in this case.
    assert res_competition.pop("matches") == []
    assert res_competition == jsonable_encoder(competition)


def test_list_competition(competition_factory, client):
    c0, c1 = competition_factory(name="c0"), competition_factory(name="c1")
    response = client.get("/competitions/")
    response.raise_for_status()
    competition = response.json()
    assert len(competition) == 2
    # The response gives matches as an emtpy list, the serialized object doesn't include
    # matches in this case.
    assert competition[0].pop("matches") == []
    assert jsonable_encoder(c0) == competition[0]
    assert competition[1].pop("matches") == []
    assert jsonable_encoder(c1) == competition[1]


def test_update_competition(competition, client, session):
    new_name = "foo"
    client.patch(f"/competitions/{competition.name}/", json={"name": new_name})
    session.refresh(competition)
    assert competition.name == new_name


def test_delete_competition(competition, client, session):
    client.delete(f"/competitions/{competition.name}/")
    assert len(session.scalars(select(Competition)).all()) == 0


def test_create_player(session: Session, client: TestClient):
    player_name = "interne"
    client.post("/players/", json={"name": player_name})
    player = session.scalars(select(Player)).all()
    assert len(player) == 1
    player = player[0]
    assert player.name == player_name
    for key in {"id", "created_at", "updated_at"}:
        assert key in dict(player)


def test_get_player(player: Player, client: TestClient):
    response = client.get(f"/players/{player.id}/")
    response.raise_for_status()
    res_player = response.json()
    assert res_player.pop("ratings") == []
    assert res_player == jsonable_encoder(player)


def test_list_player(player_factory, client):
    p0, p1 = player_factory(), player_factory()
    response = client.get("/players/")
    response.raise_for_status()
    res_players = response.json()
    assert len(res_players) == 2
    assert res_players[0].pop("ratings") == []
    assert jsonable_encoder(p0) == res_players[0]
    assert res_players[1].pop("ratings") == []
    assert jsonable_encoder(p1) == res_players[1]


def test_update_player(player, client, session):
    new_name = "foo"
    client.patch(f"/players/{player.id}/", json={"name": new_name})
    session.refresh(player)
    assert player.name == new_name


def test_delete_player(player, client, session):
    client.delete(f"/players/{player.id}/")
    assert len(session.scalars(select(Player)).all()) == 0
