from enum import Enum

from sqlalchemy.orm import RelationshipProperty
from sqlmodel import Field, Relationship, SQLModel


class Result(str, Enum):
    WHITE_WIN = "1-0"
    DRAW = "1/2-1/2"
    BLACK_WIN = "0-1"


class Player(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    rating: float

    matches_white: list["Match"] = Relationship(
        # sqlmodel has trouble with two relationships to the same table.
        # This solution is from: https://github.com/fastapi/sqlmodel/issues/10
        sa_relationship=RelationshipProperty(
            "Match",
            back_populates="player_white",
            foreign_keys="[Match.player_white_id]",
        )
    )
    matches_black: list["Match"] = Relationship(
        sa_relationship=RelationshipProperty(
            "Match",
            back_populates="player_black",
            foreign_keys="[Match.player_black_id]",
        )
    )


class Competition(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    matches: list["Match"] = Relationship(back_populates="competition")


class Match(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    player_white_id: int = Field(foreign_key="player.id")
    player_black_id: int = Field(foreign_key="player.id")
    competition_id: int = Field(foreign_key="competition.id")
    round: int
    board: int
    result: Result | None = None

    player_white: Player = Relationship(
        sa_relationship=RelationshipProperty(
            "Player",
            back_populates="matches_white",
            foreign_keys="[Match.player_white_id]",
        )
    )
    player_black: Player = Relationship(
        sa_relationship=RelationshipProperty(
            "Player",
            back_populates="matches_black",
            foreign_keys="[Match.player_black_id]",
        )
    )
    competition: Competition = Relationship(back_populates="matches")
