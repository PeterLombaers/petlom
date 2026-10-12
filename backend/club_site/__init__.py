"""Everything Petlom exchanges with the club website.

The club website (paulkeres.nl) is a WordPress site. Petlom reads from it --
the sign-up list for a club evening, which the site embeds as a published
Google Sheet (`registrations`, matched to players by `registration_import`) --
and writes to it: a round's pairings, and later its results and ranking, as a
post published over the WordPress REST API.

Every request goes through the one client in `http`, and every failure is a
`ClubSiteError`.
"""

from backend.club_site.http import ClubSiteError

__all__ = ["ClubSiteError"]
