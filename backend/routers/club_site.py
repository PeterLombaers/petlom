"""Endpoints that exchange data with the club website.

The sign-up import reads a club evening's sign-up list off the website, and
publishing writes a round's pairings, results and ranking to it. Their URLs
stay under /competitions, since each is about one competition's round; they
are kept here so that everything touching the club website is in one place
(see `backend.club_site`).

A failure on the website's side is a 502, never a 401: the website rejecting
Petlom's credentials must not look like the moderator's own session expiring,
which the frontend answers by logging them out.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from backend.auth import ModeratorDep
from backend.club_site import ClubSiteError, wordpress
from backend.club_site.registration_import import match_names
from backend.club_site.registrations import fetch_registered_names
from backend.club_site.round_post import is_complete, render_round_post
from backend.competitions.ranking import compute_ranking
from backend.config import settings
from backend.dependencies import (
    SessionDep,
    find_competition,
    get_latest_round_nr,
    get_round_matches,
    get_round_registrations,
)
from backend.models import (
    ClubSiteCategory,
    ClubSitePost,
    Competition,
    ImportedRegistrationAmbiguity,
    ImportedRegistrationMatch,
    Player,
    RegistrationImportPreview,
    RoundPublication,
)

router = APIRouter(prefix="/competitions", tags=["club site"])
# What is about the website as a whole rather than one competition.
site_router = APIRouter(prefix="/club-site", tags=["club site"])


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


# ---------------------------------------------------------------------------
# Publishing a round
# ---------------------------------------------------------------------------


def find_club_site_post(
    competition: Competition, round_nr: int, session: SessionDep
) -> ClubSitePost | None:
    return session.exec(
        select(ClubSitePost).where(
            ClubSitePost.competition_id == competition.id,
            ClubSitePost.round == round_nr,
        )
    ).first()


def to_publication(round_nr: int, post: ClubSitePost | None) -> RoundPublication:
    enabled = wordpress.is_configured()
    if post is None:
        return RoundPublication(enabled=enabled, round_nr=round_nr)
    return RoundPublication(
        enabled=enabled,
        round_nr=round_nr,
        url=post.url,
        published_at=post.published_at,
        with_results=post.with_results,
    )


@router.get("/{name}/publication")
def retrieve_publication(
    name: str, session: SessionDep, _: ModeratorDep, round_nr: int | None = None
) -> RoundPublication:
    """Where and when the round was last published to the club website."""
    competition = find_competition(name, session)
    if round_nr is None:
        round_nr = get_latest_round_nr(competition, session)
    return to_publication(round_nr, find_club_site_post(competition, round_nr, session))


@router.post("/{name}/publication")
def publish_round(
    name: str, session: SessionDep, _: ModeratorDep, round_nr: int | None = None
) -> RoundPublication:
    """Publish the round to the club website, creating or replacing its post.

    Always the round as it is now: its pairings, any results entered so far
    and, once every result is in, the ranking after it. Publishing again
    replaces the post's content, so this is also how a correction is
    published. Allowed on a finished competition, since nothing in Petlom
    changes but the record of the post.
    """
    if not wordpress.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Publishing to the club website is not configured.",
        )
    competition = find_competition(name, session)
    if round_nr is None:
        round_nr = get_latest_round_nr(competition, session)
    matches = get_round_matches(competition, round_nr, session)
    if not matches:
        raise HTTPException(
            status_code=400,
            detail=f"Round {round_nr} has no pairing to publish.",
        )
    ranking = (
        compute_ranking(competition, round_nr, session)
        if is_complete(matches)
        else None
    )
    round_post = render_round_post(round_nr, matches, ranking)
    categories = competition.club_site_category_ids

    record = find_club_site_post(competition, round_nr, session)
    try:
        published = None
        if record is not None:
            published = wordpress.update_post(
                record.post_id, round_post.title, round_post.content, categories
            )
            # A post deleted or binned on the site is replaced by a new one
            # rather than revived: whoever removed it may have had a reason.
            if published is not None and published.status == "trash":
                published = None
        if published is None:
            published = wordpress.create_post(
                round_post.title, round_post.content, categories
            )
    except ClubSiteError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if record is None:
        record = ClubSitePost(competition_id=competition.id, round=round_nr)
    record.post_id = published.id
    record.url = published.link
    record.with_results = round_post.with_results
    record.published_at = datetime.now(UTC)
    session.add(record)
    session.commit()
    session.refresh(record)
    return to_publication(round_nr, record)


@site_router.get("/categories")
def list_club_site_categories(_: ModeratorDep) -> list[ClubSiteCategory]:
    """The club website's post categories, to choose a competition's from."""
    if not wordpress.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Publishing to the club website is not configured.",
        )
    try:
        categories = wordpress.list_categories()
    except ClubSiteError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return [ClubSiteCategory(id=c.id, name=c.name, parent=c.parent) for c in categories]
