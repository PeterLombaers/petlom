from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import constr
from sqlalchemy import Column
from sqlalchemy.orm import RelationshipProperty
from sqlalchemy.types import JSON
from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

from backend.competitions import CompetitionType
from backend.enums import Result
from backend.ratings import BaseRating, SimkroRating


class RatingAlgorithm(str, Enum):
    ELO = "elo"


# ---------------------------------------------------------------------------
# Competition rating type + rating
# ---------------------------------------------------------------------------


class CompetitionRatingType(SQLModel, table=True):
    """The configuration of the rating for a competition."""

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    algorithm: RatingAlgorithm
    algorithm_config: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON)
    )
    competition_name: str = Field(
        unique=True, foreign_key="competition.name", ondelete="CASCADE"
    )
    default_initial_rating: float | None = Field(
        default=None,
        description=(
            "Initial rating that should be used for players for which no manual rating"
            " is provided."
        ),
    )
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    competition: "Competition" = Relationship(back_populates="rating_type")
    competition_ratings: list["CompetitionRating"] = Relationship(
        back_populates="rating_type", cascade_delete=True
    )

    def get_rating_function(self) -> BaseRating:
        config = dict(self.algorithm_config or {})
        sequential = config.pop("sequential", True)
        if self.algorithm == RatingAlgorithm.ELO:
            return SimkroRating(sequential=sequential, **config)
        raise ValueError(f"Unknown algorithm: {self.algorithm}")


class CompetitionRatingTypeCreate(SQLModel):
    name: str | None = None
    algorithm: RatingAlgorithm
    algorithm_config: dict[str, Any] | None = None
    default_initial_rating: float | None = None


class CompetitionRatingTypePublic(SQLModel):
    id: int
    name: str
    algorithm: RatingAlgorithm
    algorithm_config: dict[str, Any] | None
    competition_name: str
    default_initial_rating: float | None
    created_at: datetime
    updated_at: datetime


class CompetitionRatingTypeUpdate(SQLModel):
    name: str | None = None
    algorithm: RatingAlgorithm | None = None
    algorithm_config: dict[str, Any] | None = None
    default_initial_rating: float | None = None


class CompetitionRating(SQLModel, table=True):
    """The competition rating of a player."""

    __table_args__ = (UniqueConstraint("player_id", "rating_type_id"),)
    id: int | None = Field(default=None, primary_key=True)
    player_id: int = Field(foreign_key="player.id", ondelete="CASCADE")
    rating_type_id: int = Field(
        foreign_key="competitionratingtype.id", ondelete="CASCADE"
    )
    initial_rating: float = Field(
        description="The initial rating for the player for this competition rating."
    )
    current_rating: float = Field(
        description="The current rating for the player for this competition rating."
    )
    is_manual: bool = Field(
        default=False, description="Has the initial rating been set manually?"
    )
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    player: "Player" = Relationship(back_populates="competition_ratings")
    rating_type: CompetitionRatingType = Relationship(
        back_populates="competition_ratings"
    )


class CompetitionRatingPublic(SQLModel):
    id: int
    player_id: int
    player: "PlayerPublicMinimal"
    rating_type_id: int
    initial_rating: float
    current_rating: float
    is_manual: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Player models
# ---------------------------------------------------------------------------


class PlayerBase(SQLModel):
    name: constr(strip_whitespace=True, min_length=1)  # type: ignore
    is_active: bool = True


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
    competition_ratings: list[CompetitionRating] = Relationship(
        back_populates="player", cascade_delete=True
    )

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        return isinstance(other, Player) and self.id == other.id


class PlayerCreate(PlayerBase):
    is_active: bool = True


class PlayerPublic(PlayerBase):
    id: int
    created_at: datetime
    updated_at: datetime


class PlayerPublicMinimal(SQLModel):
    name: str
    id: int
    is_active: bool


class PlayerUpdate(PlayerBase):
    name: constr(strip_whitespace=True, min_length=1) | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# Competition models
# ---------------------------------------------------------------------------


class CompetitionBase(SQLModel):
    name: str = Field(unique=True, primary_key=True)
    type: CompetitionType


class Competition(CompetitionBase, table=True):
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    matches: list["Match"] = Relationship(
        back_populates="competition", cascade_delete=True
    )
    rating_type: CompetitionRatingType | None = Relationship(
        back_populates="competition"
    )


class CompetitionPublic(CompetitionBase):
    created_at: datetime
    updated_at: datetime


class CompetitionCreate(CompetitionBase):
    rating_type: CompetitionRatingTypeCreate | None = None


class CompetitionPublicWithNRounds(CompetitionPublic):
    n_rounds: int
    rating_type: CompetitionRatingTypePublic | None = None


class PairingCreate(SQLModel):
    round_nr: int
    player_ids: list[int]


class CompetitionUpdate(CompetitionBase):
    name: str | None = None
    type: CompetitionType | None = None


# ---------------------------------------------------------------------------
# Match models
# ---------------------------------------------------------------------------


class MatchBase(SQLModel):
    __table_args__ = (UniqueConstraint("round", "board", "competition_name"),)
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
    player_white_id: int
    player_black_id: int
    player_white: PlayerPublicMinimal
    player_black: PlayerPublicMinimal
    competition_name: str
    round: int
    board: int
    result: Result | None


class MatchUpdate(MatchBase):
    player_white_id: int | None = None
    player_black_id: int | None = None
    competition_name: str | None = None
    round: int | None = None
    board: int | None = None
    result: Result | None = None


# ---------------------------------------------------------------------------
# RoundPlayer models
# ---------------------------------------------------------------------------


class RoundPlayer(SQLModel, table=True):
    """The registration of a player for a round of a competition.

    Database table for storing the registration of players for a round of a competition.
    They can then be retrieved and used to create a pairing."""

    __table_args__ = (UniqueConstraint("competition_name", "round", "player_id"),)
    id: int | None = Field(default=None, primary_key=True)
    competition_name: str = Field(foreign_key="competition.name", ondelete="CASCADE")
    round: int
    player_id: int = Field(foreign_key="player.id")
    is_bye: bool = False
    initial_rating: float | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    player: Player = Relationship()


class RoundPlayerPublic(SQLModel):
    id: int
    player: PlayerPublicMinimal
    is_bye: bool
    initial_rating: float | None


class RoundPlayerUpdate(SQLModel):
    player_ids_to_add: list[int] | None = None
    player_ids_to_remove: list[int] | None = None
    bye_player_id: int | None = None
    clear_bye: bool | None = None
    initial_ratings: dict[int, float] | None = None


# ---------------------------------------------------------------------------
# SimKro ranking (output-only model)
# ---------------------------------------------------------------------------


class SimkroRank(SQLModel):
    position: int
    player: PlayerPublic
    games_played: int
    saldo: int
    points: int
    color_saldo: int
    wins: int
    draws: int
    losses: int
    current_rating: float | None = None


# ---------------------------------------------------------------------------
# Moderator (auth)
# ---------------------------------------------------------------------------


class Moderator(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.now)


class ModeratorPublic(SQLModel):
    id: int
    username: str
