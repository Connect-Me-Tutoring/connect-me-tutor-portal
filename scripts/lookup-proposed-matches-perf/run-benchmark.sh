#!/usr/bin/env bash
# Seed demo student/tutor sample rows (optional) and run EXPLAIN ANALYZE benchmarks.
#
# Requires a DB with migrations applied (lookup_proposed_matches, Profiles, pairing_requests, auth).
#
# Usage:
#   export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
#   ./scripts/lookup-proposed-matches-perf/run-benchmark.sh
#
# Skip re-seeding:
#   SKIP_SEED=1 ./scripts/lookup-proposed-matches-perf/run-benchmark.sh
#
# Connection: see psql-conn.sh
# MATCH_LIMIT (default 50) — third argument to lookup_proposed_matches.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=psql-conn.sh
source "$DIR/psql-conn.sh"

SKIP_SEED="${SKIP_SEED:-0}"
MATCH_LIMIT="${MATCH_LIMIT:-50}"

resolve_default_database_url

if [[ "${SKIP_SEED}" != "1" ]]; then
  echo "Seeding sample student/tutor rows (sample-seed.sql)..." >&2
  run_sql_file "$DIR/sample-seed.sql" -v ON_ERROR_STOP=1
else
  echo "SKIP_SEED=1 — not loading demo data." >&2
fi

echo "Running benchmark-sample.sql (MATCH_LIMIT=$MATCH_LIMIT)..." >&2
run_sql_file "$DIR/benchmark-sample.sql" -v ON_ERROR_STOP=1 -v match_limit="$MATCH_LIMIT"

echo "Done." >&2
