#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""
Anonymize player names in all round_*/results.csv and round_*/standings.csv files.

Alphabetical ordering of the names is preserved since the ranking algorithm sorts
alphbetically in case of ties.

Rewrites the CSV files in place.

Usage:
    uv run anonymize.py <folder_name>
    uv run anonymize.py 2425
"""

import csv
import sys
from collections.abc import Iterable
from pathlib import Path
RESULTS_NAME_COLS = ("Witspeler", "Zwartspeler")
STANDINGS_NAME_COL = "Naam"


def _letter_id(n: int) -> str:
    """Convert 0-based index to letter suffix: 0→a, 25→z, 26→za, 51→zz, 52→zza, …"""
    if n < 26:
        return chr(ord("a") + n)
    return "z" + _letter_id(n - 26)


def read_csv(path: Path) -> tuple[list[str], list[list[str]]]:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)
        rows = list(reader)
    return headers, rows


def write_csv(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)


def collect_names(round_dirs: list[Path]) -> dict[str, str]:
    # Use dictionary instead of set to make order of names deterministic.
    names: dict[str, None] = {}

    for round_dir in round_dirs:
        for path, name_cols in [
            (round_dir / "results.csv", RESULTS_NAME_COLS),
            (round_dir / "standings.csv", {STANDINGS_NAME_COL}),
        ]:
            headers, rows = read_csv(path)
            col_indices = [i for i, h in enumerate(headers) if h in name_cols]
            for row in rows:
                for i in col_indices:
                    names[row[i]] = None

    return {name: f"player_{_letter_id(i)}" for i, name in enumerate(sorted(names))}


def anonymize_csv(
    path: Path, name_cols: Iterable[str], mapping: dict[str, str]
) -> None:
    headers, rows = read_csv(path)
    col_indices = [i for i, h in enumerate(headers) if h in name_cols]
    for row in rows:
        for i in col_indices:
            row[i] = mapping[row[i]]
    write_csv(path, headers, rows)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    data_dir = Path(__file__).parent / sys.argv[1]
    round_dirs = sorted(data_dir.glob("round_*"))
    if not round_dirs:
        print("No round_* directories found.")
        return

    mapping = collect_names(round_dirs)
    print(f"Found {len(mapping)} unique players.")
    print({anon: real for real, anon in mapping.items()})

    for round_dir in round_dirs:
        anonymize_csv(round_dir / "results.csv", RESULTS_NAME_COLS, mapping)
        anonymize_csv(round_dir / "standings.csv", {STANDINGS_NAME_COL}, mapping)
        print(f"Anonymized {round_dir.name}")


if __name__ == "__main__":
    main()
