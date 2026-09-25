from enum import Enum


class Result(str, Enum):
    WHITE_WIN = "1-0"
    DRAW = "1/2-1/2"
    BLACK_WIN = "0-1"


class ExternalRatingSource(str, Enum):
    FIDE = "fide"
    KNSB = "knsb"


class Role(str, Enum):
    """What a logged-in account is allowed to do.

    `RESULT_KEEPER` may only set the result of an existing match; every other
    write endpoint is `MODERATOR`-only. Enforced in `backend/auth.py`.
    """

    MODERATOR = "moderator"
    RESULT_KEEPER = "result_keeper"


class PlayerStatus(str, Enum):
    """Which side of the soft-delete flag a player listing asks for."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    ALL = "all"
