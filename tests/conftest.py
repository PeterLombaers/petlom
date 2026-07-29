import os
from collections.abc import Callable, Generator
from typing import Any

import factory
import pytest
from faker import Faker
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from backend.auth import create_access_token, hash_password
from backend.competitions import CompetitionType
from backend.dependencies import get_session
from backend.enums import ExternalRatingSource
from backend.main import app
from backend.models import (
    Competition,
    CompetitionRatingType,
    ExternalRating,
    Match,
    Moderator,
    Player,
    PlayerExternalId,
    RatingAlgorithm,
    Result,
)

fake = Faker()


def pytest_addoption(parser: pytest.Parser):
    parser.addoption(
        "--external",
        action="store_true",
        default=False,
        help="Run tests marked 'external' against the real external rating APIs",
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]):
    if config.getoption("--external") or os.environ.get(
        "EXTERNAL_TESTS", ""
    ).lower() in ("1", "true", "yes"):
        return
    skip = pytest.mark.skip(reason="needs --external or EXTERNAL_TESTS=true")
    for item in items:
        if "external" in item.keywords:
            item.add_marker(skip)


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


@pytest.fixture
def moderator_password() -> str:
    return "testpass"


@pytest.fixture
def moderator(session: Session, moderator_password: str) -> Moderator:
    mod = Moderator(
        username="testmod", hashed_password=hash_password(moderator_password)
    )
    session.add(mod)
    session.commit()
    session.refresh(mod)
    return mod


@pytest.fixture
def auth_client(client: TestClient, moderator: Moderator) -> TestClient:
    token = create_access_token({"sub": moderator.username})
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


def CompetitionFactory(session: Session) -> Callable[..., Competition]:
    class CompetitionFactory(factory.alchemy.SQLAlchemyModelFactory):
        class Meta:
            model = Competition
            sqlalchemy_session = session
            sqlalchemy_session_persistence = "commit"

        name = "interne_2024"
        type = CompetitionType.SIMKRO

    return CompetitionFactory


@pytest.fixture
def competition(session: Session) -> Generator[Competition, Any, None]:
    comp = CompetitionFactory(session)()
    session.add(
        CompetitionRatingType(
            name=f"{comp.name}_rating",
            algorithm=RatingAlgorithm.ELO,
            competition_id=comp.id,
            default_initial_rating=1500.0,
        )
    )
    session.commit()
    session.refresh(comp)
    yield comp


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


def PlayerExternalIdFactory(session: Session) -> Callable[..., PlayerExternalId]:
    class PlayerExternalIdFactory(factory.alchemy.SQLAlchemyModelFactory):
        class Meta:
            model = PlayerExternalId
            sqlalchemy_session = session
            sqlalchemy_session_persistence = "commit"

        player = factory.SubFactory(PlayerFactory(session))
        source = ExternalRatingSource.FIDE
        external_id = factory.Sequence(lambda n: str(1000000 + n))

    return PlayerExternalIdFactory


@pytest.fixture
def player_external_id_factory(
    session: Session,
) -> Generator[Callable[..., PlayerExternalId], Any, None]:
    yield PlayerExternalIdFactory(session)


def ExternalRatingFactory(session: Session) -> Callable[..., ExternalRating]:
    class ExternalRatingFactory(factory.alchemy.SQLAlchemyModelFactory):
        class Meta:
            model = ExternalRating
            sqlalchemy_session = session
            sqlalchemy_session_persistence = "commit"

        player_external_id = factory.SubFactory(PlayerExternalIdFactory(session))
        rating = 1800.0
        list_date = "2026-06"

    return ExternalRatingFactory


@pytest.fixture
def external_rating_factory(
    session: Session,
) -> Generator[Callable[..., ExternalRating], Any, None]:
    yield ExternalRatingFactory(session)


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


@pytest.fixture
def simkro_setup(
    competition: Competition,
    player_factory: Callable[..., Player],
    match_factory: Callable[..., Match],
) -> Generator[tuple[Competition, list[Player], list[Match]], Any, None]:
    players = [player_factory() for _ in range(8)]
    matches = [
        match_factory(
            player_white=players[0],
            player_black=players[1],
            result=Result.WHITE_WIN,
            competition=competition,
            round=1,
            board=1,
        ),
        match_factory(
            player_white=players[2],
            player_black=players[3],
            result=Result.DRAW,
            competition=competition,
            round=1,
            board=2,
        ),
        match_factory(
            player_white=players[4],
            player_black=players[5],
            result=Result.BLACK_WIN,
            competition=competition,
            round=1,
            board=3,
        ),
        match_factory(
            player_white=players[0],
            player_black=players[5],
            result=Result.DRAW,
            competition=competition,
            round=2,
            board=1,
        ),
        match_factory(
            player_white=players[2],
            player_black=players[6],
            result=Result.BLACK_WIN,
            competition=competition,
            round=2,
            board=2,
        ),
        match_factory(
            player_white=players[3],
            player_black=players[7],
            result=Result.WHITE_WIN,
            competition=competition,
            round=2,
            board=3,
        ),
        match_factory(
            player_white=players[1],
            player_black=players[4],
            result=Result.BLACK_WIN,
            competition=competition,
            round=2,
            board=4,
        ),
        match_factory(
            player_white=players[6],
            player_black=players[0],
            result=Result.WHITE_WIN,
            competition=competition,
            round=3,
            board=1,
        ),
        match_factory(
            player_white=players[7],
            player_black=players[2],
            result=Result.DRAW,
            competition=competition,
            round=3,
            board=2,
        ),
        match_factory(
            player_white=players[5],
            player_black=players[6],
            result=Result.BLACK_WIN,
            competition=competition,
            round=4,
            board=1,
        ),
        match_factory(
            player_white=players[2],
            player_black=players[1],
            result=Result.DRAW,
            competition=competition,
            round=4,
            board=2,
        ),
        match_factory(
            player_white=players[4],
            player_black=players[0],
            result=Result.BLACK_WIN,
            competition=competition,
            round=4,
            board=3,
        ),
        match_factory(
            player_white=players[3],
            player_black=players[7],
            result=Result.DRAW,
            competition=competition,
            round=4,
            board=4,
        ),
    ]
    yield (competition, players, matches)
