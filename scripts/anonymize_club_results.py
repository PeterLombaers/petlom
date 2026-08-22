#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""
Anonymize player names in all round_*/results.csv and round_*/standings.csv files.

Alphabetical ordering of the names is preserved since the ranking algorithm sorts
alphbetically in case of ties.

Usage:
    uv run scripts/anonymize_club_results.py <season_dir> [--out DIR] [--mapping-file FILE]
    uv run scripts/anonymize_club_results.py data/2526 --out tests/data/simkro/2526

Without --out the CSV files are rewritten in place, which is not reversible and not
repeatable (a second run would map the already-anonymized names again). Prefer
--out: it copies the season to a fresh directory and anonymizes the copy.
"""

import argparse
import csv
import json
import shutil
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "season_dir", type=Path, help="Directory containing round_N/ subdirectories."
    )
    parser.add_argument(
        "--out",
        type=Path,
        help="Copy the season here and anonymize the copy, instead of in place.",
    )
    parser.add_argument(
        "--mapping-file",
        type=Path,
        help="Write the anonymized name -> real name mapping to this JSON file.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    data_dir = args.season_dir
    if not data_dir.is_dir():
        raise SystemExit(f"Not a directory: {data_dir}")

    if args.out is not None:
        if args.out.exists():
            raise SystemExit(f"Output directory already exists: {args.out}")
        shutil.copytree(data_dir, args.out)
        data_dir = args.out
        print(f"Copied {args.season_dir} to {data_dir}")

    round_dirs = sorted(data_dir.glob("round_*"))
    if not round_dirs:
        raise SystemExit(f"No round_* directories found in {data_dir}")

    mapping = collect_names(round_dirs)
    print(f"Found {len(mapping)} unique players.")
    anon_to_real = {anon: real for real, anon in mapping.items()}
    print(anon_to_real)
    if args.mapping_file is not None:
        args.mapping_file.write_text(
            json.dumps(anon_to_real, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"Wrote mapping to {args.mapping_file}")

    for round_dir in round_dirs:
        anonymize_csv(round_dir / "results.csv", RESULTS_NAME_COLS, mapping)
        anonymize_csv(round_dir / "standings.csv", {STANDINGS_NAME_COL}, mapping)
        print(f"Anonymized {round_dir.name}")


if __name__ == "__main__":
    main()
