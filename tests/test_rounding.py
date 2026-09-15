import pytest

from backend.rounding import round_half_up


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0.5, 1),
        (1.5, 2),
        (2.5, 3),  # the built-in `round` gives 2 here
        (3.5, 4),
        (1792.5, 1793),  # the built-in `round` gives 1792 here
        (1793.5, 1794),
    ],
)
def test_a_tie_rounds_away_from_zero(value: float, expected: int):
    assert round_half_up(value) == expected


def test_a_negative_tie_rounds_away_from_zero():
    assert round_half_up(-0.5) == -1


@pytest.mark.parametrize("value", [1499.4, 1499.6, 1500.0, -12.3])
def test_values_that_are_not_ties_round_normally(value: float):
    assert round_half_up(value) == pytest.approx(round(value))


def test_matches_javascript_math_round_for_positive_ties():
    # The frontend renders ratings with `Math.round`, which rounds a tie up. The CSV
    # export has to agree with what the browser shows.
    assert [round_half_up(v) for v in (0.5, 1.5, 2.5, 1792.5)] == [1, 2, 3, 1793]
