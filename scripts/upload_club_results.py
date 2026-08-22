#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "requests>=2.33.1",
# ]
# ///
"""
Upload a scraped SimKro season folder to a running Petlom instance via its API.

Usage:
    uv run scripts/upload_club_results.py <folder> --username U --password P
    uv run scripts/upload_club_results.py data/2526 -u admin -p secret

Only match results are uploaded; standings are recalculated by the app. Each
player's competition initial rating is taken from the `Rat` column of the
standings of the first round they played.

Expects a folder containing `round_N/{results.csv,standings.csv}` directories,
as produced by `scripts/scrape_club_results.py`.
"""

import argparse
import csv
import re
import sys
from pathlib import Path

import requests

MAX_PAGE_LENGTH = 100  # matches backend.dependencies.MAX_PAGE_LENGTH

# Map a space-stripped `Uitslag` value to the backend Result enum value.
RESULT_MAP = {
    "1-0": "1-0",
    "0-1": "0-1",
    "½-½": "1/2-1/2",
}


def round_dirs(folder: Path) -> list[tuple[int, Path]]:
    """Return (round_number, dir) pairs sorted by round number."""
    rounds = []
    for d in folder.iterdir():
        m = re.fullmatch(r"round_(\d+)", d.name)
        if d.is_dir() and m:
            rounds.append((int(m.group(1)), d))
    rounds.sort(key=lambda rd: rd[0])
    if not rounds:
        sys.exit(f"No round_N directories found in {folder}")
    return rounds


def normalize_result(uitslag: str) -> str:
    key = uitslag.replace(" ", "")
    if key not in RESULT_MAP:
        raise ValueError(f"Unexpected result value: {uitslag!r}")
    return RESULT_MAP[key]


def read_results(path: Path) -> list[tuple[int, str, str, str]]:
    """Return (board, white, black, result_enum) for each match row."""
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append(
                (
                    int(row["Nr"]),
                    row["Witspeler"].strip(),
                    row["Zwartspeler"].strip(),
                    normalize_result(row["Uitslag"]),
                )
            )
    return rows


def read_standings_ratings(path: Path) -> dict[str, float]:
    """Return {player_name: Rat} from a standings.csv."""
    ratings = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ratings[row["Naam"].strip()] = float(row["Rat"])
    return ratings


def parse_folder(folder: Path):
    """Parse the season folder.

    Returns (matches, initial_rating) where matches is an ordered list of
    (round, board, white, black, result_enum) and initial_rating maps each
    player name to the Rat from the standings of their first played round.
    """
    matches: list[tuple[int, int, str, str, str]] = []
    initial_rating: dict[str, float] = {}

    for round_nr, d in round_dirs(folder):
        results = read_results(d / "results.csv")
        standings = read_standings_ratings(d / "standings.csv")

        for board, white, black, result in results:
            matches.append((round_nr, board, white, black, result))
            for name in (white, black):
                if name not in initial_rating:
                    if name not in standings:
                        sys.exit(
                            f"Player {name!r} played round {round_nr} but is "
                            f"missing from {d / 'standings.csv'}"
                        )
                    initial_rating[name] = standings[name]

    return matches, initial_rating


class PetlomClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self._login(username, password)

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _check(self, resp: requests.Response, action: str) -> requests.Response:
        if not resp.ok:
            sys.exit(f"Failed to {action}: {resp.status_code} {resp.text}")
        return resp

    def _login(self, username: str, password: str) -> None:
        resp = self._check(
            self.session.post(
                self._url("/auth/login"),
                data={"username": username, "password": password},
            ),
            "login",
        )
        token = resp.json()["access_token"]
        self.session.headers["Authorization"] = f"Bearer {token}"

    def list_players(self) -> dict[str, int]:
        """Return {name: id} for all existing players."""
        players: dict[str, int] = {}
        offset = 0
        while True:
            resp = self._check(
                self.session.get(
                    self._url("/players/"),
                    params={"offset": offset, "limit": MAX_PAGE_LENGTH},
                ),
                "list players",
            )
            batch = resp.json()
            for p in batch:
                players[p["name"]] = p["id"]
            if len(batch) < MAX_PAGE_LENGTH:
                break
            offset += MAX_PAGE_LENGTH
        return players

    def create_player(self, name: str) -> int:
        resp = self._check(
            self.session.post(self._url("/players/"), json={"name": name}),
            f"create player {name!r}",
        )
        return resp.json()["id"]

    def create_competition(self, name: str) -> None:
        self._check(
            self.session.post(
                self._url("/competitions/"),
                json={
                    "name": name,
                    "type": "simkro",
                    "rating_type": {"algorithm": "elo"},
                },
            ),
            f"create competition {name!r}",
        )

    def set_initial_ratings(
        self, name: str, player_ids: list[int], initial_ratings: dict[int, float]
    ) -> None:
        self._check(
            self.session.patch(
                self._url(f"/competitions/{name}/registrations"),
                params={"round_nr": 1},
                json={
                    "player_ids_to_add": player_ids,
                    "initial_ratings": initial_ratings,
                },
            ),
            "set initial ratings",
        )
        # Drop the throwaway RoundRegistration rows; the CompetitionRating
        # rows (and thus the initial ratings) persist independently.
        self._check(
            self.session.delete(
                self._url(f"/competitions/{name}/registrations"),
                params={"round_nr": 1},
            ),
            "clean up round-1 registrations",
        )

    def create_match(
        self,
        name: str,
        white_id: int,
        black_id: int,
        round_nr: int,
        board: int,
        result: str,
    ) -> None:
        self._check(
            self.session.post(
                self._url("/matches/"),
                json={
                    "player_white_id": white_id,
                    "player_black_id": black_id,
                    "competition_name": name,
                    "round": round_nr,
                    "board": board,
                    "result": result,
                },
            ),
            f"create match (round {round_nr}, board {board})",
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path, help="Season folder with round_N dirs")
    parser.add_argument("--name", help="Competition name (default: folder basename)")
    parser.add_argument(
        "--base-url", default="http://localhost:8000", help="Petlom API base URL"
    )
    parser.add_argument("-u", "--username", required=True)
    parser.add_argument("-p", "--password", required=True)
    args = parser.parse_args()

    folder: Path = args.folder
    if not folder.is_dir():
        sys.exit(f"Not a directory: {folder}")
    competition_name = args.name or folder.name

    print(f"Parsing {folder} ...")
    matches, initial_rating = parse_folder(folder)
    player_names = sorted(initial_rating)
    print(f"  {len(player_names)} players, {len(matches)} matches")

    client = PetlomClient(args.base_url, args.username, args.password)

    # Resolve players: reuse existing by name, create the rest.
    print("Resolving players ...")
    name_to_id = client.list_players()
    created = 0
    for name in player_names:
        if name not in name_to_id:
            name_to_id[name] = client.create_player(name)
            created += 1
    print(f"  reused {len(player_names) - created}, created {created}")

    print(f"Creating competition {competition_name!r} ...")
    client.create_competition(competition_name)

    print("Setting initial ratings ...")
    player_ids = [name_to_id[name] for name in player_names]
    initial_ratings = {
        name_to_id[name]: rating for name, rating in initial_rating.items()
    }
    client.set_initial_ratings(competition_name, player_ids, initial_ratings)

    print(f"Uploading {len(matches)} matches ...")
    for round_nr, board, white, black, result in matches:
        client.create_match(
            competition_name,
            name_to_id[white],
            name_to_id[black],
            round_nr,
            board,
            result,
        )
    print("Done.")


if __name__ == "__main__":
    main()
