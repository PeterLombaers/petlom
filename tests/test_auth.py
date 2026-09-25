import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.enums import Role
from backend.models import Moderator


def test_login_success(
    client: TestClient, moderator: Moderator, moderator_password: str
):
    res = client.post(
        "/auth/login",
        data={"username": moderator.username, "password": moderator_password},
    )
    res.raise_for_status()
    body = res.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient, moderator: Moderator):
    res = client.post(
        "/auth/login", data={"username": moderator.username, "password": "wrong"}
    )
    assert res.status_code == 401


def test_login_unknown_user(client: TestClient, moderator_password: str):
    res = client.post(
        "/auth/login", data={"username": "nobody", "password": moderator_password}
    )
    assert res.status_code == 401


def test_me(auth_client: TestClient, moderator: Moderator):
    res = auth_client.get("/auth/me")
    res.raise_for_status()
    body = res.json()
    assert body["username"] == moderator.username
    assert body["id"] == moderator.id


def test_me_unauthenticated(client: TestClient):
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_write_endpoint_unauthenticated(client: TestClient):
    res = client.post("/players/", json={"name": "Peter"})
    assert res.status_code == 401


def test_account_without_role_is_a_moderator(session: Session):
    """The guarantee that accounts predating the role column are unaffected."""
    mod = Moderator(username="oldtimer", hashed_password="x")
    session.add(mod)
    session.commit()
    session.refresh(mod)
    assert mod.role is Role.MODERATOR


def test_login_returns_role(
    client: TestClient, moderator: Moderator, moderator_password: str
):
    res = client.post(
        "/auth/login",
        data={"username": moderator.username, "password": moderator_password},
    )
    res.raise_for_status()
    assert res.json()["role"] == "moderator"


def test_login_returns_result_keeper_role(
    client: TestClient, result_keeper: Moderator, moderator_password: str
):
    res = client.post(
        "/auth/login",
        data={"username": result_keeper.username, "password": moderator_password},
    )
    res.raise_for_status()
    assert res.json()["role"] == "result_keeper"


def test_me_returns_role(auth_client: TestClient):
    res = auth_client.get("/auth/me")
    res.raise_for_status()
    assert res.json()["role"] == "moderator"


def test_result_keeper_can_read_own_identity(
    result_keeper_client: TestClient, result_keeper: Moderator
):
    """`/auth/me` describes the caller, so it is not moderator-gated."""
    res = result_keeper_client.get("/auth/me")
    res.raise_for_status()
    body = res.json()
    assert body["username"] == result_keeper.username
    assert body["role"] == "result_keeper"


@pytest.mark.parametrize(
    "method,path,json_body",
    [
        ("post", "/players/", {"name": "Peter"}),
        ("patch", "/players/1/", {"name": "Peter"}),
        ("delete", "/players/1/", None),
        ("post", "/matches/", {}),
        ("delete", "/matches/1", None),
        ("post", "/competitions/", {}),
        ("patch", "/competitions/simkro", {}),
        ("delete", "/competitions/simkro", None),
        ("post", "/competitions/simkro/pairing", {}),
        ("delete", "/competitions/simkro/pairing", None),
        ("get", "/competitions/simkro/pairing/export", None),
        ("get", "/competitions/simkro/ranking/export", None),
        ("patch", "/competitions/simkro/registrations", {}),
        ("get", "/external/fide/search/", None),
    ],
)
def test_result_keeper_forbidden_on_moderator_endpoints(
    result_keeper_client: TestClient, method: str, path: str, json_body: dict | None
):
    """403, never 401: a 401 would log the user out in the frontend."""
    res = result_keeper_client.request(method.upper(), path, json=json_body)
    assert res.status_code == 403
