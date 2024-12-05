from backend.competitions.simkro import (
    calculate_color_saldo,
    calculate_result_score,
    calculate_saldo,
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
