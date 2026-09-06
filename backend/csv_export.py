"""CSV renderings of a competition round, for club administration.

The column headers are the club's own report format, so they are Dutch here
regardless of the language the frontend is showing. Everything in this module is
pure: it takes the models it is handed and returns a string, so the router stays
a lookup plus a response.
"""

import csv
import io
from collections.abc import Sequence

from backend.enums import Result
from backend.models import Match, SimkroRank

MATCH_HEADERS = ["Nr", "Witspeler", "Zwartspeler", "Uitslag"]
RANKING_HEADERS = ["Nr", "Naam", "Pnt", "Prt", "Sal", "Ks", "w", "r", "v", "Rat"]

RESULT_TEXT = {
    Result.WHITE_WIN: "1-0",
    Result.DRAW: "½-½",
    Result.BLACK_WIN: "0-1",
}


def _render(headers: Sequence[str], rows: Sequence[Sequence[object]]) -> str:
    buffer = io.StringIO()
    # RFC 4180 line endings; the default would be the platform's.
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue()


def matches_csv(matches: Sequence[Match]) -> str:
    """The match results of one round, by board number."""
    return _render(
        MATCH_HEADERS,
        [
            [
                match.board,
                match.player_white.name,
                match.player_black.name,
                # A match that has not been played yet leaves the cell empty.
                RESULT_TEXT[match.result] if match.result is not None else "",
            ]
            for match in sorted(matches, key=lambda m: m.board)
        ],
    )


def ranking_csv(ranking: Sequence[SimkroRank]) -> str:
    """The ranking after a round, in the order `compute_ranking` produced."""
    return _render(
        RANKING_HEADERS,
        [
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
                # Rounded like the frontend shows it; empty when the player's
                # initial rating is unknown, so nothing can be derived.
                round(rank.current_rating) if rank.current_rating is not None else "",
            ]
            for rank in ranking
        ],
    )
