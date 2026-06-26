#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "beautifulsoup4>=4.14.3",
#     "requests>=2.33.1",
# ]
# ///
"""
Scrape all round results from a paulkeres.nl category archive.

Usage:
    uv run scrape_results.py <category_url> <folder_name>
    uv run scrape_results.py "https://paulkeres.nl/?cat=125" seizoen_2024_2025

    Crawls paged=1, 2, 3, ... until a 404/not-found page is reached.
    For each page, finds all links with 'Ronde N' text and scrapes results + standings.

Outputs (one directory per round inside <folder_name>):
    <folder_name>/round_N/results.csv    — match results (Nr, Witspeler, Zwartspeler, Uitslag)
    <folder_name>/round_N/standings.csv  — player standings (Nr, Naam, Pnt, Prt, Sal, Ks, w, r, v, Rat, Ext, TPR)
"""

import csv
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

NOT_FOUND_TEXT = "Oops! That page can't be found"
CRAWL_DELAY_SECONDS = 1.0


def fetch_soup(url: str) -> BeautifulSoup | None:
    """Fetch a URL and return its parsed soup, or None if the page is not found."""
    print(f"  Fetching: {url}")
    response = requests.get(url, timeout=10)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    if NOT_FOUND_TEXT in soup.get_text():
        return None
    return soup


def find_round_links(soup: BeautifulSoup) -> list[tuple[str, str]]:
    """Return (text, href) pairs for links whose text contains 'Ronde N'."""
    all_links = [
        (a.get_text(strip=True), a["href"]) for a in soup.find_all("a", href=True)
    ]
    print(f"    All links on page ({len(all_links)}): {all_links[:20]}")
    links = [
        (text, href)
        for text, href in all_links
        if re.search(r"uitslag", text, re.IGNORECASE)
        and re.search(r"ronde\s+\d+", text, re.IGNORECASE)
    ]
    return links


def parse_round(soup: BeautifulSoup) -> int | None:
    h1 = soup.find("h1", string=re.compile(r"ronde\s+\d+", re.IGNORECASE))
    if h1:
        match = re.search(r"\d+", h1.get_text())
        if match:
            return int(match.group())
    return None


def table_to_rows(table: BeautifulSoup) -> tuple[list[str], list[list[str]]]:
    headers = [th.get_text(strip=True) for th in table.find_all("th")]
    rows = []
    for tr in table.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all("td")]
        if cells:
            rows.append(cells)
    return headers, rows


def write_csv(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if headers:
            writer.writerow(headers)
        writer.writerows(rows)
    print(f"    Wrote {len(rows)} rows -> {path}")


def scrape_round(url: str, save_dir: Path, round_number: int | None = None) -> bool:
    """Scrape a single round page and write CSVs into save_dir. Returns True on success."""
    soup = fetch_soup(url)
    if soup is None:
        print(f"    ERROR: page not found or returned not-found text: {url}")
        return False

    if round_number is None:
        round_number = parse_round(soup)
    if round_number is None:
        print(f"    WARNING: could not determine round number from {url}, skipping")
        return False

    round_dir = save_dir / f"round_{round_number}"
    if round_dir.exists():
        print(f"    Skipping round {round_number}: directory already exists")
        return True

    tables = soup.find_all("table")
    if len(tables) < 2:
        print(
            f"    WARNING: expected at least 2 tables, found {len(tables)} — skipping"
        )
        return False

    round_dir.mkdir(parents=True)
    results_headers, results_rows = table_to_rows(tables[0])
    write_csv(round_dir / "results.csv", results_headers, results_rows)

    standings_headers, standings_rows = table_to_rows(tables[1])
    write_csv(round_dir / "standings.csv", standings_headers, standings_rows)

    print(f"    Scraped round {round_number} from {url}")
    return True


def crawl_category(base_url: str, save_dir: Path) -> None:
    """Crawl all paged archive pages and scrape every 'Ronde N' link found."""
    # Strip any trailing paged= param the user may have included
    base_url = re.sub(r"[?&]paged=\d+", "", base_url).rstrip("?&")

    seen_round_urls: set[str] = set()
    page = 1

    while True:
        sep = "&" if "?" in base_url else "?"
        paged_url = f"{base_url}{sep}paged={page}"
        print(f"\n[Page {page}] {paged_url}")

        soup = fetch_soup(paged_url)
        if soup is None:
            print(f"[Page {page}] Not found — stopping crawl.")
            break

        round_links = find_round_links(soup)
        if not round_links:
            print(f"[Page {page}] No 'Ronde N' links found.")
        else:
            print(
                f"[Page {page}] Found {len(round_links)} round link(s): {[t for t, _ in round_links]}"
            )

        for link_text, href in round_links:
            if href in seen_round_urls:
                print(f"  Already scraped {link_text} ({href}), skipping")
                continue
            seen_round_urls.add(href)
            print(f"  Scraping {link_text} -> {href}")
            scrape_round(href, save_dir)
            time.sleep(CRAWL_DELAY_SECONDS)

        page += 1
        time.sleep(CRAWL_DELAY_SECONDS)

    print(f"\nDone. Scraped {len(seen_round_urls)} round(s) total.")


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    base_url = sys.argv[1]
    folder_name = sys.argv[2]
    save_dir = Path(__file__).parent / folder_name
    save_dir.mkdir(parents=True, exist_ok=True)

    print(f"Category URL : {base_url}")
    print(f"Output dir   : {save_dir}")

    crawl_category(base_url, save_dir)


if __name__ == "__main__":
    main()
