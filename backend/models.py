from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import constr
from sqlalchemy import Column
from sqlalchemy.orm import RelationshipProperty
from sqlalchemy.types import JSON
from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

from backend.competitions import CompetitionType
from backend.enums import ExternalRatingSource, Result
from backend.ratings import BaseRating, SimkroRating


class RatingAlgorithm(str, Enum):
    ELO = "elo"


# ---------------------------------------------------------------------------
# Competition rating type + rating
# ---------------------------------------------------------------------------


class CompetitionRatingType(SQLModel, table=True):
    """The configuration of the rating for a competition."""

    id: int | None = Field(default=None, primary_key=True)
    name: str
    algorithm: RatingAlgorithm
    algorithm_config: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON)
    )
    competition_id: int = Field(
        unique=True, foreign_key="competition.id", ondelete="CASCADE"
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

    @property
    def competition_name(self) -> str:
        """Competitions are addressed by name in the API, by id in the database."""
        return self.competition.name

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
    source_external_rating_id: int | None = Field(
        default=None,
        foreign_key="externalrating.id",
        ondelete="SET NULL",
        description=(
            "The external rating snapshot the initial rating was based on, if any."
        ),
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
    source_external_rating_id: int | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# External identifiers + ratings
# ---------------------------------------------------------------------------


LIST_DATE_PATTERN = r"^\d{4}-\d{2}$"


class PlayerExternalId(SQLModel, table=True):
    """The identifier of a player at an external rating source (e.g. FIDE id)."""

    __table_args__ = (
        UniqueConstraint("player_id", "source"),
        UniqueConstraint("source", "external_id"),
    )
    id: int | None = Field(default=None, primary_key=True)
    player_id: int = Field(foreign_key="player.id", ondelete="CASCADE")
    source: ExternalRatingSource
    external_id: constr(strip_whitespace=True, min_length=1)  # type: ignore
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    player: "Player" = Relationship(back_populates="external_ids")
    external_ratings: list["ExternalRating"] = Relationship(
        back_populates="player_external_id", cascade_delete=True
    )


class ExternalRating(SQLModel, table=True):
    """A snapshot of a player's rating at an external source at a list date.

    FIDE and KNSB ratings are integers; stored as float for consistency with
    CompetitionRating."""

    __table_args__ = (UniqueConstraint("player_external_id_id", "list_date"),)
    id: int | None = Field(default=None, primary_key=True)
    player_external_id_id: int = Field(
        foreign_key="playerexternalid.id", ondelete="CASCADE"
    )
    rating: float
    list_date: constr(pattern=LIST_DATE_PATTERN)  # type: ignore
    imported_at: datetime = Field(default_factory=datetime.now)

    player_external_id: PlayerExternalId = Relationship(
        back_populates="external_ratings"
    )


class PlayerExternalIdInput(SQLModel):
    source: ExternalRatingSource
    external_id: constr(strip_whitespace=True, min_length=1)  # type: ignore


class PlayerExternalIdPublic(SQLModel):
    id: int
    source: ExternalRatingSource
    external_id: str
    created_at: datetime
    updated_at: datetime


class PlayerExternalIdUpdate(SQLModel):
    external_id: constr(strip_whitespace=True, min_length=1)  # type: ignore


class ExternalRatingPublic(SQLModel):
    id: int
    player_external_id_id: int
    source: ExternalRatingSource
    rating: float
    list_date: str
    imported_at: datetime


class ExternalRatingImportRequest(SQLModel):
    player_ids: list[int] | None = Field(
        default=None,
        description=(
            "Players to import ratings for. Defaults to all players with an"
            " external id for the source."
        ),
    )
    list_date: constr(pattern=LIST_DATE_PATTERN) | None = None  # type: ignore
    update_existing: bool = Field(
        default=False,
        description=(
            "Also fetch ratings for players that already have a snapshot at"
            " the list date, overwriting it. Defaults to skipping those"
            " players."
        ),
    )


class ExternalRatingImportResult(SQLModel):
    list_date: str
    imported: int
    updated: int
    skipped: int = 0
    not_found: list[str] = []
    players_without_id: list[int] = []


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
    external_ids: list[PlayerExternalId] = Relationship(
        back_populates="player", cascade_delete=True
    )

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        return isinstance(other, Player) and self.id == other.id


class PlayerCreate(PlayerBase):
    is_active: bool = True
    external_ids: list[PlayerExternalIdInput] = []


class PlayerPublic(PlayerBase):
    id: int
    created_at: datetime
    updated_at: datetime
    external_ids: list[PlayerExternalIdPublic] = []


class PlayerPublicMinimal(SQLModel):
    name: str
    id: int
    is_active: bool


class PlayerUpdate(PlayerBase):
    name: constr(strip_whitespace=True, min_length=1) | None = None
    is_active: bool | None = None


class PlayerCompetitionRatingPublic(SQLModel):
    """A competition rating as seen from the player's perspective."""

    id: int
    initial_rating: float
    current_rating: float
    is_manual: bool
    source_external_rating_id: int | None
    rating_type: CompetitionRatingTypePublic


class PlayerDetailPublic(PlayerPublic):
    competition_ratings: list[PlayerCompetitionRatingPublic] = []


# ---------------------------------------------------------------------------
# Competition models
# ---------------------------------------------------------------------------


class CompetitionBase(SQLModel):
    name: str = Field(unique=True, index=True)
    type: CompetitionType


class Competition(CompetitionBase, table=True):
    # A surrogate key, so that renaming a competition does not have to be
    # cascaded to every table that references it.
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    matches: list["Match"] = Relationship(
        back_populates="competition", cascade_delete=True
    )
    rating_type: CompetitionRatingType = Relationship(
        back_populates="competition", cascade_delete=True
    )


class CompetitionPublic(CompetitionBase):
    created_at: datetime
    updated_at: datetime


class CompetitionCreate(CompetitionBase):
    rating_type: CompetitionRatingTypeCreate


class CompetitionPublicWithNRounds(CompetitionPublic):
    n_rounds: int
    rating_type: CompetitionRatingTypePublic


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
    """The API shape of a match, which addresses the competition by name."""

    player_white_id: int
    player_black_id: int
    competition_name: str
    round: int
    board: int
    result: Result | None = None


class Match(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("round", "board", "competition_id"),)
    id: int | None = Field(default=None, primary_key=True)
    player_white_id: int = Field(foreign_key="player.id")
    player_black_id: int = Field(foreign_key="player.id")
    competition_id: int = Field(foreign_key="competition.id", ondelete="CASCADE")
    round: int
    board: int
    result: Result | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    @property
    def competition_name(self) -> str:
        return self.competition.name

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
    player_white: PlayerPublicMinimal
    player_black: PlayerPublicMinimal


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

    __table_args__ = (UniqueConstraint("competition_id", "round", "player_id"),)
    id: int | None = Field(default=None, primary_key=True)
    competition_id: int = Field(foreign_key="competition.id", ondelete="CASCADE")
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
