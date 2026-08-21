"""Matching Petlom players to players at an external rating source by name.

The source searches on words, so a query returns everyone who shares a name
part with the player -- "Magnus Carlsen" also finds "Carlsen, Henrik". A hit is
only the same person if their names are equal once the spelling differences
between the two databases are taken out.
"""

import re
import unicodedata
from collections.abc import Sequence

from backend.external.base import ExternalPlayerResult

_PUNCTUATION = re.compile(r"[^\w\s]", flags=re.UNICODE)


def normalize_name(name: str) -> tuple[str, ...]:
    """A name reduced to what two databases can be expected to agree on.

    Case, accents and punctuation are dropped, and the name parts are sorted:
    the rating database writes "Carlsen, Magnus" where Petlom writes "Magnus
    Carlsen". A sorted tuple rather than a set, so a repeated name part still
    has to be repeated on the other side.
    """
    decomposed = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    words = _PUNCTUATION.sub(" ", stripped.casefold()).split()
    return tuple(sorted(words))


def name_matches(
    player_name: str, hits: Sequence[ExternalPlayerResult]
) -> list[ExternalPlayerResult]:
    """The hits that carry this player's name, one per external id.

    Hits with a different name are dropped rather than counted as ambiguity --
    the source matches on words, so it returns them for every query. Hits
    sharing an external id are the same person listed twice and count once.
    """
    target = normalize_name(player_name)
    by_external_id: dict[str, ExternalPlayerResult] = {}
    for hit in hits:
        if normalize_name(hit.name) != target:
            continue
        by_external_id.setdefault(hit.external_id, hit)
    return list(by_external_id.values())


def unique_match(
    player_name: str, hits: Sequence[ExternalPlayerResult]
) -> ExternalPlayerResult | None:
    """The one hit that is this player, or None if there is not exactly one."""
    candidates = name_matches(player_name, hits)
    return candidates[0] if len(candidates) == 1 else None
