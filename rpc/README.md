# RPC SQL dumps

Generated snapshots of user-defined Postgres functions (excluding extension-owned functions and pgvector-related argument/return types).

Refresh from a machine with `DATABASE_URL` (or local Docker Compose Postgres):

```bash
npm run dump:rpc
```

Options (see `scripts/dump-rpc-definitions.mjs`):

- `--out <dir>` — output directory (default: `rpc` at repo root)
- `--clean` — remove existing `*.sql` in the output directory before writing
