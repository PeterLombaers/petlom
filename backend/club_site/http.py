"""The one HTTP client every request to the club website goes through."""

import httpx

# The club website answers some non-browser user agents with a 403.
USER_AGENT = (
    "Mozilla/5.0 (compatible; Petlom/1.0; +https://github.com/petlom) python-httpx"
)

# One client for the whole process, like backend.external.chess_db: a client
# per request would leak a connection pool per request. No concurrency budget
# here -- a run is at most a handful of sequential requests.
client = httpx.Client(
    timeout=10.0, follow_redirects=True, headers={"User-Agent": USER_AGENT}
)


class ClubSiteError(Exception):
    """The club website could not be reached or did not answer as expected."""
