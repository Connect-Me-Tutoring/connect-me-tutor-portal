#!/usr/bin/env bash
# Run test-static.sql against lookup_proposed_matches_static (no Profiles/pairing_requests).
#
# One-time on empty DB: load only the functions (no app tables):
#   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \\
#     -f supabase/migrations/20260407180000_lookup_proposed_matches_static.sql
#
# Then:
#   npm run test:lookup-static
#   ./scripts/lookup-proposed-matches-perf/run-static-test.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=psql-conn.sh
source "$DIR/psql-conn.sh"

resolve_default_database_url

echo "Running test-static.sql..." >&2
run_sql_file "$DIR/test-static.sql" -v ON_ERROR_STOP=1

echo "Done." >&2
