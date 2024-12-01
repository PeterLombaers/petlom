from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models import RatingType


def test_create_rating_type(session: Session, client: TestClient):
    client.post("/rating_types/", json={"name": "interne_rating"})
    rating_types = session.scalars(select(RatingType)).all()
    assert len(rating_types) == 1
    rating_type = rating_types[0]
    assert rating_type.name == "interne_rating"
    for key in {"id", "created_at", "updated_at"}:
        assert key in dict(rating_type)


def test_get_rating_type(rating_type: RatingType, client: TestClient):
    response = client.get(f"/rating_types/{rating_type.name}/")
    response.raise_for_status()
    res_rating_type = response.json()
    assert res_rating_type == jsonable_encoder(rating_type)


def test_list_rating_types(rating_type_factory, client):
    r0, r1 = rating_type_factory(name="r0"), rating_type_factory(name="r1")
    response = client.get("/rating_types/")
    response.raise_for_status()
    rating_types = response.json()
    assert len(rating_types) == 2
    assert jsonable_encoder(r0) == rating_types[0]
    assert jsonable_encoder(r1) == rating_types[1]


def test_update_rating_type(rating_type, client, session):
    new_name = "foo"
    client.patch(f"/rating_types/{rating_type.name}/", json={"name": new_name})
    session.refresh(rating_type)
    assert rating_type.name == new_name


def test_delete_rating_type(rating_type, client, session):
    client.delete(f"/rating_types/{rating_type.name}/")
    assert len(session.scalars(select(RatingType)).all()) == 0
