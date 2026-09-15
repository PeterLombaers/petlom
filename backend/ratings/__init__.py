from backend.ratings.base import BaseRating
from backend.ratings.fide import FideRating
from backend.ratings.simkro import SimkroRating

__all__ = [
    "BaseRating",
    "FideRating",
    "SimkroRating",
    "calculate_ratings",
    "performance_ratings",
]


def _player_results(
    player_id: int,
    matches: list[tuple[int, int, float]],
    ratings: dict[int, float | None],
) -> tuple[list[float | None], list[float]]:
    """The opponent ratings and scores of one player, in match order."""
    opponent_ratings: list[float | None] = []
    scores: list[float] = []

    for white_id, black_id, white_score in matches:
        if white_id == player_id:
            opp_id, score = black_id, white_score
        elif black_id == player_id:
            opp_id, score = white_id, 1.0 - white_score
        else:
            continue

        opponent_ratings.append(ratings.get(opp_id))
        scores.append(score)

    return opponent_ratings, scores


def calculate_ratings(
    ratings: dict[int, float | None],
    matches: list[tuple[int, int, float]],
    rating_func: BaseRating,
) -> dict[int, float]:
    """Calculate new ratings for all players based on match results.

    Parameters
    ----------
    ratings:
        ``{player_id: initial_rating}`` for every player whose rating should be
        calculated.  Opponent ratings are also looked up from this dict.  A
        rating of ``None`` means the player's rating is unknown.
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
        ``{player_id: new_rating}`` for every player in *ratings* with a known
        initial rating; players whose own rating is ``None`` are absent.  A
        match against an opponent with an unknown rating is still passed to the
        algorithm, which decides what it is worth.
    """
    new_ratings: dict[int, float] = {}

    for player_id, initial_rating in ratings.items():
        if initial_rating is None:
            continue

        opponent_ratings, scores = _player_results(player_id, matches, ratings)
        change = rating_func.calculate_change_list(
            initial_rating, opponent_ratings, scores
        )
        new_ratings[player_id] = initial_rating + change

    return new_ratings


def performance_ratings(
    ratings: dict[int, float | None],
    matches: list[tuple[int, int, float]],
    rating_func: BaseRating,
) -> dict[int, float]:
    """Calculate the performance rating of all players based on match results.

    Parameters
    ----------
    ratings:
        ``{player_id: initial_rating}`` for every player whose performance rating should
        be calculated.  Opponent ratings are also looked up from this dict.  A rating of
        ``None`` means the player's rating is unknown.
    matches:
        Ordered list of ``(player_white_id, player_black_id, white_score)`` tuples, as in
        `calculate_ratings`.  Only pass completed matches (no pending results).
    rating_func:
        Instantiated rating algorithm to use for all calculations.

    Returns
    -------
    dict[int, float]
        ``{player_id: performance_rating}``.  Unlike `calculate_ratings`, a player whose
        own initial rating is ``None`` is still included: a performance rating follows
        from the opponents and the scores alone, so a player without a rating yet still
        gets one.  A player the algorithm cannot compute one for — no played matches, or
        no opponent that counts — is absent, the same way `calculate_ratings` omits
        players it cannot compute.
    """
    performances: dict[int, float] = {}

    for player_id in ratings:
        opponent_ratings, scores = _player_results(player_id, matches, ratings)
        try:
            performances[player_id] = rating_func.performance_rating(
                opponent_ratings, scores
            )
        except ValueError:
            continue

    return performances
