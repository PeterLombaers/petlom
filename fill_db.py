import factory
from faker import Faker
from sqlmodel import Session, create_engine

from backend.competitions import CompetitionType
from backend.models import Competition, Match, Player, Result

fake = Faker()
engine = create_engine(
    "sqlite:///database.db",
    connect_args={"check_same_thread": False},
)
session = Session(engine)



class CompetitionFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = Competition
        sqlalchemy_session = session
        sqlalchemy_session_persistence = "commit"

    name = "interne_2024"
    type = CompetitionType.SIMKRO


class PlayerFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = Player
        sqlalchemy_session = session
        sqlalchemy_session_persistence = "commit"

    name = factory.Sequence(lambda _: fake.name())


class MatchFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = Match
        sqlalchemy_session = session
        sqlalchemy_session_persistence = "commit"

    competition = factory.SubFactory(CompetitionFactory)
    player_white = factory.SubFactory(PlayerFactory)
    player_black = factory.SubFactory(PlayerFactory)
    round = factory.Sequence(lambda n: n % 10 + 1)
    board = factory.Sequence(lambda n: n // 10 + 1)


competition = CompetitionFactory()
players = [PlayerFactory() for _ in range(8)]
matches = [
    MatchFactory(
        player_white=players[0],
        player_black=players[1],
        result=Result.WHITE_WIN,
        competition=competition,
        round=1,
        board=1,
    ),
    MatchFactory(
        player_white=players[2],
        player_black=players[3],
        result=Result.DRAW,
        competition=competition,
        round=1,
        board=2,
    ),
    MatchFactory(
        player_white=players[4],
        player_black=players[5],
        result=Result.BLACK_WIN,
        competition=competition,
        round=1,
        board=3,
    ),
    MatchFactory(
        player_white=players[0],
        player_black=players[5],
        result=Result.DRAW,
        competition=competition,
        round=2,
        board=1,
    ),
    MatchFactory(
        player_white=players[2],
        player_black=players[6],
        result=Result.BLACK_WIN,
        competition=competition,
        round=2,
        board=2,
    ),
    MatchFactory(
        player_white=players[3],
        player_black=players[7],
        result=Result.WHITE_WIN,
        competition=competition,
        round=2,
        board=3,
    ),
    MatchFactory(
        player_white=players[1],
        player_black=players[4],
        result=Result.BLACK_WIN,
        competition=competition,
        round=2,
        board=4,
    ),
    MatchFactory(
        player_white=players[6],
        player_black=players[0],
        result=Result.WHITE_WIN,
        competition=competition,
        round=3,
        board=1,
    ),
    MatchFactory(
        player_white=players[7],
        player_black=players[2],
        result=Result.DRAW,
        competition=competition,
        round=3,
        board=2,
    ),
    MatchFactory(
        player_white=players[5],
        player_black=players[6],
        result=Result.BLACK_WIN,
        competition=competition,
        round=4,
        board=1,
    ),
    MatchFactory(
        player_white=players[2],
        player_black=players[1],
        result=Result.DRAW,
        competition=competition,
        round=4,
        board=2,
    ),
    MatchFactory(
        player_white=players[4],
        player_black=players[0],
        result=Result.BLACK_WIN,
        competition=competition,
        round=4,
        board=3,
    ),
    MatchFactory(
        player_white=players[3],
        player_black=players[7],
        result=Result.DRAW,
        competition=competition,
        round=4,
        board=4,
    ),
]
