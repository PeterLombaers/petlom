import pytest

from backend.ratings import calculate_ratings, performance_ratings
from backend.ratings.fide import FideRating
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


def test_player_without_rating_not_in_output():
    ratings = {1: 1500.0, 2: None}
    matches = [(1, 2, 1.0)]
    result = calculate_ratings(ratings, matches, SimkroRating())
    assert 2 not in result


def test_unrated_opponent_leaves_rating_unchanged():
    ratings = {1: 1500.0, 2: None}
    matches = [(1, 2, 1.0)]
    result = calculate_ratings(ratings, matches, SimkroRating())
    assert result[1] == 1500.0


def test_only_rated_opponents_contribute():
    # Player 1 beats a rated and an unrated opponent; only the rated game counts.
    ratings = {1: 1500.0, 2: 1500.0, 3: None}
    single = calculate_ratings({1: 1500.0, 2: 1500.0}, [(1, 2, 1.0)], SimkroRating())
    mixed = calculate_ratings(ratings, [(1, 2, 1.0), (1, 3, 1.0)], SimkroRating())
    assert mixed[1] == pytest.approx(single[1])


def test_simkro_unrated_opponent_gives_no_change():
    assert SimkroRating().calculate_change(1500.0, None, 1.0) == 0.0


def test_fide_unrated_opponent_gives_no_change():
    assert FideRating(k_factor=20).calculate_change(1500.0, None, 1.0) == 0.0


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


# ---------------------------------------------------------------------------
# expected_score
# ---------------------------------------------------------------------------


def test_simkro_expected_score_is_even_at_equal_rating():
    assert SimkroRating().expected_score(1500.0, 1500.0) == 0.5


def test_simkro_expected_score_at_400_points_ahead():
    assert SimkroRating().expected_score(1900.0, 1500.0) == pytest.approx(
        0.909, abs=1e-3
    )


def test_simkro_expected_scores_of_both_players_sum_to_one():
    rating = SimkroRating()
    assert rating.expected_score(1750.0, 1480.0) + rating.expected_score(
        1480.0, 1750.0
    ) == pytest.approx(1.0)


def test_fide_expected_score_comes_from_the_table():
    assert FideRating(k_factor=20).expected_score(2000.0, 2200.0) == 0.24


def test_fide_expected_score_is_flat_beyond_400_points():
    # `get_rating_diff` caps the difference, so the expectancy stops moving. This is
    # why `FideRating` cannot invert it by bisection and overrides `performance_rating`.
    rating = FideRating(k_factor=20)
    assert rating.expected_score(2000.0, 1500.0) == rating.expected_score(
        2000.0, 1600.0
    )


@pytest.mark.parametrize(
    "rating",
    [SimkroRating(k_factor=30), FideRating(k_factor=20)],
    ids=["simkro", "fide"],
)
def test_calculate_change_follows_expected_score(rating):
    # The rating change is the k-factor times the surprise, for both algorithms.
    expected = rating.expected_score(1600.0, 1750.0)
    assert rating.calculate_change(1600.0, 1750.0, 1.0) == pytest.approx(
        rating.k_factor * (1.0 - expected)
    )


# ---------------------------------------------------------------------------
# performance_rating
# ---------------------------------------------------------------------------


def test_performance_rating_inverts_expected_score():
    # The defining property: at the performance rating, the expected score over the
    # whole set of games is exactly the score that was actually made.
    rating = SimkroRating()
    opponents = [1500.0, 1820.0, 1345.0, 2010.0]
    scores = [1.0, 0.5, 1.0, 0.0]
    performance = rating.performance_rating(opponents, scores)
    assert sum(
        rating.expected_score(performance, opponent) for opponent in opponents
    ) == pytest.approx(sum(scores))


def test_performance_rating_is_even_with_an_even_score():
    performance = SimkroRating().performance_rating([1500.0, 1500.0], [1.0, 0.0])
    assert performance == pytest.approx(1500.0)


def test_performance_rating_clamps_a_perfect_score():
    # Ra = 1600, and a perfect score has no finite solution, so it lands on Ra + 800.
    performance = SimkroRating().performance_rating([1500.0, 1700.0], [1.0, 1.0])
    assert performance == pytest.approx(2400.0)


def test_performance_rating_clamps_a_zero_score():
    performance = SimkroRating().performance_rating([1500.0, 1700.0], [0.0, 0.0])
    assert performance == pytest.approx(800.0)


def test_performance_rating_clamps_a_mixed_score_too():
    # Half a point out of 60 against a 1500 field. The exact inverse is about Ra - 830,
    # outside the bracket, so it clamps even though the score is not zero. Guards the
    # bracket against being "optimised" away.
    opponents = [1500.0] * 60
    scores = [0.5] + [0.0] * 59
    assert SimkroRating().performance_rating(opponents, scores) == pytest.approx(700.0)


def test_performance_rating_rises_with_a_better_score():
    rating = SimkroRating()
    opponents = [1500.0, 1600.0, 1700.0]
    worse = rating.performance_rating(opponents, [1.0, 0.0, 0.0])
    better = rating.performance_rating(opponents, [1.0, 1.0, 0.0])
    assert better > worse


def test_performance_rating_ignores_sequential():
    # A performance rating is order independent, unlike the rating change.
    opponents = [1500.0, 1700.0]
    scores = [1.0, 0.0]
    assert SimkroRating(sequential=True).performance_rating(
        opponents, scores
    ) == pytest.approx(
        SimkroRating(sequential=False).performance_rating(opponents, scores)
    )


def test_performance_rating_drops_unrated_opponents():
    rating = SimkroRating()
    assert rating.performance_rating([1500.0, None], [1.0, 0.0]) == pytest.approx(
        rating.performance_rating([1500.0], [1.0])
    )


def test_fide_performance_rating_counts_unrated_opponents_as_1400():
    # Ra = (1600 + 1400) / 2 = 1500, p = 0.50 so dp = 0.
    assert FideRating(k_factor=20).performance_rating(
        [1600.0, None], [1.0, 0.0]
    ) == pytest.approx(1500.0)


def test_fide_performance_rating_uses_the_table():
    # p = 0.75 gives dp = 193 (RR 8.1.1).
    assert FideRating(k_factor=20).performance_rating(
        [1600.0] * 4, [1.0, 1.0, 1.0, 0.0]
    ) == pytest.approx(1793.0)


@pytest.mark.parametrize(
    "rating", [SimkroRating(), FideRating(k_factor=20)], ids=["simkro", "fide"]
)
def test_performance_rating_without_opponents_raises(rating):
    with pytest.raises(ValueError):
        rating.performance_rating([], [])


@pytest.mark.parametrize(
    "rating", [SimkroRating(), FideRating(k_factor=20)], ids=["simkro", "fide"]
)
def test_performance_rating_length_mismatch_raises(rating):
    with pytest.raises(ValueError):
        rating.performance_rating([1500.0, 1600.0], [1.0])


def test_performance_rating_with_only_unrated_opponents_raises():
    with pytest.raises(ValueError):
        SimkroRating().performance_rating([None, None], [1.0, 0.0])


# ---------------------------------------------------------------------------
# performance_ratings (all players at once)
# ---------------------------------------------------------------------------


def test_performance_ratings_omits_a_player_without_matches():
    ratings = {1: 1500.0, 2: 1500.0, 3: 1500.0}
    matches = [(1, 2, 1.0)]
    result = performance_ratings(ratings, matches, SimkroRating())
    assert 3 not in result
    assert result[1] == pytest.approx(2300.0)  # Ra 1500, perfect score, clamped


def test_performance_ratings_includes_a_player_without_a_rating():
    # Unlike `calculate_ratings`, a player needs no rating of their own: the performance
    # follows from the opponents and the scores.
    ratings = {1: None, 2: 1600.0}
    matches = [(1, 2, 1.0)]
    result = performance_ratings(ratings, matches, SimkroRating())
    assert result[1] == pytest.approx(2400.0)
    assert 1 not in calculate_ratings(ratings, matches, SimkroRating())


def test_performance_ratings_are_order_independent():
    ratings = {1: 1500.0, 2: 1500.0, 3: 1500.0}
    matches = [(1, 2, 1.0), (1, 3, 0.0)]
    sequential = performance_ratings(ratings, matches, SimkroRating(sequential=True))
    flat = performance_ratings(ratings, matches, SimkroRating(sequential=False))
    assert sequential == pytest.approx(flat)
