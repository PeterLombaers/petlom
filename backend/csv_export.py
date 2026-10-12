"""CSV renderings of a competition round, for club administration."""

import csv
import io
from collections.abc import Sequence

from backend.models import Match, SimkroRank
from backend.round_report import (
    MATCH_HEADERS,
    RANKING_HEADERS,
    Row,
    match_rows,
    ranking_rows,
)


def _render(headers: Sequence[str], rows: Sequence[Row]) -> str:
    buffer = io.StringIO()
    # RFC 4180 line endings; the default would be the platform's.
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue()


def matches_csv(matches: Sequence[Match]) -> str:
    """The match results of one round, by board number."""
    return _render(MATCH_HEADERS, match_rows(matches))


def ranking_csv(ranking: Sequence[SimkroRank]) -> str:
    """The ranking after the round, in the order `compute_ranking` produced."""
    return _render(RANKING_HEADERS, ranking_rows(ranking))
