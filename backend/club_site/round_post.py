"""A round as a post on the club website.

A round is published twice, to the same post. First, once it is paired, the
post is "Indeling Ronde N" with the match table and an empty result column.
Then, once every result is in, it becomes "Uitslagen en stand Ronde N" and the
ranking after the round is added. In between, any results already entered are
shown, but the ranking waits until the round is complete. When a player has
the bye, the pairings version says so above the match table; the results
version leaves it out.

The tables are the club's report format from `backend.round_report`, the same
as the CSV downloads. They carry TablePress's classes so they look like the
tables the club published through that plugin before. The whole body is a
single Custom HTML block, so opening the post in the block editor leaves the
markup alone.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from html import escape
from typing import Literal

from backend.models import Match, SimkroRank
from backend.round_report import (
    MATCH_HEADERS,
    RANKING_HEADERS,
    Row,
    match_rows,
    ranking_rows,
)


@dataclass(frozen=True)
class RoundPost:
    title: str
    content: str
    # Whether the post shows the round's results and the ranking after it, as
    # opposed to only who plays whom.
    with_results: bool


def is_complete(matches: Sequence[Match]) -> bool:
    """Whether every match of the round has a result."""
    return bool(matches) and all(match.result is not None for match in matches)


def _table(
    css_class: Literal["petlom-matches", "petlom-ranking"],
    headers: Sequence[str],
    rows: Sequence[Row],
) -> str:
    # TablePress numbers rows from 1, the header row included, and columns
    # from 1; its stylesheet keys on these classes.
    header_cells = "".join(
        f'<th class="column-{i}">{escape(header)}</th>'
        for i, header in enumerate(headers, start=1)
    )
    body_rows = "\n".join(
        f'<tr class="row-{r}">'
        + "".join(
            f'<td class="column-{i}">{escape(str(cell))}</td>'
            for i, cell in enumerate(row, start=1)
        )
        + "</tr>"
        for r, row in enumerate(rows, start=2)
    )
    return (
        f'<table class="tablepress {css_class}">\n'
        f'<thead>\n<tr class="row-1">{header_cells}</tr>\n</thead>\n'
        f'<tbody class="row-striping row-hover">\n{body_rows}\n</tbody>\n'
        "</table>"
    )


def render_round_post(
    round_nr: int,
    matches: Sequence[Match],
    ranking: Sequence[SimkroRank] | None,
    bye_player_name: str | None = None,
) -> RoundPost:
    """The post for a round; pass the ranking only once the round is complete."""
    with_results = ranking is not None
    parts: list[str] = []
    if bye_player_name is not None and not with_results:
        parts.append(
            '<p class="petlom-bye">Er is een oneven aantal aanmeldingen.'
            f" {escape(bye_player_name)} heeft een bye.</p>"
        )
    parts.append(_table("petlom-matches", MATCH_HEADERS, match_rows(matches)))
    if ranking is not None:
        parts.append(_table("petlom-ranking", RANKING_HEADERS, ranking_rows(ranking)))
    title = (
        f"Uitslagen en stand Ronde {round_nr}"
        if with_results
        else f"Indeling Ronde {round_nr}"
    )
    content = "<!-- wp:html -->\n" + "\n".join(parts) + "\n<!-- /wp:html -->"
    return RoundPost(title=title, content=content, with_results=with_results)
