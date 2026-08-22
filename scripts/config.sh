# Shared configuration for the operational scripts. Sourced, not executed.
#
# Settings come from scripts/.env (see .env.example), overridden by anything
# already exported in the environment.

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPTS_DIR")"

if [ -f "$SCRIPTS_DIR/.env" ]; then
    # Exported shell variables win over the file.
    _env_host="${PETLOM_SSH_HOST-}"
    _env_remote_dir="${PETLOM_REMOTE_DIR-}"
    _env_backup_dir="${PETLOM_BACKUP_DIR-}"
    set -a
    # shellcheck disable=SC1091
    . "$SCRIPTS_DIR/.env"
    set +a
    [ -n "$_env_host" ] && PETLOM_SSH_HOST="$_env_host"
    [ -n "$_env_remote_dir" ] && PETLOM_REMOTE_DIR="$_env_remote_dir"
    [ -n "$_env_backup_dir" ] && PETLOM_BACKUP_DIR="$_env_backup_dir"
fi

PETLOM_REMOTE_DIR="${PETLOM_REMOTE_DIR:-petlom}"
PETLOM_BACKUP_DIR="${PETLOM_BACKUP_DIR:-$REPO_DIR/backups}"
PETLOM_DRY_RUN="${PETLOM_DRY_RUN:-0}"

require_host() {
    if [ -z "${PETLOM_SSH_HOST-}" ]; then
        echo "PETLOM_SSH_HOST is not set." >&2
        echo "Copy $SCRIPTS_DIR/.env.example to $SCRIPTS_DIR/.env and fill it in." >&2
        exit 1
    fi
}

# Run a command on the production host, from the directory the app is deployed in.
#
# Compose files are never passed explicitly: the remote .env may set COMPOSE_FILE
# to pull in docker-compose.chessdb.yml, and docker compose picks that up itself.
remote() {
    if [ "$PETLOM_DRY_RUN" = "1" ]; then
        echo "[dry-run] ssh $PETLOM_SSH_HOST 'cd $PETLOM_REMOTE_DIR && $*'" >&2
        return 0
    fi
    ssh "$PETLOM_SSH_HOST" "cd '$PETLOM_REMOTE_DIR' && $*"
}
