from typing import Any, Callable, Generator

import factory
import pytest
from faker import Faker
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from backend.main import app, get_session
from backend.models import Competition, Match, Player, RatingType

fake = Faker()


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


def RatingTypeFactory(session: Session) -> Callable[..., RatingType]:
    class RatingTypeFactory(factory.alchemy.SQLAlchemyModelFactory):
        class Meta:
            model = RatingType
            sqlalchemy_session = session
            sqlalchemy_session_persistence = "commit"

        name = "interne"

    return RatingTypeFactory


@pytest.fixture
def rating_type(session: Session) -> Generator[RatingType, Any, None]:
    yield RatingTypeFactory(session)()


@pytest.fixture
def rating_type_factory(
    session: Session,
) -> Generator[Callable[..., RatingType], Any, None]:
    yield RatingTypeFactory(session=session)


def CompetitionFactory(session: Session) -> Callable[..., Competition]:
    class CompetitionFactory(factory.alchemy.SQLAlchemyModelFactory):
        class Meta:
            model = Competition
            sqlalchemy_session = session
            sqlalchemy_session_persistence = "commit"

        name = "interne_2024"

    return CompetitionFactory


@pytest.fixture
def competition(session: Session) -> Generator[Competition, Any, None]:
    yield CompetitionFactory(session)()


@pytest.fixture
def competition_factory(
    session: Session,
) -> Generator[Callable[..., Competition], Any, None]:
    yield CompetitionFactory(session)


def PlayerFactory(session: Session) -> Callable[..., Player]:
    class PlayerFactory(factory.alchemy.SQLAlchemyModelFactory):
        class Meta:
            model = Player
            sqlalchemy_session = session
            sqlalchemy_session_persistence = "commit"

        name = factory.Sequence(lambda _: fake.name())

    return PlayerFactory


@pytest.fixture
def player(session: Session) -> Generator[Player, Any, None]:
    yield PlayerFactory(session)()


@pytest.fixture
def player_factory(
    session: Session,
) -> Generator[Callable[..., Player], Any, None]:
    yield PlayerFactory(session)


def MatchFactory(session: Session) -> Callable[..., Match]:
    class MatchFactory(factory.alchemy.SQLAlchemyModelFactory):
        class Meta:
            model = Match
            sqlalchemy_session = session
            sqlalchemy_session_persistence = "commit"

        competition = factory.SubFactory(CompetitionFactory(session))
        player_white = factory.SubFactory(PlayerFactory(session))
        player_black = factory.SubFactory(PlayerFactory(session))
        round = factory.Sequence(lambda n: n % 10 + 1)
        board = factory.Sequence(lambda n: n // 10 + 1)

    return MatchFactory


@pytest.fixture
def match_obj(session: Session) -> Generator[Match, Any, None]:
    yield MatchFactory(session)()


@pytest.fixture
def match_factory(
    session: Session,
) -> Generator[Callable[..., Match], Any, None]:
    yield MatchFactory(session)
