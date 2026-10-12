"""The club website's WordPress REST API.

Only the standard `wp/v2` routes are used, so nothing has to be installed on
the site: a WordPress user with an application password is all it takes.
Requests are authenticated with HTTP Basic auth, which WordPress accepts for
application passwords (over HTTPS only).

The site serves the REST API at `?rest_route=/...` and not at the usual
`/wp-json/...`, which answers 404 there. The query form works on every
WordPress install, pretty permalinks or not, so it is the one used.
"""

import re
from dataclasses import dataclass
from html import unescape
from typing import Any

import httpx

from backend.club_site.http import ClubSiteError, client
from backend.config import settings

# Writing a post makes WordPress run its save hooks, which can be slow on
# shared hosting; reads keep the client's default timeout.
WRITE_TIMEOUT = 30.0

# The largest page WordPress serves.
MAX_PER_PAGE = 100


@dataclass(frozen=True)
class Post:
    id: int
    link: str
    # "publish", "draft", "trash", ...: whatever the post is on the site now.
    status: str


@dataclass(frozen=True)
class Category:
    id: int
    name: str
    # 0 for a top-level category.
    parent: int


def is_configured() -> bool:
    """Whether there are credentials to write to the site with."""
    return bool(settings.club_site_username and settings.club_site_app_password)


def _auth() -> tuple[str, str]:
    username = settings.club_site_username
    password = settings.club_site_app_password
    if not (username and password):
        raise ClubSiteError("Publishing to the club website is not configured.")
    return (username, password.get_secret_value())


def _error_message(response: httpx.Response) -> str:
    # WordPress answers an error with {"code", "message", "data": {"status"}}.
    try:
        message = response.json().get("message")
    except (ValueError, AttributeError):
        message = None
    if not message:
        return response.reason_phrase
    # Some messages carry markup ("<strong>Fout:</strong> ..."), meant for wp-admin.
    return unescape(re.sub(r"<[^>]+>", "", message)).strip()


def _request(
    method: str,
    route: str,
    *,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
    timeout: float | None = None,
) -> httpx.Response:
    """One request to a REST route, raising ClubSiteError for anything but 2xx.

    A 404 is returned rather than raised, for the caller to decide what a
    missing resource means.
    """
    try:
        response = client.request(
            method,
            f"{settings.club_site_base_url.rstrip('/')}/",
            params={"rest_route": route, **(params or {})},
            json=json,
            auth=_auth(),
            timeout=timeout if timeout is not None else httpx.USE_CLIENT_DEFAULT,
        )
    except httpx.HTTPError as exc:
        raise ClubSiteError(f"Club website request failed: {exc}") from exc
    if response.is_success or response.status_code == 404:
        return response
    raise ClubSiteError(
        f"Club website answered {response.status_code}: {_error_message(response)}"
    )


def _no_rest_api() -> ClubSiteError:
    # A 404 on a collection means the route itself is missing.
    return ClubSiteError(
        f"The club website has no WordPress REST API at {settings.club_site_base_url}."
    )


def _post(body: dict[str, Any]) -> Post:
    return Post(id=body["id"], link=body["link"], status=body["status"])


def create_post(title: str, content: str, categories: list[int]) -> Post:
    """Create a post with the status `club_site_post_status` says."""
    response = _request(
        "POST",
        "/wp/v2/posts",
        json={
            "title": title,
            "content": content,
            "categories": categories,
            "status": settings.club_site_post_status,
        },
        timeout=WRITE_TIMEOUT,
    )
    if response.status_code == 404:
        raise _no_rest_api()
    return _post(response.json())


def update_post(
    post_id: int, title: str, content: str, categories: list[int]
) -> Post | None:
    """Replace a post's title, content and categories; None if it is gone.

    The status is left alone, so a post someone took offline or put back to
    draft on the site stays that way.
    """
    response = _request(
        "POST",
        f"/wp/v2/posts/{post_id}",
        json={"title": title, "content": content, "categories": categories},
        timeout=WRITE_TIMEOUT,
    )
    if response.status_code == 404:
        return None
    return _post(response.json())


def list_categories() -> list[Category]:
    """Every post category on the site, by name."""
    categories: list[Category] = []
    page = 1
    while True:
        response = _request(
            "GET",
            "/wp/v2/categories",
            params={"per_page": MAX_PER_PAGE, "page": page, "orderby": "name"},
        )
        if response.status_code == 404:
            raise _no_rest_api()
        categories.extend(
            # WordPress hands out names HTML-escaped ("Jeugd &amp; Senioren").
            Category(id=c["id"], name=unescape(c["name"]), parent=c["parent"])
            for c in response.json()
        )
        if page >= int(response.headers.get("X-WP-TotalPages", 1)):
            return categories
        page += 1
