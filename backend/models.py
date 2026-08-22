from datetime import UTC, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import constr, field_validator
from sqlalchemy import Column
from sqlalchemy.orm import RelationshipProperty
from sqlalchemy.types import JSON
from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

from backend.competitions import CompetitionType
from backend.enums import ExternalRatingSource, Result
from backend.ratings import BaseRating, SimkroRating

# ---------------------------------------------------------------------------
# Naming convention
# ---------------------------------------------------------------------------
#
# Every model's purpose should be readable from its name:
#
#   <Entity>Base    Fields shared between the table and the write schemas.
#                   Never a request or response type itself.
#   <Entity>        The database table (table=True).
#   <Entity>Create  Request body of the POST that creates it.
#   <Entity>Update  Request body of the PATCH. Every field optional; does not
#                   inherit Base.
#   <Entity>Ref     Minimal reference (id + display fields), used when the
#                   entity appears inside another response.
#   <Entity>Public  Standard read response, for both list and single GET.
#   <Entity>Detail  The richer single-object response, where one exists.
#
# Every schema model carries a one-line docstring naming the endpoint that
# returns or accepts it.


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    competition: "Competition" = Relationship(back_populates="rating_type")
    competition_ratings: list["CompetitionRating"] = Relationship(
        back_populates="rating_type", cascade_delete=True
    )

    @property
    def competition_name(self) -> str:
        """Competitions are addressed by name in the API, by id in the database."""
        return self.competition.name

    def build_rating_algorithm(self) -> BaseRating:
        config = dict(self.algorithm_config or {})
        sequential = config.pop("sequential", True)
        if self.algorithm == RatingAlgorithm.ELO:
            return SimkroRating(sequential=sequential, **config)
        raise ValueError(f"Unknown algorithm: {self.algorithm}")


class CompetitionRatingTypeCreate(SQLModel):
    """The rating configuration nested in the body of POST /competitions/."""

    name: str | None = None
    algorithm: RatingAlgorithm
    algorithm_config: dict[str, Any] | None = None
    default_initial_rating: float | None = None


class CompetitionRatingTypePublic(SQLModel):
    """The rating configuration nested in a CompetitionDetail or a rating response."""

    id: int
    name: str
    algorithm: RatingAlgorithm
    algorithm_config: dict[str, Any] | None
    competition_name: str
    default_initial_rating: float | None
    created_at: datetime
    updated_at: datetime


class CompetitionRatingTypeUpdate(SQLModel):
    """Request body of PATCH /competitions/{name}/rating."""

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    player: "Player" = Relationship(back_populates="competition_ratings")
    rating_type: CompetitionRatingType = Relationship(
        back_populates="competition_ratings"
    )


class CompetitionRatingPublic(SQLModel):
    """A rating as returned by GET /competitions/{name}/player-ratings.

    Seen from the competition's side: it keeps the player and drops the rating
    type, which is the same for every row. Its sibling is
    CompetitionRatingForPlayer.
    """

    id: int
    player_id: int
    player: "PlayerRef"
    rating_type_id: int
    initial_rating: float
    current_rating: float
    is_manual: bool
    source_external_rating_id: int | None
    created_at: datetime
    updated_at: datetime


class CompetitionRatingForPlayer(SQLModel):
    """A rating as nested in the PlayerDetail returned by GET /players/{id}/.

    Seen from the player's side: it keeps the rating type (which names the
    competition) and drops the player. Its sibling is CompetitionRatingPublic.
    """

    id: int
    initial_rating: float
    current_rating: float
    is_manual: bool
    source_external_rating_id: int | None
    rating_type: CompetitionRatingTypePublic


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

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
    imported_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    player_external_id: PlayerExternalId = Relationship(
        back_populates="external_ratings"
    )


class PlayerExternalIdCreate(SQLModel):
    """An external id nested in the body of POST /players/."""

    source: ExternalRatingSource
    external_id: constr(strip_whitespace=True, min_length=1)  # type: ignore


class ExternalRatingPublic(SQLModel):
    """A rating snapshot as returned by GET /players/{id}/external-ratings/."""

    id: int
    player_external_id_id: int
    source: ExternalRatingSource
    rating: float
    list_date: str
    imported_at: datetime


class PlayerExternalIdPublic(SQLModel):
    """A player's id at an external source, as returned inside a player response.

    `rating` is the snapshot selected by the request's `list_date`: the newest
    snapshot at or before that date, or the newest one overall when no date is
    given. It is None when no snapshot has been imported yet.
    """

    id: int
    source: ExternalRatingSource
    external_id: str
    created_at: datetime
    updated_at: datetime
    rating: ExternalRatingPublic | None = None


class PlayerExternalIdUpdate(SQLModel):
    """Request body of PUT /players/{id}/external-ids/{source}/."""

    external_id: constr(strip_whitespace=True, min_length=1)  # type: ignore


class ExternalRatingImportRequest(SQLModel):
    """Request body of POST /external/{source}/import/."""

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
    """Response of POST /external/{source}/import/."""

    list_date: str
    imported: int
    updated: int
    skipped: int = 0
    not_found: list[str] = []
    players_without_id: list[int] = []


class ExternalIdMatchRequest(SQLModel):
    """Request body of POST /external/{source}/match/."""

    player_ids: list[int] | None = Field(
        default=None,
        description=(
            "Players to search for. Defaults to every player without an"
            " external id for the source. Players that already have one are"
            " never searched: matching only fills gaps, it never overwrites."
        ),
    )


class ExternalIdMatchPublic(SQLModel):
    """A player that was matched to exactly one player at the source."""

    player_id: int
    player_name: str
    external_id: str
    external_name: str


class ExternalIdMatchSkip(SQLModel):
    """A player that was searched for but not matched, and why.

    - ambiguous: several players at the source carry this name.
    - not_found: none do.
    - taken: the one that does is already another Petlom player's external id.
    """

    player_id: int
    player_name: str
    reason: Literal["ambiguous", "not_found", "taken"]


class ExternalIdMatchResult(SQLModel):
    """Response of POST /external/{source}/match/."""

    source: ExternalRatingSource
    searched: int
    matched: list[ExternalIdMatchPublic] = []
    skipped: list[ExternalIdMatchSkip] = []


# ---------------------------------------------------------------------------
# Player models
# ---------------------------------------------------------------------------


class PlayerBase(SQLModel):
    name: constr(strip_whitespace=True, min_length=1)  # type: ignore
    is_active: bool = True


class Player(PlayerBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
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
    """Request body of POST /players/."""

    external_ids: list[PlayerExternalIdCreate] = []


class PlayerPublic(PlayerBase):
    """A player as returned by GET /players/ and the player write endpoints."""

    id: int
    created_at: datetime
    updated_at: datetime
    external_ids: list[PlayerExternalIdPublic] = []


class PlayerRef(SQLModel):
    """A player as nested in a match, a registration or a competition rating."""

    name: str
    id: int
    is_active: bool


class PlayerUpdate(SQLModel):
    """Request body of PATCH /players/{id}/."""

    name: constr(strip_whitespace=True, min_length=1) | None = None  # type: ignore
    is_active: bool | None = None


class PlayerMerge(SQLModel):
    """Request body of POST /players/{id}/merge/."""

    other_id: int = Field(
        description="The player to absorb; they are deleted by the merge."
    )
    name: constr(strip_whitespace=True, min_length=1) | None = Field(  # type: ignore
        default=None,
        description=(
            "The name the surviving player keeps. Defaults to the name they"
            " already have."
        ),
    )


class PlayerDetail(PlayerPublic):
    """A player as returned by GET /players/{id}/."""

    competition_ratings: list[CompetitionRatingForPlayer] = []


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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    matches: list["Match"] = Relationship(
        back_populates="competition", cascade_delete=True
    )
    rating_type: CompetitionRatingType = Relationship(
        back_populates="competition", cascade_delete=True
    )


class CompetitionPublic(CompetitionBase):
    """A competition as returned by GET /competitions/."""

    created_at: datetime
    updated_at: datetime


class CompetitionCreate(CompetitionBase):
    """Request body of POST /competitions/."""

    rating_type: CompetitionRatingTypeCreate


class CompetitionDetail(CompetitionPublic):
    """A competition as returned by GET /competitions/{name} and the write endpoints."""

    n_rounds: int
    rating_type: CompetitionRatingTypePublic


class PairingCreate(SQLModel):
    """Request body of POST /competitions/{name}/pairing."""

    round_nr: int
    player_ids: list[int] = Field(min_length=2)

    @field_validator("player_ids")
    @classmethod
    def check_player_ids(cls, player_ids: list[int]) -> list[int]:
        duplicates = sorted({i for i in player_ids if player_ids.count(i) > 1})
        if duplicates:
            raise ValueError(f"Player ids should be unique. Duplicates: {duplicates}")
        if len(player_ids) % 2 == 1:
            raise ValueError(
                f"Number of players should be even. Got {len(player_ids)}."
                " Leave out the player that gets a bye."
            )
        return player_ids


class CompetitionUpdate(SQLModel):
    """Request body of PATCH /competitions/{name}."""

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

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


class MatchCreate(MatchBase):
    """Request body of POST /matches/."""


class MatchPublic(MatchBase):
    """A match as returned by GET /matches/ and the match write endpoints."""

    id: int
    created_at: datetime
    updated_at: datetime
    player_white: PlayerRef
    player_black: PlayerRef


class MatchUpdate(SQLModel):
    """Request body of PATCH /matches/{id}/."""

    player_white_id: int | None = None
    player_black_id: int | None = None
    competition_name: str | None = None
    round: int | None = None
    board: int | None = None
    result: Result | None = None


# ---------------------------------------------------------------------------
# RoundRegistration models
# ---------------------------------------------------------------------------


class RoundRegistration(SQLModel, table=True):
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    player: Player = Relationship()


class RoundRegistrationPublic(SQLModel):
    """A round registration as returned by GET /competitions/{name}/registrations."""

    id: int
    player: PlayerRef
    is_bye: bool
    initial_rating: float | None


class RoundRegistrationUpdate(SQLModel):
    """Request body of PATCH /competitions/{name}/registrations."""

    player_ids_to_add: list[int] | None = None
    player_ids_to_remove: list[int] | None = None
    bye_player_id: int | None = None
    clear_bye: bool | None = None
    initial_ratings: dict[int, float] | None = None


# ---------------------------------------------------------------------------
# SimKro ranking (output-only model)
# ---------------------------------------------------------------------------


class SimkroRank(SQLModel):
    """A ranking row as returned by GET|POST /competitions/{name}/ranking."""

    position: int
    player: PlayerRef
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ModeratorPublic(SQLModel):
    """A moderator as returned by GET /auth/me."""

    id: int
    username: str
