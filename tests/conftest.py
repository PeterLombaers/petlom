from typing import Any, Generator

import factory
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from backend.main import app, get_session
from backend.models import RatingType


@pytest.fixture
def session() -> Generator[Session, Any, None]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(session: Session) -> Generator[TestClient, Any, None]:
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override

    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def RatingTypeFactory(session):
    class RatingTypeFactory(factory.alchemy.SQLAlchemyModelFactory):
        class Meta:
            model = RatingType
            sqlalchemy_session = session

        name = "interne"

    return RatingTypeFactory


@pytest.fixture
def rating_type(session: Session):
    yield RatingTypeFactory(session)()


@pytest.fixture
def rating_type_factory(session: Session):
    yield RatingTypeFactory(session=session)


# @pytest.fixture
# def rating_type(session: Session) -> Generator[RatingType, Any, None]:
#     rating_type = RatingType(name="interne_rating")
#     session.add(rating_type)
#     session.commit()
#     session.refresh(rating_type)
#     yield rating_type
#     session.delete(rating_type)
#     session.commit()
