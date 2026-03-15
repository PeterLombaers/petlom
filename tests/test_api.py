from typing import Callable
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.competitions import CompetitionType
from backend.models import (
    Competition,
    Match,
    Player,
    PlayerRating,
    RatingType,
    Result,
    RoundPlayer,
)


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
    assert res_competition.pop("n_rounds") == 0
    # The response gives matches as an emtpy list, the serialized object doesn't include
    # matches in this case.
    assert res_competition == jsonable_encoder(competition)


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
    # The response gives matches as an emtpy list, the serialized object doesn't include
    # matches in this case.
    assert jsonable_encoder(c0) == competition[0]
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


def test_create_player_empty_name_fail(client: TestClient):
    res = client.post("/players/", json={"name": ""})
    assert res.status_code == 422
    res = client.post("/players/", json={"name": " "})
    assert res.status_code == 422


def test_get_player(player: Player, client: TestClient):
    res = client.get(f"/players/{player.id}/")
    res.raise_for_status()
    res_player = res.json()
    assert res_player.pop("ratings") == []
    assert res_player == jsonable_encoder(player)


def test_list_player(player_factory: Callable[..., Player], client):
    p0, p1 = player_factory(), player_factory()
    res = client.get("/players/")
    res.raise_for_status()
    res_players = res.json()
    assert len(res_players) == 2
    assert res_players[0].pop("ratings") == []
    assert jsonable_encoder(p0) == res_players[0]
    assert res_players[1].pop("ratings") == []
    assert jsonable_encoder(p1) == res_players[1]

    player_factory(is_active=False)
    res = client.get("/players/")
    res.raise_for_status()
    res_players = res.json()
    assert len(res_players) == 3

    res = client.get("/players/", params={"is_active": True})
    res.raise_for_status()
    res_players = res.json()
    assert len(res_players) == 2


def test_update_player(player, client, session):
    new_name = "foo"
    res = client.patch(f"/players/{player.id}/", json={"name": new_name})
    res.raise_for_status()
    session.refresh(player)
    assert player.name == new_name
    assert player.is_active


def test_update_player_empty_name_fail(player, client):
    res = client.patch(f"/players/{player.id}/", json={"name": ""})
    assert res.status_code == 422
    res = client.patch(f"/players/{player.id}/", json={"name": " \n"})
    assert res.status_code == 422


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


def test_delete_player_is_active_false(
    player: Player, client: TestClient, session: Session, match_factory
):
    match_factory(player_white=player, player_black=player)
    assert player.is_active
    res = client.delete(f"/players/{player.id}/")
    res.raise_for_status()
    session.refresh(player)
    assert not player.is_active


def test_create_match(
    competition: Competition,
    player_factory: Callable[..., Player],
    session: Session,
    client: TestClient,
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
    res = client.post("/matches/", json=data)
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
    res_match.pop("player_white")
    res_match.pop("player_black")
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
    match_objects = res.json()
    for match_obj in match_objects:
        match_obj.pop("player_white")
        match_obj.pop("player_black")
    assert len(match_objects) == 2
    assert jsonable_encoder(m0) == match_objects[0]
    assert jsonable_encoder(m1) == match_objects[1]


def test_update_match(match_obj: Match, client: TestClient, session: Session):
    assert match_obj.result is None
    competition = match_obj.competition
    old_updated_at = competition.updated_at
    res = client.patch(f"/matches/{match_obj.id}/", json={"result": "1-0"})
    res.raise_for_status()
    session.refresh(match_obj)
    session.refresh(competition)
    assert match_obj.result == Result.WHITE_WIN
    assert competition.updated_at > old_updated_at


def test_delete_match(match_obj: Match, client: TestClient, session: Session):
    competition = match_obj.competition
    old_updated_at = competition.updated_at
    res = client.delete(f"/matches/{match_obj.id}/")
    res.raise_for_status()
    assert len(session.scalars(select(Match)).all()) == 0
    session.refresh(competition)
    assert competition.updated_at > old_updated_at


def test_create_match_unique_constraint(
    match_obj: Match, client: TestClient, session: Session
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
    res = client.post("/matches/", json=data)
    assert res.status_code == 400


def test_update_match_unique_constraint(
    match_factory: Callable[..., Match], client: TestClient, session: Session
):
    match_obj_1 = match_factory()
    match_obj_2 = match_factory(competition=match_obj_1.competition)
    update_data = {
        "round": match_obj_1.round,
        "board": match_obj_1.board,
    }
    res = client.patch(f"/matches/{match_obj_2.id}/", json=update_data)
    assert res.status_code == 400


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
    assert set(m["id"] for m in res_matches) == set(m.id for m in r1_matches)
    assert other_match.id not in set(m["id"] for m in res_matches)


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
    assert set(m["id"] for m in res_matches) == set(m.id for m in latest_round_matches)


def test_create_pairing(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    player_factory: Callable[..., Player],
    competition_factory: Callable[..., Competition],
    match_factory: Callable[..., Match],
    client: TestClient,
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
        res = client.post(
            f"/competitions/{competition.name}/pairing",
            json={"round_nr": round_nr, "player_ids": player_ids},
        )
        assert res.status_code == 400
    res = client.post(
        f"/competitions/{competition.name}/pairing",
        json={"round_nr": max_round_nr + 2, "player_ids": player_ids},
    )
    assert res.status_code == 400

    correct_round_nr = max_round_nr + 1
    res = client.post(
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
    assert set(m["board"] for m in created_matches) == set(
        range(1, len(player_ids) // 2 + 1)
    )
    assert other_match.id not in set(m["id"] for m in created_matches)


def test_delete_pairing(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    client: TestClient,
    session: Session,
):
    (competition, _, matches) = simkro_setup
    assert len(list(m for m in matches if m.round == 2)) > 0
    res = client.delete(
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
    res = client.get(f"/competitions/{competition.name}/ranking")
    res.raise_for_status()
    ranking = res.json()
    assert len(ranking) == len(players)

    # Last two players did not play in the first round.
    res = client.get(
        f"/competitions/{competition.name}/ranking", params={"round_nr": 1}
    )
    res.raise_for_status()
    ranking = res.json()
    assert len(ranking) == len(players) - 2


def test_create_round_players(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
    client: TestClient,
):
    competition, _, _ = simkro_setup
    # Creating for a round that already has matches should fail.
    res = client.post(
        f"/competitions/{competition.name}/players", params={"round_nr": 1}
    )
    assert res.status_code == 400

    # Creating for the next round (no matches yet) should succeed.
    res = client.post(
        f"/competitions/{competition.name}/players", params={"round_nr": 5}
    )
    res.raise_for_status()
    assert res.json() == []


def test_round_players_add_remove(
    competition: Competition,
    player_factory: Callable[..., Player],
    client: TestClient,
    session: Session,
):
    p1, p2, p3 = player_factory(), player_factory(), player_factory()
    # Create the round player list.
    client.post(
        f"/competitions/{competition.name}/players", params={"round_nr": 1}
    ).raise_for_status()

    # Add players.
    res = client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id, p2.id, p3.id]},
    )
    res.raise_for_status()
    assert len(res.json()) == 3

    # Adding duplicate should not create a second entry.
    res = client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id]},
    )
    res.raise_for_status()
    assert len(res.json()) == 3

    # Remove a player.
    res = client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"player_ids_to_remove": [p2.id]},
    )
    res.raise_for_status()
    players = res.json()
    assert len(players) == 2
    assert set(rp["player"]["id"] for rp in players) == {p1.id, p3.id}

    # Adding a non-existent player should fail.
    res = client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"player_ids_to_add": [9999]},
    )
    assert res.status_code == 404


def test_round_players_bye(
    competition: Competition,
    player_factory: Callable[..., Player],
    client: TestClient,
):
    p1, p2, p3 = player_factory(), player_factory(), player_factory()
    client.post(
        f"/competitions/{competition.name}/players", params={"round_nr": 1}
    ).raise_for_status()
    client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id, p2.id, p3.id]},
    ).raise_for_status()

    # Set bye player.
    res = client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"bye_player_id": p2.id},
    )
    res.raise_for_status()
    players = res.json()
    bye_players = [rp for rp in players if rp["is_bye"]]
    assert len(bye_players) == 1
    assert bye_players[0]["player"]["id"] == p2.id

    # Change bye player.
    res = client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"bye_player_id": p3.id},
    )
    res.raise_for_status()
    players = res.json()
    bye_players = [rp for rp in players if rp["is_bye"]]
    assert len(bye_players) == 1
    assert bye_players[0]["player"]["id"] == p3.id

    # Clear bye.
    res = client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"clear_bye": True},
    )
    res.raise_for_status()
    players = res.json()
    assert all(not rp["is_bye"] for rp in players)


def test_delete_round_players(
    competition: Competition,
    player_factory: Callable[..., Player],
    client: TestClient,
    session: Session,
):
    p1, p2 = player_factory(), player_factory()
    client.post(
        f"/competitions/{competition.name}/players", params={"round_nr": 1}
    ).raise_for_status()
    client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id, p2.id]},
    ).raise_for_status()

    res = client.delete(
        f"/competitions/{competition.name}/players", params={"round_nr": 1}
    )
    res.raise_for_status()
    assert len(session.exec(select(RoundPlayer)).all()) == 0


def test_retrieve_round_players(
    competition: Competition,
    player_factory: Callable[..., Player],
    client: TestClient,
):
    p1, p2 = player_factory(), player_factory()
    client.post(
        f"/competitions/{competition.name}/players", params={"round_nr": 1}
    ).raise_for_status()
    client.patch(
        f"/competitions/{competition.name}/players",
        params={"round_nr": 1},
        json={"player_ids_to_add": [p1.id, p2.id]},
    ).raise_for_status()

    res = client.get(
        f"/competitions/{competition.name}/players", params={"round_nr": 1}
    )
    res.raise_for_status()
    players = res.json()
    assert len(players) == 2
    assert set(rp["player"]["id"] for rp in players) == {p1.id, p2.id}
