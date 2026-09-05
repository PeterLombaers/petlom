from .base import BaseRating


class SimkroRating(BaseRating):
    """Rating as implemented in the original Simkro.

    This is a standard ELO rating implementation. See
    https://en.wikipedia.org/wiki/Elo_rating_system#Mathematical_details for more
    details.
    """

    def __init__(self, *args, k_factor: float = 30, **kwargs):
        super().__init__(*args, **kwargs)
        self.k_factor = k_factor

    def calculate_change(
        self,
        player_rating: float,
        opponent_rating: float | None,
        score: float,
    ) -> float:
        if opponent_rating is None:
            return 0.0
        rating_diff = opponent_rating - player_rating
        return self.k_factor * (score - 1 / (1 + 10 ** (rating_diff / 400)))
