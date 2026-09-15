"""Rounding that follows the chess convention rather than Python's default.

Python's built-in `round` breaks a tie towards the nearest even digit ("banker's
rounding"), so `round(0.5)` is 0 and `round(1792.5)` is 1792. Chess ratings break a tie
upwards: FIDE says so explicitly for the rating change (rating
regulations 8.3.4), and the frontend rounds with JavaScript's `Math.round`, which does
the same. A rating shown in the browser and the same rating in a CSV export have to
agree, so everything user facing rounds through here.
"""

from decimal import ROUND_HALF_UP, Decimal


def round_half_up(value: float) -> int:
    """Round to the nearest whole number, breaking a tie away from zero.

    Parameters
    ----------
    value : float
        The number to round.

    Returns
    -------
    int
        `value` rounded to a whole number. A value exactly halfway between two whole
        numbers rounds to the one further from zero, where the built-in `round` would
        pick the even one.

    Examples
    --------
    >>> round_half_up(1792.5)
    1793
    >>> round(1792.5)  # what the built-in does with the same number
    1792
    >>> round_half_up(0.5), round_half_up(1.5), round_half_up(2.5)
    (1, 2, 3)
    >>> round_half_up(-0.5)
    -1
    """
    return int(Decimal(value).quantize(Decimal(1), rounding=ROUND_HALF_UP))
