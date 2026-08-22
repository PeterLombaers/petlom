#!/usr/bin/env bash
#
# Back up the production SQLite database and download it to this machine.
#
# The app keeps running: the snapshot is taken with SQLite's online backup API
# inside the backend container, so it is consistent even mid-write.
#
# Usage: scripts/backup.sh [-o OUTPUT_DIR] [-q]

set -euo pipefail

# shellcheck source=scripts/config.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

QUIET=0
OUT="$PETLOM_BACKUP_DIR"

usage() {
    sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
    case "$1" in
        -o|--output-dir) OUT="$2"; shift 2 ;;
        -q|--quiet) QUIET=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
    esac
done

require_host

log() {
    [ "$QUIET" = "1" ] || echo "$@" >&2
}

# The path inside the container, matching DATABASE_FP in docker-compose.yml.
DB_PATH=/data/petlom.db
SNAPSHOT_PATH=/data/_backup.db

TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
TARGET="$OUT/petlom-$TS.db"

log "Snapshotting $DB_PATH on $PETLOM_SSH_HOST ..."
remote "docker compose exec -T backend uv run python -c \"
import sqlite3
src = sqlite3.connect('$DB_PATH')
dst = sqlite3.connect('$SNAPSHOT_PATH')
with dst:
    src.backup(dst)
dst.close()
src.close()
\""

cleanup_snapshot() {
    remote "docker compose exec -T backend rm -f '$SNAPSHOT_PATH'" || true
}
trap cleanup_snapshot EXIT

log "Downloading to $TARGET ..."
# -T matters: without it docker allocates a TTY and mangles the binary stream.
remote "docker compose exec -T backend cat '$SNAPSHOT_PATH'" > "$TARGET"

if [ "$PETLOM_DRY_RUN" = "1" ]; then
    rm -f "$TARGET"
    echo "[dry-run] would have written $TARGET" >&2
    exit 0
fi

if [ ! -s "$TARGET" ]; then
    rm -f "$TARGET"
    echo "Backup failed: downloaded file is empty." >&2
    exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
    check="$(sqlite3 "$TARGET" 'pragma integrity_check;')"
    if [ "$check" != "ok" ]; then
        echo "Backup failed integrity check: $check" >&2
        exit 1
    fi
    log "Integrity check: ok"
else
    log "sqlite3 not installed, skipping integrity check."
fi

log "Backed up $(du -h "$TARGET" | cut -f1) to:"
# Last line of stdout is the path, so deploy.sh can capture it.
echo "$TARGET"
