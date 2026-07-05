# Shared helpers for lookup-proposed-matches-perf scripts.
# Expects: DIR = directory of the calling script; set before sourcing.

: "${DIR:?DIR must be set before sourcing psql-conn.sh}"

ROOT="$(cd "$DIR/../.." && pwd)"

compose_up() {
  [[ -f "$ROOT/docker-compose.yml" ]] || return 1
  docker compose -f "$ROOT/docker-compose.yml" ps postgres 2>/dev/null | grep -q 'Up'
}

# Run a SQL file; extra args go to psql (e.g. -v ON_ERROR_STOP=1).
run_sql_file() {
  local file="$1"
  shift

  if command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" "$@" -f "$file"
    return 0
  fi

  if compose_up; then
    docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
      psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-connect_me}" "$@" -f - <"$file"
    return 0
  fi

  echo "Cannot connect: install psql and set DATABASE_URL, or run: docker compose up -d postgres" >&2
  exit 1
}

resolve_default_database_url() {
  if [[ -z "${DATABASE_URL:-}" ]] && compose_up; then
    export DATABASE_URL="postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@127.0.0.1:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-connect_me}"
    echo "DATABASE_URL not set; using docker compose Postgres: $DATABASE_URL" >&2
  fi
}
