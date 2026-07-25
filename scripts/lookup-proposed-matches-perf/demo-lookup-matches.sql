-- Full demo: sample data + result queries. Equivalent to:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sample-seed.sql -f demo-queries.sql
-- Or: npm run demo:lookup-matches

\ir sample-seed.sql
\ir demo-queries.sql
