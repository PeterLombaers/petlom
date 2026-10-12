"""Endpoints that exchange data with the club website.

The sign-up import reads the club evening's sign-up list off the website.
The URLs stay under /competitions, since each one is about one competition's
round; they are kept here so that everything touching the club website is in
one place (see `backend.club_site`).
"""

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from backend.auth import ModeratorDep
from backend.club_site import ClubSiteError
from backend.club_site.registration_import import match_names
from backend.club_site.registrations import fetch_registered_names
from backend.config import settings
from backend.dependencies import SessionDep, find_competition, get_round_registrations
from backend.models import (
    ImportedRegistrationAmbiguity,
    ImportedRegistrationMatch,
    Player,
    RegistrationImportPreview,
)

router = APIRouter(prefix="/competitions", tags=["club site"])


@router.get("/{name}/registrations/import-preview")
def preview_registration_import(
    name: str, round_nr: int, session: SessionDep, _: ModeratorDep
) -> RegistrationImportPreview:
    """Report what signing up on the club website would add to this round.

    Read-only on purpose: the names come from a form people type into, so the
    moderator gets to see what was matched to whom before anything is
    registered.
    """
    competition = find_competition(name, session)
    url = settings.club_registration_url
    try:
        names = fetch_registered_names(url)
    except ClubSiteError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    players = session.exec(select(Player).where(Player.is_active)).all()
    result = match_names(names, players)
    registered = {
        reg.player_id for reg in get_round_registrations(competition, round_nr, session)
    }

    return RegistrationImportPreview(
        source_url=url,
        scraped_count=len(names),
        matched=[
            ImportedRegistrationMatch(
                scraped_name=m.scraped_name,
                player=m.player,
                approximate=m.approximate,
                already_registered=m.player.id in registered,
            )
            for m in result.matched
        ],
        unmatched=result.unmatched,
        ambiguous=[
            ImportedRegistrationAmbiguity(
                scraped_name=a.scraped_name, candidates=a.candidates
            )
            for a in result.ambiguous
        ],
    )
