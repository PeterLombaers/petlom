from datetime import datetime
from enum import Enum

from sqlalchemy.orm import RelationshipProperty
from sqlmodel import Field, Relationship, SQLModel


class Result(str, Enum):
    WHITE_WIN = "1-0"
    DRAW = "1/2-1/2"
    BLACK_WIN = "0-1"


class RatingTypeBase(SQLModel):
    name: str = Field(primary_key=True)


class RatingType(RatingTypeBase, table=True):
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    ratings: list["PlayerRating"] = Relationship(
        back_populates="rating_type", cascade_delete=True
    )


class RatingTypePublic(RatingTypeBase):
    created_at: datetime
    updated_at: datetime


class RatingTypeUpdate(RatingTypeBase):
    name: str | None = None


class PlayerRatingUpdate(SQLModel):
    rating_type_name: str
    rating: float


class PlayerRating(SQLModel, table=True):
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    player_id: int = Field(
        foreign_key="player.id", primary_key=True, ondelete="CASCADE"
    )
    player: "Player" = Relationship(back_populates="ratings")
    rating_type_name: str = Field(
        foreign_key="ratingtype.name", primary_key=True, ondelete="CASCADE"
    )
    rating_type: RatingType = Relationship()
    rating: float


class PlayerBase(SQLModel):
    name: str


class Player(PlayerBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
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
    ratings: list[PlayerRating] = Relationship(
        back_populates="player", cascade_delete=True
    )


class PlayerCreate(PlayerBase):
    ratings: list[PlayerRatingUpdate] | None = None


class PlayerPublic(PlayerBase):
    id: int
    created_at: datetime
    updated_at: datetime
    ratings: list[PlayerRating]


class PlayerUpdate(PlayerBase):
    name: str = None
    ratings: list[PlayerRatingUpdate] | None = None


class CompetitionBase(SQLModel):
    name: str = Field(unique=True, primary_key=True)


class Competition(CompetitionBase, table=True):
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    matches: list["Match"] = Relationship(
        back_populates="competition", cascade_delete=True
    )


class CompetitionPublic(CompetitionBase):
    created_at: datetime
    updated_at: datetime
    matches: list["Match"]


class CompetitionUpdate(CompetitionBase):
    name: str | None = None


class MatchBase(SQLModel):
    player_white_id: int = Field(foreign_key="player.id")
    player_black_id: int = Field(foreign_key="player.id")
    competition_name: str = Field(foreign_key="competition.name", ondelete="CASCADE")
    round: int
    board: int
    result: Result | None = None


class Match(MatchBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

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


class MatchPublic(MatchBase):
    id: int
    created_at: datetime
    updated_at: datetime
    player_white: Player
    player_black: Player
    competition: Competition
    round: int
    board: int
    result: Result | None


class MatchUpdate(MatchBase):
    player_white: Player | None = None
    player_black: Player | None = None
    competition_name: str | None = None
    round: int | None = None
    board: int | None = None
    result: Result | None = None
