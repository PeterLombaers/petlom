"""Reading the sign-up list off the club website.

Members register for a club evening through a Google Form; the answers land in
a Google Sheet that the club website publishes in an ``<iframe>``. So the page
itself holds no table -- getting at the names means finding the sheet it embeds
and reading that.

A published sheet is served both as HTML (``/pubhtml``) and as CSV
(``/pub?output=csv``); we ask for the CSV, which needs no HTML parsing and no
parsing library. The page embeds more than one sheet (the sign-up list and the
evening's announcement) plus the form itself, so the sheets are tried in order
and the first one with a name column wins.
"""

import csv
import io
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlparse

import httpx

# The club website answers some non-browser user agents with a 403.
USER_AGENT = (
    "Mozilla/5.0 (compatible; Petlom/1.0; +https://github.com/petlom) python-httpx"
)

# The header of the column holding the registered names, normalized.
NAME_HEADERS = frozenset({"naam", "name"})

# One client for the whole process, like backend.external.chess_db: a client
# per request would leak a connection pool per request. No concurrency budget
# here -- a run is at most a handful of sequential requests.
_client = httpx.Client(
    timeout=10.0, follow_redirects=True, headers={"User-Agent": USER_AGENT}
)


class ClubSiteError(Exception):
    """The sign-up list could not be fetched or made sense of."""


class _IframeSrcParser(HTMLParser):
    """Collects the src of every iframe on a page, in document order."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.srcs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "iframe":
            return
        for name, value in attrs:
            if name == "src" and value:
                self.srcs.append(value)


def _iframe_srcs(html: str) -> list[str]:
    parser = _IframeSrcParser()
    parser.feed(html)
    return parser.srcs


def _sheet_csv_url(src: str) -> str | None:
    """The CSV export of a published-sheet iframe, or None if it is not one.

    The page also embeds the Google Form, which has the same host but is not a
    spreadsheet.
    """
    url = urlparse(src)
    if not url.hostname or not url.hostname.endswith("docs.google.com"):
        return None
    parts = url.path.strip("/").split("/")
    # /spreadsheets/d/e/<key>/pubhtml
    if len(parts) < 5 or parts[0] != "spreadsheets" or parts[1:3] != ["d", "e"]:
        return None
    key = parts[3]
    csv_url = f"https://docs.google.com/spreadsheets/d/e/{key}/pub?output=csv"
    # A sheet other than the first one is addressed by gid; keep it if present.
    gid = parse_qs(url.query).get("gid")
    if gid:
        csv_url = f"{csv_url}&gid={gid[0]}"
    return csv_url


def _get(url: str) -> str:
    try:
        response = _client.get(url)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ClubSiteError(f"Club website request failed: {exc}") from exc
    return response.text


def _names_in_csv(text: str) -> list[str] | None:
    """The name column of a sheet, or None if it has no name column."""
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return None
    header = [cell.strip().casefold() for cell in rows[0]]
    for index, cell in enumerate(header):
        if cell in NAME_HEADERS:
            break
    else:
        return None
    names = []
    for row in rows[1:]:
        if index >= len(row):
            continue
        name = row[index].strip()
        if name:
            names.append(name)
    return names


def fetch_registered_names(url: str) -> list[str]:
    """The names people signed up under, in the order the sheet lists them.

    Duplicates are kept: the same name signed up twice is something the import
    overview should show rather than something to quietly drop.
    """
    sheet_urls = [
        csv_url
        for src in _iframe_srcs(_get(url))
        if (csv_url := _sheet_csv_url(src)) is not None
    ]
    if not sheet_urls:
        raise ClubSiteError(f"No published Google Sheet is embedded in {url}")
    for csv_url in sheet_urls:
        names = _names_in_csv(_get(csv_url))
        if names is not None:
            return names
    raise ClubSiteError(
        f"None of the sheets embedded in {url} has a column named "
        f"{' or '.join(sorted(NAME_HEADERS))}"
    )
