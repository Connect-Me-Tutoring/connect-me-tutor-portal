#!/usr/bin/env bash
# Insert demo users (subjects + availability) and run lookup_proposed_matches queries.
#
# Usage:
#   export DATABASE_URL="postgresql://..."
#   ./scripts/lookup-proposed-matches-perf/run-demo.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=psql-conn.sh
source "$DIR/psql-conn.sh"

resolve_default_database_url

run_sql_file "$DIR/sample-seed.sql" -v ON_ERROR_STOP=1
run_sql_file "$DIR/demo-queries.sql" -v ON_ERROR_STOP=1
