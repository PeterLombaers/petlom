import base64
import json

import httpx
import pytest
import respx
from pydantic import SecretStr

from backend.club_site import ClubSiteError, wordpress
from backend.config import settings

SITE = "https://club.test"


@pytest.fixture(autouse=True)
def configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "club_site_base_url", SITE)
    monkeypatch.setattr(settings, "club_site_username", "petlom")
    monkeypatch.setattr(settings, "club_site_app_password", SecretStr("abcd efgh"))
    monkeypatch.setattr(settings, "club_site_post_status", "publish")


def post_body(**overrides: object) -> dict[str, object]:
    return {"id": 7, "link": f"{SITE}/?p=7", "status": "publish", **overrides}


@respx.mock
def test_create_post_uses_the_rest_route_query_and_basic_auth():
    created = respx.post(f"{SITE}/", params={"rest_route": "/wp/v2/posts"}).respond(
        201, json=post_body()
    )

    post = wordpress.create_post("Indeling Ronde 1", "<table/>", [14, 11])

    assert post == wordpress.Post(id=7, link=f"{SITE}/?p=7", status="publish")
    request = created.calls.last.request
    assert (
        request.headers["Authorization"]
        == "Basic " + base64.b64encode(b"petlom:abcd efgh").decode()
    )
    assert json.loads(request.content) == {
        "title": "Indeling Ronde 1",
        "content": "<table/>",
        "categories": [14, 11],
        "status": "publish",
    }


@respx.mock
def test_create_post_takes_the_status_from_the_settings(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "club_site_post_status", "draft")
    created = respx.post(f"{SITE}/", params={"rest_route": "/wp/v2/posts"}).respond(
        201, json=post_body(status="draft")
    )

    wordpress.create_post("t", "c", [])

    assert json.loads(created.calls.last.request.content)["status"] == "draft"


@respx.mock
def test_update_post_leaves_the_status_alone():
    updated = respx.post(f"{SITE}/", params={"rest_route": "/wp/v2/posts/7"}).respond(
        200, json=post_body(status="draft")
    )

    post = wordpress.update_post(7, "Uitslagen en stand Ronde 1", "c", [14])

    assert post is not None and post.status == "draft"
    assert "status" not in json.loads(updated.calls.last.request.content)


@respx.mock
def test_update_post_of_a_deleted_post_is_none():
    respx.post(f"{SITE}/", params={"rest_route": "/wp/v2/posts/7"}).respond(
        404, json={"code": "rest_post_invalid_id", "message": "Invalid post ID."}
    )

    assert wordpress.update_post(7, "t", "c", []) is None


@respx.mock
def test_rejected_credentials_are_a_club_site_error():
    respx.post(f"{SITE}/", params={"rest_route": "/wp/v2/posts"}).respond(
        401,
        json={
            "code": "incorrect_password",
            "message": "The provided password is an invalid application password.",
        },
    )

    with pytest.raises(ClubSiteError, match="401: The provided password"):
        wordpress.create_post("t", "c", [])


@respx.mock
def test_an_unreachable_site_is_a_club_site_error():
    respx.post(f"{SITE}/").mock(side_effect=httpx.ConnectError("refused"))

    with pytest.raises(ClubSiteError, match="refused"):
        wordpress.create_post("t", "c", [])


@respx.mock
def test_list_categories_reads_every_page_and_unescapes_names():
    categories = respx.get(f"{SITE}/", params={"rest_route": "/wp/v2/categories"})
    categories.side_effect = [
        httpx.Response(
            200,
            json=[{"id": 14, "name": "Interne competitie", "parent": 0}],
            headers={"X-WP-TotalPages": "2"},
        ),
        httpx.Response(
            200,
            json=[{"id": 21, "name": "Jeugd &amp; Senioren", "parent": 14}],
            headers={"X-WP-TotalPages": "2"},
        ),
    ]

    assert wordpress.list_categories() == [
        wordpress.Category(id=14, name="Interne competitie", parent=0),
        wordpress.Category(id=21, name="Jeugd & Senioren", parent=14),
    ]
    assert [call.request.url.params["page"] for call in categories.calls] == ["1", "2"]


def test_without_credentials_it_is_not_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "club_site_app_password", None)

    assert not wordpress.is_configured()
    with pytest.raises(ClubSiteError, match="not configured"):
        wordpress.create_post("t", "c", [])


@respx.mock
def test_markup_is_stripped_from_error_messages():
    respx.post(f"{SITE}/", params={"rest_route": "/wp/v2/posts"}).respond(
        401,
        json={
            "code": "invalid_username",
            "message": "<strong>Fout:</strong> onbekende gebruikersnaam.",
        },
    )

    with pytest.raises(ClubSiteError, match="401: Fout: onbekende gebruikersnaam.$"):
        wordpress.create_post("t", "c", [])
