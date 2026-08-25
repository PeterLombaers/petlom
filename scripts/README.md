# scripts

Utilities for operating a deployed Petlom instance, and for importing a season of
results from the club website.

## Configuration

The two Bash scripts drive `docker compose` on the production host over SSH. Configure
them once:

```bash
cp scripts/.env.example scripts/.env
```

`PETLOM_SSH_HOST` is required — an ssh destination (`user@host`, or a `Host` alias from
`~/.ssh/config`). `PETLOM_REMOTE_DIR` is where the checkout lives on the server
(default `petlom`), `PETLOM_BACKUP_DIR` where backups land locally (default `backups/`),
and `PETLOM_HEALTH_URL` an optional URL for the post-deploy check. Anything exported in
your shell overrides `scripts/.env`.

Set `PETLOM_DRY_RUN=1` to print the ssh commands instead of running them.

## `backup.sh` — back up the production database

```bash
scripts/backup.sh                      # -> backups/petlom-20260822-141530.db
scripts/backup.sh -o /mnt/usb/petlom   # somewhere else
```

The app keeps serving: the snapshot is taken inside the backend container with SQLite's
online backup API, streamed down over ssh, and verified with `pragma integrity_check`
(when the `sqlite3` CLI is available locally). The last line of stdout is the path to the
downloaded file.

To restore, stop the stack, copy the file back into the `petlom_db` volume as
`petlom.db`, and start it again.

## `deploy.sh` — deploy to production

```bash
scripts/deploy.sh              # git pull --ff-only main, build, alembic upgrade head, up -d, prune
scripts/deploy.sh --backup     # same, but back up the database first and abort if that fails
scripts/deploy.sh --restart    # just recreate the containers, no pull or rebuild
scripts/deploy.sh --branch dev
scripts/deploy.sh --no-prune
```

After the containers come up it waits for `backend` and `caddy` to be running, curls
`PETLOM_HEALTH_URL` if configured, and prints the last 50 lines of the backend log if
either check fails. Dangling images are pruned on success (`docker image prune -f` — never
`-a`, which would delete other stacks' images).

Migrations run between the build and the restart, as `docker compose run --rm --no-deps
backend uv run alembic upgrade head`, so a broken migration aborts the deploy instead of
crash-looping the backend. The app runs them again on startup, which is then a no-op. Use
`--backup` for a release that carries a migration: on SQLite a batch migration rewrites the
table and is not always reversible. See `migrations/README` for writing them.

The build uses Docker's layer cache. If you ever need a truly clean rebuild, do it by hand:

```bash
ssh <host> "cd petlom && docker compose build --no-cache && docker compose up -d"
```

## Importing a season from the club website

Three PEP 723 scripts, run with `uv run` (dependencies are declared inline, no install
needed). Real player names come out of the scraper, so scraped data goes in `data/`,
which is gitignored.

```bash
# 1. Scrape a season's category archive into data/
uv run scripts/scrape_club_results.py "https://paulkeres.nl/?cat=125" data/2425

# 2. Upload it to a running instance
uv run scripts/upload_club_results.py data/2425 -u admin -p secret \
    --base-url https://chess.example.com/api --name "Interne competitie 24/25"

# 3. Or anonymize a copy for use as test data
uv run scripts/anonymize_club_results.py data/2425 \
    --out tests/data/simkro/2425 --mapping-file data/2425-names.json
```

`anonymize_club_results.py` replaces every name with `player_a`, `player_b`, … keeping
alphabetical order intact (the ranking algorithm breaks ties alphabetically). Always pass
`--out`: without it the CSVs are rewritten in place, which cannot be undone and cannot be
repeated. The `--mapping-file` JSON maps anonymized names back to real ones — keep it out
of git.

The anonymized seasons committed under `tests/data/simkro/` are the fixtures
`tests/test_simkro.py` runs against; don't overwrite them without rerunning the tests.
