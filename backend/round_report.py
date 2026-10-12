"""A round as the club reports it: the match table and the ranking table.

The club has one format for a round, used both for the CSV downloads and for
the post on the club website, so the column headers and the rows are built
here once and only rendered differently. The headers are the club's own and
therefore Dutch, regardless of the language the frontend is showing.
"""

from collections.abc import Sequence

from backend.enums import Result
from backend.models import Match, SimkroRank
from backend.rounding import round_half_up

MATCH_HEADERS = ["Nr", "Witspeler", "Zwartspeler", "Uitslag"]
RANKING_HEADERS = ["Nr", "Naam", "Pnt", "Prt", "Sal", "Ks", "w", "r", "v", "Rat", "TPR"]

RESULT_TEXT = {
    Result.WHITE_WIN: "1-0",
    Result.DRAW: "½-½",
    Result.BLACK_WIN: "0-1",
}

type Row = list[str | int]


def match_rows(matches: Sequence[Match]) -> list[Row]:
    """The matches of one round, by board number."""
    return [
        [
            match.board,
            match.player_white.name,
            match.player_black.name,
            # A match that has not been played yet leaves the cell empty.
            RESULT_TEXT[match.result] if match.result is not None else "",
        ]
        for match in sorted(matches, key=lambda m: m.board)
    ]


def ranking_rows(ranking: Sequence[SimkroRank]) -> list[Row]:
    """The ranking after a round, in the order `compute_ranking` produced."""
    return [
        [
            rank.position,
            rank.player.name,
            rank.points,
            rank.games_played,
            rank.saldo,
            rank.color_saldo,
            rank.wins,
            rank.draws,
            rank.losses,
            round_half_up(rank.current_rating)
            if rank.current_rating is not None
            else "",
            round_half_up(rank.performance_rating)
            if rank.performance_rating is not None
            else "",
        ]
        for rank in ranking
    ]
