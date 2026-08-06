#!/usr/bin/env bash
# Load seed data and run EXPLAIN ANALYZE for lookup_proposed_matches.
#
# Usage:
#   export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"   # supabase status
#   ./scripts/lookup-proposed-matches-perf/run.sh
#
# Optional: scale (passed to psql -v)
#   TUTOR_POOL=5000 STUDENT_POOL=1000 ./scripts/lookup-proposed-matches-perf/run.sh
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL to your Postgres connection string (local Supabase: run \"supabase status\" and use the DB URL)." >&2
  exit 1
fi

TUTOR_POOL="${TUTOR_POOL:-2000}"
STUDENT_POOL="${STUDENT_POOL:-500}"

export PGOPTIONS="${PGOPTIONS:-}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -v tutor_pool="$TUTOR_POOL" \
  -v student_pool="$STUDENT_POOL" \
  -f "$DIR/seed.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DIR/benchmark.sql"

echo "Done. To remove synthetic rows: psql \"\$DATABASE_URL\" -f \"$DIR/cleanup.sql\""
