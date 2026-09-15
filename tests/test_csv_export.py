import csv
import io

from backend.csv_export import ranking_csv
from backend.models import PlayerRef, SimkroRank


def build_rank(current_rating: float | None, performance_rating: float | None):
    return SimkroRank(
        position=1,
        player=PlayerRef(name="Jansen", id=1, is_active=True),
        games_played=2,
        saldo=0,
        points=1,
        color_saldo=0,
        wins=1,
        draws=0,
        losses=1,
        current_rating=current_rating,
        performance_rating=performance_rating,
    )


def ranking_row(rank: SimkroRank) -> list[str]:
    return list(csv.reader(io.StringIO(ranking_csv([rank]))))[1]


def test_ratings_round_a_tie_up_like_the_frontend():
    # The browser renders these with `Math.round`, which rounds a tie up. Python's
    # built-in `round` would give 1792 and 1500 here, and the CSV would disagree with
    # what the user is looking at.
    row = ranking_row(build_rank(1500.5, 1792.5))
    assert row[9] == "1501"
    assert row[10] == "1793"


def test_ratings_that_are_not_ties_round_normally():
    row = ranking_row(build_rank(1499.4, 1792.6))
    assert row[9] == "1499"
    assert row[10] == "1793"


def test_missing_ratings_leave_the_cells_empty():
    row = ranking_row(build_rank(None, None))
    assert row[9] == ""
    assert row[10] == ""
