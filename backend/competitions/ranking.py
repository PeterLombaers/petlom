"""Competition-scoped ranking and rating calculations.

The ranking and current competition rating are calculated from the match results in a
competition. This module contains to code for reading the correct data from the database
and calling the algorithms to calculate the rating and ranking. The rating algorithms
themselves are in `backend.ratings` and the ranking algorithms are the module of the
competition types (e.g. `backend.competitions.simkro`).
"""

from collections.abc import Sequence

from sqlmodel import Session, select

from backend.competitions.simkro import calculate_ranking
from backend.enums import Result
from backend.models import Competition, CompetitionRating, Match, SimkroRank
from backend.ratings import calculate_ratings


def _score_tuples(matches: Sequence[Match]) -> list[tuple[int, int, float]]:
    """Order the played matches and reduce each to (white, black, white_score)."""
    return [
        (
            m.player_white_id,
            m.player_black_id,
            1.0
            if m.result == Result.WHITE_WIN
            else 0.5
            if m.result == Result.DRAW
            else 0.0,
        )
        for m in sorted(
            (m for m in matches if m.result is not None),
            key=lambda m: (m.round, m.board),
        )
    ]


def _competition_ratings(
    competition: Competition, session: Session
) -> Sequence[CompetitionRating]:
    return session.exec(
        select(CompetitionRating).where(
            CompetitionRating.rating_type_id == competition.rating_type.id
        )
    ).all()


def _ratings_after(
    competition: Competition,
    comp_ratings: Sequence[CompetitionRating],
    matches: Sequence[Match],
) -> dict[int, float]:
    return calculate_ratings(
        {cr.player_id: cr.initial_rating for cr in comp_ratings},
        _score_tuples(matches),
        competition.rating_type.build_rating_algorithm(),
    )


def compute_ranking(
    competition: Competition, round_nr: int, session: Session
) -> list[SimkroRank]:
    """Return the ranking after `round_nr`, with the ratings as of that round."""
    matches = session.exec(
        select(Match)
        .where(Match.round <= round_nr)
        .where(Match.competition == competition)
    ).all()
    ranking = calculate_ranking(matches)

    ratings = _ratings_after(
        competition, _competition_ratings(competition, session), matches
    )
    for rank in ranking:
        rank.current_rating = ratings.get(rank.player.id)
    return ranking


def current_ratings(competition: Competition, session: Session) -> dict[int, float]:
    """The latest derived rating per player. Absent when the initial rating is unknown."""
    matches = session.exec(select(Match).where(Match.competition == competition)).all()
    return _ratings_after(
        competition, _competition_ratings(competition, session), matches
    )
