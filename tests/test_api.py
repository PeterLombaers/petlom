from sqlmodel import Session, select
from backend.models import RatingType
from fastapi.testclient import TestClient


def test_create_rating_type(session: Session, client: TestClient):
    client.post("/rating_types/", json={"name": "interne_rating"})
    rating_types = session.scalars(select(RatingType)).all()
    assert len(rating_types) == 1
    rating_type = rating_types[0]
    assert rating_type.name == "interne_rating"
    for key in {"id", "created_at", "updated_at"}:
        assert key in dict(rating_type)
