import re

from backend.club_site.round_post import is_complete, render_round_post
from backend.enums import Result
from backend.models import Match, Player, PlayerRef, SimkroRank
from backend.round_report import MATCH_HEADERS, RANKING_HEADERS


def build_match(board: int, white: str, black: str, result: Result | None) -> Match:
    return Match(
        board=board,
        round=3,
        player_white=Player(name=white),
        player_black=Player(name=black),
        result=result,
    )


def build_rank(position: int, name: str) -> SimkroRank:
    return SimkroRank(
        position=position,
        player=PlayerRef(id=position, name=name, is_active=True),
        games_played=3,
        saldo=1,
        points=510,
        color_saldo=0,
        wins=2,
        draws=0,
        losses=1,
        current_rating=1812.5,
        performance_rating=None,
    )


def table_rows(html: str, css_class: str) -> list[list[str]]:
    """The cells of one table in the post, header row first."""
    table = re.search(
        rf'<table class="tablepress {css_class}">(.*?)</table>', html, re.DOTALL
    )
    assert table is not None
    return [
        re.findall(r"<t[hd] [^>]*>(.*?)</t[hd]>", row)
        for row in re.findall(r"<tr [^>]*>(.*?)</tr>", table.group(1))
    ]


MATCHES = [
    build_match(2, "Piet Pietersen", "Klaas Klaassen", None),
    build_match(1, "Jan Jansen", "Kees de Vries", Result.DRAW),
]


def test_pairings_only_until_the_round_is_complete():
    post = render_round_post(3, MATCHES, None)

    assert post.title == "Indeling Ronde 3"
    assert not post.with_results
    assert table_rows(post.content, "petlom-matches") == [
        MATCH_HEADERS,
        # Sorted by board; the result entered so far is shown, the other is empty.
        ["1", "Jan Jansen", "Kees de Vries", "½-½"],
        ["2", "Piet Pietersen", "Klaas Klaassen", ""],
    ]
    assert "petlom-ranking" not in post.content


def test_results_and_ranking_once_complete():
    post = render_round_post(3, MATCHES, [build_rank(1, "Jan Jansen")])

    assert post.title == "Uitslagen en stand Ronde 3"
    assert post.with_results
    assert table_rows(post.content, "petlom-ranking") == [
        RANKING_HEADERS,
        ["1", "Jan Jansen", "510", "3", "1", "0", "2", "0", "1", "1813", ""],
    ]


def test_the_content_is_one_custom_html_block():
    content = render_round_post(3, MATCHES, None).content

    assert content.startswith("<!-- wp:html -->\n")
    assert content.endswith("\n<!-- /wp:html -->")


def test_tablepress_row_and_column_classes():
    content = render_round_post(3, MATCHES, None).content

    assert '<tr class="row-1"><th class="column-1">Nr</th>' in content
    assert '<tbody class="row-striping row-hover">' in content
    assert '<tr class="row-3"><td class="column-1">2</td>' in content


def test_names_are_escaped():
    matches = [build_match(1, "<b>Jan</b> & co", "Piet", None)]

    content = render_round_post(1, matches, None).content

    assert "&lt;b&gt;Jan&lt;/b&gt; &amp; co" in content
    assert "<b>" not in content


def test_is_complete():
    assert not is_complete([])
    assert not is_complete(MATCHES)
    assert is_complete([build_match(1, "a", "b", Result.WHITE_WIN)])
