"""Unit tests for matching signed-up names to players.

`match_names` needs no database, so these build plain unsaved `Player`s with
the ids the collision handling keys on. The names are invented.
"""

from backend.models import Player
from backend.registration_import import match_names


def players(*names: str) -> list[Player]:
    return [Player(id=i, name=name) for i, name in enumerate(names, start=1)]


def matched_pairs(names: list[str], pool: list[Player]) -> list[tuple[str, str]]:
    return [(m.scraped_name, m.player.name) for m in match_names(names, pool).matched]


def test_exact_name_matches():
    pool = players("Sander Bakker", "Tom Verhoeven")

    assert matched_pairs(["Sander Bakker"], pool) == [
        ("Sander Bakker", "Sander Bakker")
    ]


def test_case_accents_punctuation_and_word_order_are_ignored():
    pool = players("Bernard Rémy")

    result = match_names(["rémy, bernard"], pool)
    unaccented = match_names(["Bernard Remy"], pool)

    assert [(m.player.name, m.approximate) for m in result.matched] == [
        ("Bernard Rémy", False)
    ]
    assert [(m.player.name, m.approximate) for m in unaccented.matched] == [
        ("Bernard Rémy", False)
    ]


def test_typo_matches_and_is_flagged_approximate():
    pool = players("Wouter Nijhuis", "Bas Hoogland")

    result = match_names(["Wouter Nijhuys"], pool)

    assert [(m.player.name, m.approximate) for m in result.matched] == [
        ("Wouter Nijhuis", True)
    ]


def test_name_with_a_note_appended_is_unmatched():
    pool = players("Tom Verhoeven", "Bas Hoogland")

    result = match_names(["Tom Verhoeven afgemeld"], pool)

    assert result.matched == []
    assert result.unmatched == ["Tom Verhoeven afgemeld"]


def test_unknown_name_is_unmatched():
    result = match_names(["Ruben ter Horst"], players("Sander Bakker"))

    assert result.unmatched == ["Ruben ter Horst"]


def test_two_players_with_the_same_name_are_ambiguous():
    pool = players("Sander Bakker", "Sander Bakker")

    result = match_names(["Sander Bakker"], pool)

    assert result.matched == []
    assert [a.scraped_name for a in result.ambiguous] == ["Sander Bakker"]
    assert len(result.ambiguous[0].candidates) == 2


def test_near_miss_between_two_players_is_ambiguous():
    pool = players("Lieke van den Bosch", "Lieke van der Bosch")

    result = match_names(["Lieke van de Bosch"], pool)

    assert result.matched == []
    assert {c.name for c in result.ambiguous[0].candidates} == {
        "Lieke van den Bosch",
        "Lieke van der Bosch",
    }


def test_two_names_landing_on_one_player_are_both_ambiguous():
    pool = players("Anneke Smit")

    result = match_names(["Anneke Smit", "Anneke Smid"], pool)

    assert result.matched == []
    assert [a.scraped_name for a in result.ambiguous] == ["Anneke Smit", "Anneke Smid"]


def test_the_same_name_twice_is_one_match():
    pool = players("Marijke de Vries")

    result = match_names(["Marijke de Vries", "marijke de vries"], pool)

    assert [m.player.name for m in result.matched] == ["Marijke de Vries"]
    assert result.ambiguous == []


def test_order_of_the_sheet_is_kept():
    pool = players("Sander Bakker", "Tom Verhoeven", "Bas Hoogland")

    result = match_names(["Tom Verhoeven", "Bas Hoogland", "Sander Bakker"], pool)

    assert [m.scraped_name for m in result.matched] == [
        "Tom Verhoeven",
        "Bas Hoogland",
        "Sander Bakker",
    ]


def test_empty_name_is_unmatched_rather_than_matching_everyone():
    result = match_names(["  ", "..."], players("Sander Bakker"))

    assert result.matched == []
    assert result.unmatched == ["  ", "..."]
