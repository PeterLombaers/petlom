from fastapi.testclient import TestClient

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
