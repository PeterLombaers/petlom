import pytest

from backend.ratings import calculate_ratings
from backend.ratings.simkro import SimkroRating


def test_single_win_increases_rating():
    ratings = {1: 1500.0, 2: 1500.0}
    matches = [(1, 2, 1.0)]  # player 1 (white) wins
    result = calculate_ratings(ratings, matches, SimkroRating())
    assert result[1] > 1500.0
    assert result[2] < 1500.0


def test_single_loss_decreases_rating():
    ratings = {1: 1500.0, 2: 1500.0}
    matches = [(1, 2, 0.0)]  # player 1 (white) loses
    result = calculate_ratings(ratings, matches, SimkroRating())
    assert result[1] < 1500.0
    assert result[2] > 1500.0


def test_draw_favours_lower_rated():
    ratings = {1: 1600.0, 2: 1400.0}
    matches = [(1, 2, 0.5)]
    result = calculate_ratings(ratings, matches, SimkroRating())
    assert result[1] < 1600.0
    assert result[2] > 1400.0


def test_no_matches_rating_unchanged():
    ratings = {1: 1500.0, 2: 1500.0}
    result = calculate_ratings(ratings, [], SimkroRating())
    assert result == {1: 1500.0, 2: 1500.0}


def test_opponent_not_in_ratings_skips_match():
    # Player 3 has no rating entry; player 1's match against them is ignored.
    ratings = {1: 1500.0}
    matches = [(1, 3, 1.0)]
    result = calculate_ratings(ratings, matches, SimkroRating())
    assert result[1] == 1500.0


def test_player_not_in_ratings_not_in_output():
    ratings = {1: 1500.0}
    matches = [(2, 3, 1.0)]
    result = calculate_ratings(ratings, matches, SimkroRating())
    assert 2 not in result
    assert 3 not in result


def test_multiple_matches_accumulate():
    # Player 1 wins twice against equal opponents; each game contributes the
    # same change, so total is double a single-game win.
    ratings = {1: 1500.0, 2: 1500.0, 3: 1500.0}
    single = calculate_ratings({1: 1500.0, 2: 1500.0}, [(1, 2, 1.0)], SimkroRating())
    multi = calculate_ratings(ratings, [(1, 2, 1.0), (1, 3, 1.0)], SimkroRating())
    single_gain = single[1] - 1500.0
    assert multi[1] == pytest.approx(1500.0 + 2 * single_gain)


def test_sequential_differs_from_non_sequential():
    ratings = {1: 1500.0, 2: 1500.0, 3: 1500.0}
    matches = [(1, 2, 1.0), (1, 3, 1.0)]
    non_seq = calculate_ratings(ratings, matches, SimkroRating(sequential=False))
    seq = calculate_ratings(ratings, matches, SimkroRating(sequential=True))
    # With sequential=True the second game uses the updated rating, changing the outcome.
    assert non_seq[1] != pytest.approx(seq[1])


def test_symmetry_wins_and_losses_cancel_at_equal_rating():
    # Win then loss against same-rated opponent at equal rating should cancel out.
    ratings = {1: 1500.0, 2: 1500.0}
    matches = [(1, 2, 1.0), (2, 1, 1.0)]  # player 1 wins, then player 2 wins
    result = calculate_ratings(ratings, matches, SimkroRating())
    assert result[1] == pytest.approx(1500.0, abs=1e-9)
    assert result[2] == pytest.approx(1500.0, abs=1e-9)
