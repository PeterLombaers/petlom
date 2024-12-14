from typing import Callable
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.competitions import CompetitionType
from backend.models import Competition, Match, Player, PlayerRating, RatingType, Result


def test_create_rating_type(session: Session, client: TestClient):
    rating_name = "interne_rating"
    res = client.post("/rating_types/", json={"name": rating_name})
    res.raise_for_status()
    rating_types = session.scalars(select(RatingType)).all()
    assert len(rating_types) == 1
    rating_type = rating_types[0]
    assert rating_type.name == rating_name


def test_get_rating_type(rating_type: RatingType, client: TestClient):
    res = client.get(f"/rating_types/{rating_type.name}/")
    res.raise_for_status()
    res_rating_type = res.json()
    assert res_rating_type == jsonable_encoder(rating_type)


def test_list_rating_types(rating_type_factory, client: TestClient):
    r0, r1 = rating_type_factory(name="r0"), rating_type_factory(name="r1")
    res = client.get("/rating_types/")
    res.raise_for_status()
    rating_types = res.json()
    assert len(rating_types) == 2
    assert jsonable_encoder(r0) == rating_types[0]
    assert jsonable_encoder(r1) == rating_types[1]


def test_update_rating_type(
    rating_type: RatingType, client: TestClient, session: Session
):
    new_name = "foo"
    res = client.patch(f"/rating_types/{rating_type.name}/", json={"name": new_name})
    res.raise_for_status()
    session.refresh(rating_type)
    assert rating_type.name == new_name


def test_delete_rating_type(
    rating_type: RatingType, client: TestClient, session: Session
):
    res = client.delete(f"/rating_types/{rating_type.name}/")
    res.raise_for_status()
    assert len(session.scalars(select(RatingType)).all()) == 0


def test_delete_rating_type_cascade_ratings(
    rating_type: RatingType, player: Player, client: TestClient, session: Session
):
    rating_type.ratings.append(
        PlayerRating(player=player, rating_type=rating_type, rating=2000)
    )
    session.add(rating_type)
    session.commit()
    all_ratings = session.scalars(select(PlayerRating)).all()
    assert len(all_ratings) == 1
    res = client.delete(f"/rating_types/{rating_type.name}/")
    res.raise_for_status()
    all_ratings = session.scalars(select(PlayerRating)).all()
    assert len(all_ratings) == 0


def test_create_competition(session: Session, client: TestClient):
    competition_name = "interne"
    res = client.post(
        "/competitions/", json={"name": competition_name, "type": "simkro"}
    )
    res.raise_for_status()
    competition = session.scalars(select(Competition)).all()
    assert len(competition) == 1
    competition = competition[0]
    assert competition.name == competition_name
    assert competition.type == CompetitionType.SIMKRO
    for key in {"created_at", "updated_at"}:
        assert key in dict(competition)


def test_get_competition(competition: Competition, client: TestClient):
    res = client.get(f"/competitions/{competition.name}/")
    res.raise_for_status()
    res_competition = res.json()
    # The response gives matches as an emtpy list, the serialized object doesn't include
    # matches in this case.
    assert res_competition.pop("matches") == []
    assert res_competition == jsonable_encoder(competition)


def test_list_competition(competition_factory, client):
    c0, c1 = competition_factory(name="c0"), competition_factory(name="c1")
    res = client.get("/competitions/")
    res.raise_for_status()
    competition = res.json()
    assert len(competition) == 2
    # The response gives matches as an emtpy list, the serialized object doesn't include
    # matches in this case.
    assert competition[0].pop("matches") == []
    assert jsonable_encoder(c0) == competition[0]
    assert competition[1].pop("matches") == []
    assert jsonable_encoder(c1) == competition[1]


def test_update_competition(competition, client, session):
    new_name = "foo"
    res = client.patch(f"/competitions/{competition.name}/", json={"name": new_name})
    res.raise_for_status()
    session.refresh(competition)
    assert competition.name == new_name


def test_delete_competition(competition, client, session):
    res = client.delete(f"/competitions/{competition.name}/")
    res.raise_for_status()
    assert len(session.scalars(select(Competition)).all()) == 0


def test_delete_competition_cascade_matches(
    competition: Competition,
    match_factory: Callable[..., Match],
    client: TestClient,
    session: Session,
):
    match_factory(competition=competition)
    res = client.delete(f"/competitions/{competition.name}/")
    res.raise_for_status()
    matches = session.scalars(select(Match)).all()
    assert len(matches) == 0


def test_create_player(session: Session, client: TestClient):
    player_name = "Peter"
    res = client.post("/players/", json={"name": player_name})
    res.raise_for_status()
    players = session.scalars(select(Player)).all()
    assert len(players) == 1
    player = players[0]
    assert player.name == player_name
    for key in {"id", "created_at", "updated_at"}:
        assert key in dict(player)


def test_create_player_with_rating(
    rating_type: RatingType, session: Session, client: TestClient
):
    data = {
        "name": "Peter",
        "ratings": [
            {
                "rating_type_name": rating_type.name,
                "rating": 2300,
            }
        ],
    }
    res = client.post("/players/", json=data)
    res.raise_for_status()
    players = session.scalars(select(Player)).all()
    assert len(players) == 1
    player = players[0]
    assert player.name == data["name"]
    for key in {"id", "created_at", "updated_at"}:
        assert key in dict(player)
    assert player.ratings[0].rating_type_name == rating_type.name
    assert player.ratings[0].rating == 2300


def test_get_player(player: Player, client: TestClient):
    res = client.get(f"/players/{player.id}/")
    res.raise_for_status()
    res_player = res.json()
    assert res_player.pop("ratings") == []
    assert res_player == jsonable_encoder(player)


def test_list_player(player_factory, client):
    p0, p1 = player_factory(), player_factory()
    res = client.get("/players/")
    res.raise_for_status()
    res_players = res.json()
    assert len(res_players) == 2
    assert res_players[0].pop("ratings") == []
    assert jsonable_encoder(p0) == res_players[0]
    assert res_players[1].pop("ratings") == []
    assert jsonable_encoder(p1) == res_players[1]


def test_update_player(player, client, session):
    new_name = "foo"
    res = client.patch(f"/players/{player.id}/", json={"name": new_name})
    res.raise_for_status()
    session.refresh(player)
    assert player.name == new_name


def test_update_player_with_rating(
    player: Player, rating_type: RatingType, client: TestClient, session: Session
):
    data = {
        "name": "foo",
        "ratings": [
            {
                "rating_type_name": rating_type.name,
                "rating": 2300,
            }
        ],
    }
    res = client.patch(f"/players/{player.id}/", json=data)
    res.raise_for_status()
    session.refresh(player)
    assert player.name == data["name"]
    assert player.ratings[0].rating_type_name == rating_type.name
    assert player.ratings[0].rating == 2300


def test_delete_player(player: Player, client: TestClient, session: Session):
    res = client.delete(f"/players/{player.id}/")
    res.raise_for_status()
    assert len(session.scalars(select(Player)).all()) == 0


def test_delete_player_cascade_ratings(
    player: Player, rating_type: RatingType, client: TestClient, session: Session
):
    player.ratings = [PlayerRating(rating_type=rating_type, player=player, rating=2000)]
    session.add(player)
    session.commit()
    all_ratings = session.scalars(select(PlayerRating)).all()
    assert len(all_ratings) == 1
    res = client.delete(f"/players/{player.id}/")
    res.raise_for_status()
    all_ratings = session.scalars(select(PlayerRating)).all()
    assert len(all_ratings) == 0


def test_create_match(
    competition: Competition,
    player_factory: Callable[..., Player],
    session: Session,
    client: TestClient,
):
    player_white = player_factory()
    player_black = player_factory()
    data = {
        "competition_name": competition.name,
        "player_white_id": player_white.id,
        "player_black_id": player_black.id,
        "round": 1,
        "board": 1,
    }
    res = client.post("/matches/", json=data)
    res.raise_for_status()
    matches = session.scalars(select(Match)).all()
    assert len(matches) == 1
    match_obj = matches[0]
    assert match_obj.competition == competition
    assert match_obj.player_white == player_white
    assert match_obj.player_black == player_black
    assert match_obj.round == 1
    assert match_obj.board == 1
    for key in {"created_at", "updated_at"}:
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
    res = client.post("/matches/", json=data)
    res.raise_for_status()
    matches = session.scalars(select(Match)).all()
    assert len(matches) == 2
    match_obj = session.get(Match, res.json()["id"])
    assert match_obj.result == Result.DRAW


def test_get_match(match_obj: Match, client: TestClient):
    res = client.get(f"/matches/{match_obj.id}/")
    res.raise_for_status()
    res_match = res.json()
    assert res_match == jsonable_encoder(match_obj)


def test_list_matches(
    competition: Competition, match_factory: Callable[..., Match], client: TestClient
):
    m0, m1 = (
        match_factory(competition=competition),
        match_factory(competition=competition),
    )
    res = client.get("/matches/")
    res.raise_for_status()
    match_obj = res.json()
    assert len(match_obj) == 2
    assert jsonable_encoder(m0) == match_obj[0]
    assert jsonable_encoder(m1) == match_obj[1]


def test_update_match(match_obj: Match, client: TestClient, session: Session):
    assert match_obj.result is None
    res = client.patch(f"/matches/{match_obj.id}/", json={"result": "1-0"})
    res.raise_for_status()
    session.refresh(match_obj)
    assert match_obj.result == Result.WHITE_WIN


def test_delete_match(match_obj: Match, client: TestClient, session: Session):
    res = client.delete(f"/matches/{match_obj.id}/")
    res.raise_for_status()
    assert len(session.scalars(select(Match)).all()) == 0


def test_retrieve_competition_round(
    simkro_setup: tuple[Competition, list[Player], list[Match]], client: TestClient
):
    (competition, _, matches) = simkro_setup
    r1_matches = [m for m in matches if m.round == 1]
    res = client.get(f"/competitions/{competition.name}/round/1")
    res.raise_for_status()
    assert set(m["id"] for m in res.json()) == set(m.id for m in r1_matches)
