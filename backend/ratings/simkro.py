from .base import BaseRating


class SimkroRating(BaseRating):
    """Rating as implemented in the original Simkro.

    This is a standard ELO rating implementation. See
    https://en.wikipedia.org/wiki/Elo_rating_system#Mathematical_details for more
    details.

    Examples
    --------
    >>> r = SimkroRating()
    >>> round(r.performance_rating([1500, 1500], [1.0, 0.0]), 2)
    1500.0
    >>> round(r.performance_rating([1500], [1.0]), 2)  # clamped at Ra + 800
    2300.0
    >>> round(r.performance_rating([1500], [0.0]), 2)  # clamped at Ra - 800
    700.0
    """

    def __init__(self, *args, k_factor: float = 30, **kwargs):
        super().__init__(*args, **kwargs)
        self.k_factor = k_factor

    def expected_score(self, player_rating: float, opponent_rating: float) -> float:
        return 1 / (1 + 10 ** ((opponent_rating - player_rating) / 400))

    def calculate_change(
        self,
        player_rating: float,
        opponent_rating: float | None,
        score: float,
    ) -> float:
        if opponent_rating is None:
            return 0.0
        return self.k_factor * (
            score - self.expected_score(player_rating, opponent_rating)
        )
