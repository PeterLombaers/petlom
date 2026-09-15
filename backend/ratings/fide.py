"""See rating regulations (RR) https://handbook.fide.com/chapter/B022024 and
title regulations (TR) https://handbook.fide.com/chapter/B012024"""

from decimal import ROUND_HALF_UP, Decimal

from backend.ratings.base import BaseRating
from backend.rounding import round_half_up

# RR Section 8.1.1: Fractional score (p) to rating difference (dp)
SCORE_TO_RATING_DIFF = {
    1.00: 800,
    0.99: 677,
    0.98: 589,
    0.97: 538,
    0.96: 501,
    0.95: 470,
    0.94: 444,
    0.93: 422,
    0.92: 401,
    0.91: 383,
    0.90: 366,
    0.89: 351,
    0.88: 336,
    0.87: 322,
    0.86: 309,
    0.85: 296,
    0.84: 284,
    0.83: 273,
    0.82: 262,
    0.81: 251,
    0.80: 240,
    0.79: 230,
    0.78: 220,
    0.77: 211,
    0.76: 202,
    0.75: 193,
    0.74: 184,
    0.73: 175,
    0.72: 166,
    0.71: 158,
    0.70: 149,
    0.69: 141,
    0.68: 133,
    0.67: 125,
    0.66: 117,
    0.65: 110,
    0.64: 102,
    0.63: 95,
    0.62: 87,
    0.61: 80,
    0.60: 72,
    0.59: 65,
    0.58: 57,
    0.57: 50,
    0.56: 43,
    0.55: 36,
    0.54: 29,
    0.53: 21,
    0.52: 14,
    0.51: 7,
    0.50: 0,
    0.49: -7,
    0.48: -14,
    0.47: -21,
    0.46: -29,
    0.45: -36,
    0.44: -43,
    0.43: -50,
    0.42: -57,
    0.41: -65,
    0.40: -72,
    0.39: -80,
    0.38: -87,
    0.37: -95,
    0.36: -102,
    0.35: -110,
    0.34: -117,
    0.33: -125,
    0.32: -133,
    0.31: -141,
    0.30: -149,
    0.29: -158,
    0.28: -166,
    0.27: -175,
    0.26: -184,
    0.25: -193,
    0.24: -202,
    0.23: -211,
    0.22: -220,
    0.21: -230,
    0.20: -240,
    0.19: -251,
    0.18: -262,
    0.17: -273,
    0.16: -284,
    0.15: -296,
    0.14: -309,
    0.13: -322,
    0.12: -336,
    0.11: -351,
    0.10: -366,
    0.09: -383,
    0.08: -401,
    0.07: -422,
    0.06: -444,
    0.05: -470,
    0.04: -501,
    0.03: -538,
    0.02: -589,
    0.01: -677,
    0.00: -800,
}

# TR Section 1.4.6d: Unrated opponents count for 1400 in performance rating
# calculations.
UNRATED_PERFORMANCE_VALUE = 1400

# Section 8.1.2: Rating difference (D) to scoring probability (PD)
# Keys are (lower_bound, upper_bound) tuples for the rating difference range.
# Values are higher-rated player win probabilities.
RATING_DIFF_TO_PROB = {
    (0, 3): 0.50,
    (4, 10): 0.51,
    (11, 17): 0.52,
    (18, 25): 0.53,
    (26, 32): 0.54,
    (33, 39): 0.55,
    (40, 46): 0.56,
    (47, 53): 0.57,
    (54, 61): 0.58,
    (62, 68): 0.59,
    (69, 76): 0.60,
    (77, 83): 0.61,
    (84, 91): 0.62,
    (92, 98): 0.63,
    (99, 106): 0.64,
    (107, 113): 0.65,
    (114, 121): 0.66,
    (122, 129): 0.67,
    (130, 137): 0.68,
    (138, 145): 0.69,
    (146, 153): 0.70,
    (154, 162): 0.71,
    (163, 170): 0.72,
    (171, 179): 0.73,
    (180, 188): 0.74,
    (189, 197): 0.75,
    (198, 206): 0.76,
    (207, 215): 0.77,
    (216, 225): 0.78,
    (226, 235): 0.79,
    (236, 245): 0.80,
    (246, 256): 0.81,
    (257, 267): 0.82,
    (268, 278): 0.83,
    (279, 290): 0.84,
    (291, 302): 0.85,
    (303, 315): 0.86,
    (316, 328): 0.87,
    (329, 344): 0.88,
    (345, 357): 0.89,
    (358, 374): 0.90,
    (375, 391): 0.91,
    (392, 411): 0.92,
    (412, 432): 0.93,
    (433, 456): 0.94,
    (457, 484): 0.95,
    (485, 517): 0.96,
    (518, 559): 0.97,
    (560, 619): 0.98,
    (620, 735): 0.99,
    (736, float("inf")): 1.00,
}


class FideRating(BaseRating):
    # The fide rating system uses multiple k-factors so we can't put a default value
    # here.
    def __init__(self, *args, k_factor: float, **kwargs):
        super().__init__(*args, **kwargs)
        self.k_factor = k_factor

    def get_rating_diff(self, player_rating: int, opponent_rating: int) -> int:
        """Get the rating difference between two players.

        This takes into account the maximum difference as outlined in 8.3.1.

        Parameters
        ----------
        player_rating : int
            Rating of the player.
        opponent_rating : int
            Rating of the opponent.

        Returns
        -------
        int
            Difference in rating between the two players. Positive if the player rating
            is lower than the opponent rating. For players below 2650 the difference is
            capped at 400.

        Examples
        --------
        >>> r = FideRating(k_factor=20)
        >>> r.get_rating_diff(2000, 2100)
        100
        >>> r.get_rating_diff(2100, 2000)
        -100
        >>> r.get_rating_diff(2000, 1500)
        -400
        >>> r.get_rating_diff(2000, 2650)
        400
        >>> r.get_rating_diff(2650, 2000)
        -650
        >>> r.get_rating_diff(2650, 3150)
        500
        """
        rating_diff = opponent_rating - player_rating
        if player_rating < 2650:
            return max(-400, min(400, rating_diff))
        return rating_diff

    def get_win_prob(self, rating_diff: int) -> float:
        """Get the win probability given the rating difference.

        Parameters
        ----------
        rating_diff: int
            Difference in rating between the two players (positive if the first player
            is lower rated.)

        Returns
        -------
        Probability that the first player wins the game, according to table 8.1.2 of the
        FIDE rating handbook (copied to the variable `RATING_DIFF_TO_PROB`).

        Examples
        --------
        >>> r = FideRating(k_factor=20)
        >>> r.get_win_prob(0)
        0.5
        >>> r.get_win_prob(200)
        0.24
        >>> r.get_win_prob(1000)
        0.0
        >>> r.get_win_prob(-75)
        0.6
        >>> r.get_win_prob(-245)
        0.8
        >>> r.get_win_prob(-246)
        0.81
        """
        player_is_higher_rated = rating_diff <= 0
        abs_diff = abs(rating_diff)
        for (low, high), prob in RATING_DIFF_TO_PROB.items():
            if low <= abs_diff <= high:
                if player_is_higher_rated:
                    # If we do not round to two digits, floating point arithmetic might
                    # prevent us from returning the exact value from the FIDE handbook.
                    return round(prob, 2)
                else:
                    return round(1 - prob, 2)
        raise RuntimeError(
            "All positive integers should be covered by `RATING_DIFF_TO_PROB`"
        )

    def expected_score(self, player_rating: float, opponent_rating: float) -> float:
        # We round the ratings to integers. This should not matter because FIDE
        # calculates rating change based on the official published ratings, which are
        # integers. A rating of exactly x.5 rounds up, the way FIDE breaks a tie
        # (8.3.4), not towards even the way the built-in `round` would.
        rating_diff = self.get_rating_diff(
            round_half_up(player_rating), round_half_up(opponent_rating)
        )
        return self.get_win_prob(rating_diff)

    def calculate_change(
        self, player_rating: float, opponent_rating: float | None, score: float
    ) -> float:
        if opponent_rating is None:
            return 0.0
        expected = self.expected_score(player_rating, opponent_rating)
        return (score - expected) * self.k_factor

    def performance_rating(
        self, opponent_ratings: list[float | None], scores: list[float]
    ) -> float:
        """Performance rating as `Rp = Ra + dp`.

        `Ra` is the average rating of the opponents and `dp` follows from the fractional
        score through `SCORE_TO_RATING_DIFF` (RR 8.1.1). Opponents without a rating count
        as `UNRATED_PERFORMANCE_VALUE` (TR 1.4.6d), unlike `calculate_change`, which
        ignores those games, and unlike the base implementation, which drops them. See
        https://handbook.fide.com/chapter/B012024

        The base class inverts `expected_score` by bisection, which this class cannot
        use: `get_win_prob` is a step function and `get_rating_diff` caps the difference
        at 400 points, so the expectancy here is discontinuous and flat outside a narrow
        band. `SCORE_TO_RATING_DIFF` is FIDE's own inversion of it. The base class's
        promise that the result lies within 800 points of `Ra` still holds, because the
        table is capped at +-800.

        Parameters
        ----------
        opponent_ratings : list[float | None]
            List of ratings of the opponents, `None` for an opponent without a rating.
            Should be the same size as `scores`.
        scores : list[float]
            The scores for the player (i.e. 0, 1 or 0.5). Should be the same size as
            `opponent_ratings`.

        Returns
        -------
        float
            The performance rating over these results.

        Raises
        ------
        ValueError
            If the two lists differ in length, or if there are no opponents at all.

        Examples
        --------
        >>> r = FideRating(k_factor=20)
        >>> r.performance_rating([1600, 1600, 1600, 1600], [1.0, 1.0, 1.0, 0.0])
        1793.0
        >>> r.performance_rating([1600, None], [1.0, 0.0])
        1500.0
        """
        if len(opponent_ratings) != len(scores):
            raise ValueError(
                "number of opponent ratings should be equal to number of scores."
            )
        if not opponent_ratings:
            raise ValueError("a performance rating needs at least one opponent.")
        total_rating = sum(
            UNRATED_PERFORMANCE_VALUE if rating is None else rating
            for rating in opponent_ratings
        )
        average_rating = total_rating / len(opponent_ratings)
        # The fractional score is divided in Decimal rather than in float, and the tie
        # is broken upwards. Both matter, because the table is in steps of 0.01 and a
        # step is worth up to 21 rating points:
        #   - `round(p, 2)` breaks a tie towards even, so 1/8 would give 0.12 where FIDE
        #     wants 0.13. Scores like 1 out of 8 are ordinary, not exotic.
        #   - Dividing in float first loses the tie for a score such as 1.5 out of 20:
        #     0.075 is not representable in binary and lands just under the halfway
        #     point, so rounding it up afterwards still gives 0.07 instead of 0.08.
        # Every score is a multiple of 0.5 and so exact in binary, which makes
        # `Decimal(sum(scores))` lossless and the division exact where it can be.
        fractional_score = float(
            (Decimal(sum(scores)) / len(scores)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        )
        # Every two decimal value in [0, 1] is a key of the table.
        return average_rating + SCORE_TO_RATING_DIFF[fractional_score]
