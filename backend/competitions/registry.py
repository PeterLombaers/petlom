"""Which players make up the field of a round.

The field comes from a different place per competition type: for SimKro it is the
round's registrations minus the bye, for a round robin the entry list fixed before
the first round, for a knockout the winners of the previous round. Only SimKro
exists today; a new type adds an entry to `_RESOLVERS`.
"""

from collections.abc import Callable

from fastapi import HTTPException
from sqlmodel import Session, col, select

from backend.competitions import CompetitionType
from backend.models import Competition, Player, RoundRegistration


def _simkro_round_field(
    competition: Competition, round_nr: int, session: Session
) -> list[Player]:
    registrations = session.exec(
        select(RoundRegistration)
        .where(
            RoundRegistration.competition_id == competition.id,
            RoundRegistration.round == round_nr,
        )
        .order_by(col(RoundRegistration.id))
    ).all()
    players = [reg.player for reg in registrations if not reg.is_bye]

    inactive = sorted(p.name for p in players if not p.is_active)
    if inactive:
        raise HTTPException(
            status_code=422,
            detail=f"Deleted players are registered for round {round_nr}: {inactive}",
        )
    if not players:
        raise HTTPException(
            status_code=422,
            detail=f"No players are registered for round {round_nr}.",
        )
    if len(players) % 2 == 1:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Number of players should be even. Got {len(players)}."
                " Give one of the registered players a bye."
            ),
        )
    return players


_RESOLVERS: dict[
    CompetitionType, Callable[[Competition, int, Session], list[Player]]
] = {
    CompetitionType.SIMKRO: _simkro_round_field,
}


def round_field(
    competition: Competition, round_nr: int, session: Session
) -> list[Player]:
    """The players that play `round_nr`, ready to be paired."""
    return _RESOLVERS[competition.type](competition, round_nr, session)
