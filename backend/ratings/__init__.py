from backend.ratings.base import BaseRating
from backend.ratings.fide import FideRating
from backend.ratings.simkro import SimkroRating


__all__ = ["BaseRating", "FideRating", "SimkroRating", "calculate_ratings"]


def calculate_ratings(
    ratings: dict[int, float],
    matches: list[tuple[int, int, float]],
    rating_func: BaseRating,
) -> dict[int, float]:
    """Calculate new ratings for all players based on match results.

    Parameters
    ----------
    ratings:
        ``{player_id: initial_rating}`` for every player whose rating should be
        calculated.  Opponent ratings are also looked up from this dict.
    matches:
        Ordered list of ``(player_white_id, player_black_id, white_score)``
        tuples.  ``white_score`` is 1.0 for a white win, 0.5 for a draw, 0.0
        for a black win.  The order determines the sequence for algorithms with
        ``sequential=True``.  Only pass completed matches (no pending results).
    rating_func:
        Instantiated rating algorithm to use for all calculations.

    Returns
    -------
    dict[int, float]
        ``{player_id: new_rating}`` for every player in *ratings*.  Players
        whose opponent is not in *ratings* have that match skipped.
    """
    new_ratings: dict[int, float] = {}

    for player_id, initial_rating in ratings.items():
        opponent_ratings: list[float] = []
        scores: list[float] = []

        for white_id, black_id, white_score in matches:
            if white_id == player_id:
                opp_id, score = black_id, white_score
            elif black_id == player_id:
                opp_id, score = white_id, 1.0 - white_score
            else:
                continue

            opp_initial = ratings.get(opp_id)
            if opp_initial is not None:
                opponent_ratings.append(opp_initial)
                scores.append(score)

        change = rating_func.calculate_change_list(
            initial_rating, opponent_ratings, scores
        )
        new_ratings[player_id] = initial_rating + change

    return new_ratings
