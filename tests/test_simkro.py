from collections.abc import Callable

from backend.competitions.simkro import (
    calculate_attendance_score,
    calculate_color_saldo,
    calculate_games_since_last_played,
    calculate_opponent_saldo,
    calculate_point_total,
    calculate_result_score,
    calculate_saldo,
    played_in_turnus_pairs,
)
from backend.models import Competition, Match, Player


def test_calculate_saldo(simkro_setup: tuple[Competition, list[Player], list[Match]]):
    (_, players, matches) = simkro_setup
    correct_saldos = [
        [1, -1, 0, 0, -1, 1, 0, 0],
        [1, -2, -1, 1, 0, 1, 1, -1],
        [0, -2, -1, 1, 0, 1, 2, -1],
        [1, -2, -1, 1, -1, 0, 3, -1],
    ]
    for round_nr in range(1, 5):
        round_matches = [m for m in matches if m.round <= round_nr]
        calculated_saldo = calculate_saldo(round_matches)
        for player, correct_saldo in zip(players, correct_saldos[round_nr - 1]):
            assert calculated_saldo[player] == correct_saldo


def test_calculate_color_saldo(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
):
    (_, players, matches) = simkro_setup
    correct_color_saldos = [
        [1, -1, 1, -1, 1, -1, 0, 0],
        [2, 0, 2, 0, 0, -2, -1, -1],
        [1, 0, 1, 0, 0, -2, 0, 0],
        [0, -1, 2, 1, 1, -1, -1, -1],
    ]
    for round_nr in range(1, 5):
        round_matches = [m for m in matches if m.round <= round_nr]
        calculated_color_saldos = calculate_color_saldo(round_matches)
        for player, correct_saldo in zip(players, correct_color_saldos[round_nr - 1]):
            assert calculated_color_saldos[player] == correct_saldo


def test_calculate_result_score(
    simkro_setup: tuple[Competition, list[Player], list[Match]],
):
    (_, players, matches) = simkro_setup
    correct_result_scores = [12, -12, 0, 0, -12, 12, 0, 0]
    round_matches = [m for m in matches if m.round <= 1]
    calculated_result_scores = calculate_result_score(round_matches)
    for player, correct_saldo in zip(players, correct_result_scores):
        assert calculated_result_scores[player] == correct_saldo

    # Check we get diminished returns after round 20.
    matches = [matches[0] for _ in range(21)]
    assert calculate_result_score(matches) == {players[0]: 246, players[1]: -246}


def test_attendance_score(simkro_setup: tuple[Competition, list[Player], list[Match]]):
    (_, players, matches) = simkro_setup
    correct_attendance_scores = [
        [3, 3, 3, 3, 3, 3, 0, 0],
        [6, 6, 6, 6, 6, 6, 3, 3],
        [9, 6, 9, 6, 6, 6, 6, 6],
        [12, 9, 12, 9, 9, 9, 9],
    ]
    for round_nr in range(1, 5):
        round_matches = [m for m in matches if m.round <= round_nr]
        calculated_attendance_scores = calculate_attendance_score(round_matches)
        for player, correct_score in zip(
            players, correct_attendance_scores[round_nr - 1]
        ):
            assert calculated_attendance_scores[player] == correct_score

    # Check no points get added after round 20.
    matches = [matches[0] for _ in range(21)]
    assert calculate_attendance_score(matches) == {players[0]: 60, players[1]: 60}


def test_opponent_saldo(simkro_setup: tuple[Competition, list[Player], list[Match]]):
    (_, players, matches) = simkro_setup
    correct_opponent_saldos = [
        [-1, 1, 0, 0, 1, -1, 0, 0],
        [-1, 1, 2, -2, -1, 1, -1, 1],
        [1, 0, 2, -2, -1, 0, -1, 0],
        [0, -1, 1, -3, -1, 3, 0, 1],
    ]
    for round_nr in range(1, 5):
        round_matches = [m for m in matches if m.round <= round_nr]
        calculated_opponent_saldos = calculate_opponent_saldo(round_matches)
        for player, correct_saldo in zip(
            players, correct_opponent_saldos[round_nr - 1]
        ):
            assert calculated_opponent_saldos[player] == correct_saldo

    # Check the maximum and minimum are capped.
    matches = [matches[0] for _ in range(7)]
    assert calculate_opponent_saldo(matches) == {players[0]: -42, players[1]: 42}


def test_point_total(
    simkro_setup: tuple[Competition, list[Player], list[Match]], player: Player
):
    (_, players, matches) = simkro_setup
    # Allow using `player` as a variable below without overwriting the player fixture.
    other_player = player
    correct_point_totals = [
        [514, 492, 503, 503, 492, 514, 500, 500],
        [517, 483, 496, 516, 505, 519, 514, 492],
        [510, 482, 499, 516, 505, 518, 529, 494],
        [524, 484, 501, 518, 496, 512, 545, 498],
    ]
    for round_nr in range(1, 5):
        round_matches = [m for m in matches if m.round <= round_nr]
        calculated_point_totals = calculate_point_total(round_matches)
        for player, correct_total in zip(players, correct_point_totals[round_nr - 1]):
            assert calculated_point_totals[player] == correct_total

    # Check the defaultdict has default value 500.
    assert calculated_point_totals[other_player] == 500


def test_played_in_turnus_pairs(match_obj: Match):
    player_pair = frozenset((match_obj.player_white, match_obj.player_black))
    match_obj.round = 1
    assert player_pair in played_in_turnus_pairs([match_obj], 2)
    assert player_pair not in played_in_turnus_pairs([match_obj], 11)
    match_obj.round = 11
    assert player_pair not in played_in_turnus_pairs([match_obj], 10)
    assert player_pair in played_in_turnus_pairs([match_obj], 20)
    assert player_pair not in played_in_turnus_pairs([match_obj], 21)
    match_obj.round = 25
    assert player_pair not in played_in_turnus_pairs([match_obj], 20)
    assert player_pair in played_in_turnus_pairs([match_obj], 21)
    assert player_pair in played_in_turnus_pairs([match_obj], 30)


def test_games_since_last_played(
    competition: Competition,
    player_factory: Callable[..., Player],
    match_factory: Callable[..., Match],
):
    # A match factory that always uses the same competition.
    def match_factory_comp(**kwargs):
        return match_factory(competition=competition, **kwargs)

    players = [player_factory() for _ in range(6)]
    matches = [
        match_factory_comp(player_white=players[0], player_black=players[1], round=1),
        match_factory_comp(player_white=players[0], player_black=players[2], round=2),
        match_factory_comp(player_white=players[0], player_black=players[3], round=3),
        match_factory_comp(player_white=players[0], player_black=players[4], round=4),
        match_factory_comp(player_white=players[0], player_black=players[1], round=5),
        match_factory_comp(player_white=players[0], player_black=players[1], round=6),
        match_factory_comp(player_white=players[0], player_black=players[5], round=7),
        match_factory_comp(player_white=players[0], player_black=players[3], round=8),
        match_factory_comp(player_white=players[0], player_black=players[4], round=9),
        match_factory_comp(player_white=players[0], player_black=players[2], round=10),
    ]
    correct_n_games = [
        [4, 4, 4, 4, 4],
        [0, 4, 4, 4, 4],
        [1, 0, 4, 4, 4],
        [2, 1, 0, 4, 4],
        [3, 2, 1, 0, 4],
        [0, 3, 2, 1, 4],
        [0, 4, 3, 2, 4],
        [1, 4, 4, 3, 0],
        [2, 4, 0, 4, 1],
        [3, 4, 1, 0, 2],
        [4, 0, 2, 1, 3],
    ]
    for round_nr in range(11):
        print(round_nr)
        games_since_last_played = calculate_games_since_last_played(matches[:round_nr])[
            players[0]
        ]
        correct_output = correct_n_games[round_nr]
        for i in range(5):
            assert games_since_last_played[players[i + 1]] == correct_output[i]
