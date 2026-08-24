from pathlib import Path

import httpx
import pytest
import respx

from backend.club_site import ClubSiteError, fetch_registered_names

PAGE_URL = "https://club.test/?page_id=1"
PAGE_HTML = (Path(__file__).parent / "data/club_site/signup_page.html").read_text()

ANNOUNCEMENT_CSV = (
    "donderdag 27 augustus 2026\nDe aanmelding staat open\nDeelnemers: 3\n"
)

SIGNUPS_CSV = """#,Tijdstip aanmelding,Naam
1,21-8-2026 11:23:48,Sander Bakker
2,21-8-2026 12:45:02,Marijke de Vries
3,24-8-2026 12:39:07,Tom Verhoeven
"""


def sheet_url(key: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/e/{key}/pub"


def mock_site(
    page: str = PAGE_HTML,
    announcement: str = ANNOUNCEMENT_CSV,
    signups: str = SIGNUPS_CSV,
) -> None:
    respx.get(PAGE_URL).respond(text=page)
    respx.get(sheet_url("ANNOUNCEMENT")).respond(text=announcement)
    respx.get(sheet_url("SIGNUPS")).respond(text=signups)


@respx.mock
def test_reads_the_sheet_with_a_name_column():
    mock_site()

    assert fetch_registered_names(PAGE_URL) == [
        "Sander Bakker",
        "Marijke de Vries",
        "Tom Verhoeven",
    ]


@respx.mock
def test_asks_for_the_csv_export_of_each_sheet_and_skips_the_form():
    mock_site()
    fetch_registered_names(PAGE_URL)

    requested = [str(call.request.url) for call in respx.calls]
    assert requested[0] == PAGE_URL
    # The announcement sheet is tried first because the page embeds it first,
    # and dropped because it has no name column. The form is not a sheet.
    assert [url.split("?")[1] for url in requested[1:]] == ["output=csv"] * 2
    assert not any("forms" in url for url in requested)


@respx.mock
def test_keeps_a_duplicate_signup():
    mock_site(signups=SIGNUPS_CSV + "4,24-8-2026 13:00:00,Sander Bakker\n")

    assert fetch_registered_names(PAGE_URL).count("Sander Bakker") == 2


@respx.mock
def test_skips_blank_rows_and_trims():
    mock_site(signups="#,Naam\n1,  Sander Bakker  \n2,\n3,   \n4,Tom Verhoeven\n")

    assert fetch_registered_names(PAGE_URL) == ["Sander Bakker", "Tom Verhoeven"]


@respx.mock
def test_sends_a_user_agent_the_club_website_accepts():
    mock_site()
    fetch_registered_names(PAGE_URL)

    assert "Petlom" in respx.calls[0].request.headers["user-agent"]


@respx.mock
@pytest.mark.parametrize("status_code", [403, 500])
def test_page_that_will_not_load_raises(status_code: int):
    respx.get(PAGE_URL).respond(status_code=status_code)

    with pytest.raises(ClubSiteError):
        fetch_registered_names(PAGE_URL)


@respx.mock
def test_unreachable_site_raises():
    respx.get(PAGE_URL).mock(side_effect=httpx.ConnectError("no route"))

    with pytest.raises(ClubSiteError):
        fetch_registered_names(PAGE_URL)


@respx.mock
def test_page_without_a_sheet_raises():
    respx.get(PAGE_URL).respond(
        text="<html><body><p>Geen aanmeldingen</p></body></html>"
    )

    with pytest.raises(ClubSiteError, match="No published Google Sheet"):
        fetch_registered_names(PAGE_URL)


@respx.mock
def test_no_sheet_with_a_name_column_raises():
    mock_site(signups="#,Tijdstip aanmelding\n1,21-8-2026 11:23:48\n")

    with pytest.raises(ClubSiteError, match="column named"):
        fetch_registered_names(PAGE_URL)
