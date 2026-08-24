"""Matching names signed up on the club website to players in the database.

The names come from a form people type into, so they are only approximately the
names Petlom holds: a missing accent, a swapped particle, an occasional typo,
sometimes a note like "afgemeld" appended. Matching therefore runs in two
passes -- the normalization the external-rating matcher already uses, then a
similarity fallback -- and anything that does not come out as exactly one
player is reported rather than guessed at.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from backend.external.matching import normalize_name
from backend.models import Player

# How alike two names have to be before one is taken for the other. Tuned so
# that a single typo in a name still matches ("Peter van der Belt" for "Peter
# van den Belt") while two different people do not.
SIMILARITY_THRESHOLD = 0.85


@dataclass
class NameMatch:
    """One signed-up name resolved to exactly one player."""

    scraped_name: str
    player: Player
    # Matched through the similarity fallback rather than exactly, so worth
    # showing differently: this is the one the moderator should double check.
    approximate: bool


@dataclass
class NameAmbiguity:
    """One signed-up name that does not resolve to exactly one player."""

    scraped_name: str
    candidates: list[Player]


@dataclass
class NameMatchResult:
    matched: list[NameMatch] = field(default_factory=list)
    unmatched: list[str] = field(default_factory=list)
    ambiguous: list[NameAmbiguity] = field(default_factory=list)


def _key(name: str) -> str:
    return " ".join(normalize_name(name))


def _resolve(
    scraped_name: str, players: Sequence[Player], by_key: dict[str, list[Player]]
) -> tuple[list[Player], bool]:
    """The players this name could be, and whether it took the fuzzy pass."""
    key = _key(scraped_name)
    if not key:
        return [], False
    exact = by_key.get(key)
    if exact:
        return list(exact), False
    close = [
        player
        for player in players
        if SequenceMatcher(None, key, _key(player.name)).ratio() >= SIMILARITY_THRESHOLD
    ]
    return close, True


def match_names(names: Sequence[str], players: Sequence[Player]) -> NameMatchResult:
    """Sort signed-up names into matched, unmatched and ambiguous.

    A name is ambiguous when it could be several players, and also when two
    *different* names land on the same player -- one of the two is wrong either
    way, and which one is not ours to decide. The same name twice is just the
    sheet listing someone twice, and counts once.
    """
    by_key: dict[str, list[Player]] = {}
    for player in players:
        by_key.setdefault(_key(player.name), []).append(player)

    resolved = [(name, *_resolve(name, players, by_key)) for name in names]

    # Which players two different names both claim, and which names to skip
    # because an earlier row already claimed the same player under that name.
    claims: dict[int | None, set[str]] = {}
    for name, candidates, _ in resolved:
        if len(candidates) == 1:
            claims.setdefault(candidates[0].id, set()).add(_key(name))
    contested = {player_id for player_id, keys in claims.items() if len(keys) > 1}

    result = NameMatchResult()
    seen: set[tuple[int | None, str]] = set()
    for name, candidates, approximate in resolved:
        if not candidates:
            result.unmatched.append(name)
        elif len(candidates) > 1 or candidates[0].id in contested:
            result.ambiguous.append(NameAmbiguity(name, candidates))
        elif (candidates[0].id, _key(name)) in seen:
            continue
        else:
            seen.add((candidates[0].id, _key(name)))
            result.matched.append(NameMatch(name, candidates[0], approximate))
    return result
