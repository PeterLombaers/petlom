#!/usr/bin/env bash
#
# Deploy the current main branch to production: pull, rebuild, restart.
#
# Usage: scripts/deploy.sh [--backup] [--restart] [--branch BRANCH] [--no-prune]
#
#   --backup         Take a database backup first and abort if it fails (off by default).
#   --restart        Only restart the running containers: no pull, no rebuild.
#   --branch BRANCH  Branch to pull on the server (default: main).
#   --no-prune       Skip removing dangling images after a successful deploy.

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/config.sh
. "$SCRIPTS_DIR/config.sh"

BACKUP=0
RESTART_ONLY=0
PRUNE=1
BRANCH=""

usage() {
    sed -n '2,11p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
    case "$1" in
        --backup) BACKUP=1; shift ;;
        --restart) RESTART_ONLY=1; shift ;;
        --no-prune) PRUNE=0; shift ;;
        --branch) BRANCH="$2"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
    esac
done

if [ "$RESTART_ONLY" = "1" ] && [ -n "$BRANCH" ]; then
    echo "--restart and --branch cannot be combined: --restart does not pull." >&2
    exit 1
fi

require_host

BRANCH="${BRANCH:-main}"
BACKUP_FILE="(none)"

if [ "$BACKUP" = "1" ]; then
    echo "==> Backing up the database"
    BACKUP_FILE="$("$SCRIPTS_DIR/backup.sh" -q)"
    echo "    $BACKUP_FILE"
fi

if [ "$RESTART_ONLY" = "1" ]; then
    echo "==> Restarting containers"
    remote "docker compose up -d --force-recreate"
else
    echo "==> Pulling $BRANCH"
    # --ff-only: a diverged or dirty checkout should fail loudly, not merge.
    remote "git pull --ff-only origin '$BRANCH'"

    echo "==> Building images"
    remote "docker compose build"

    echo "==> Starting containers"
    remote "docker compose up -d"
fi

if [ "$PETLOM_DRY_RUN" = "1" ]; then
    echo "[dry-run] skipping health check, prune and summary" >&2
    exit 0
fi

echo "==> Waiting for containers"
healthy=0
for _ in $(seq 1 15); do
    running="$(remote "docker compose ps --services --status running" || true)"
    if echo "$running" | grep -qx backend && echo "$running" | grep -qx caddy; then
        healthy=1
        break
    fi
    sleep 2
done

if [ "$healthy" != "1" ]; then
    echo "backend and caddy are not both running. Last 50 lines of backend logs:" >&2
    remote "docker compose logs --tail=50 backend" >&2 || true
    exit 1
fi

if [ -n "${PETLOM_HEALTH_URL-}" ]; then
    echo "==> Checking $PETLOM_HEALTH_URL"
    if ! curl -fsS -o /dev/null --max-time 15 "$PETLOM_HEALTH_URL"; then
        echo "Health check failed. Last 50 lines of backend logs:" >&2
        remote "docker compose logs --tail=50 backend" >&2 || true
        exit 1
    fi
fi

if [ "$PRUNE" = "1" ]; then
    echo "==> Pruning dangling images"
    # Dangling only: -a would also delete images of other stacks on this host,
    # such as chess_player_db.
    remote "docker image prune -f"
fi

SHA="$(remote "git rev-parse --short HEAD")"
echo
echo "Deployed $PETLOM_SSH_HOST:$PETLOM_REMOTE_DIR"
echo "  branch: $BRANCH @ $SHA"
echo "  backup: $BACKUP_FILE"
