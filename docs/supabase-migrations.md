# Supabase schema changes: migrations only

Every schema change to the hosted Supabase projects goes through a committed
file in `supabase/migrations/` and the `Supabase Migrations` workflow. Nobody
except org admins should be able to change the database by hand.

There are three layers. The workflows in this repo are only one of them; the
other two are settings an org owner has to change by hand.

## 1. Supabase dashboard: who can write (this is the actual block)

Supabase **Organization → Team**:

| Who                               | Role                  |
| --------------------------------- | --------------------- |
| People who own the infrastructure | Owner / Administrator |
| Everyone else                     | **Read-only**         |

Do not use **Developer** for "no hand edits". Developers can still use the
Table Editor and SQL Editor to change data and schema. Read-only members can
browse tables and run read-only SQL (it runs as `supabase_read_only_user`).

On a Team/Enterprise plan you can scope roles per project instead, e.g.
Developer on the dev project and Read-only on prod.

Also:

- **Database password.** Anyone who has it can connect with `psql` and change
  anything. Reset it under **Project Settings → Database**, put the new one
  only in the GitHub secret, and don't share it.
- **Access tokens.** `SUPABASE_ACCESS_TOKEN` in GitHub should be a token from
  an admin account. Tokens from members who leave or change role should be
  revoked.
- **MCP.** Give non-admin people and agents the read-only Supabase MCP. The
  writable MCP's `apply_migration` writes to the database without going
  through git.

## 2. GitHub: who can ship a migration

- **Environments** (Settings → Environments):
  - `supabase-production`: add admins as required reviewers and limit
    deployment branches to `main`. A push to `main` then waits for an admin to
    approve before `supabase db push` runs against prod.
  - `supabase-dev`: limit deployment branches to `dev`. Reviewers are optional.
- **Secrets** (repo or environment level):
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_ID`, `SUPABASE_DEV_PROJECT_ID` (already used by CI)
  - `SUPABASE_DB_PASSWORD`, `SUPABASE_DEV_DB_PASSWORD`. If these aren't set,
    the CLI signs in with a temporary login role made from the access token.
- **Branch protection** on `dev` and `main`: require a PR, an approval, and the
  `Dry run` check.
- **CODEOWNERS** (optional): add `/supabase/migrations/ @<admin-team>` and
  turn on "Require review from Code Owners", so only admins can approve
  migration PRs.

## 3. Detection: the drift check

`Supabase Schema Drift` runs every day and can also be started by hand. For
prod it compares against `main`; for dev it compares against `dev`. It fails
when:

- the remote has migration versions that aren't in the branch (one was applied
  through the dashboard or MCP), or
- `supabase db diff` finds schema changes in `public` that no migration
  explains.

If it fails, either turn the change into a migration and get it merged, or
revert it.

## Writing a migration

```bash
supabase migration new my_change
```

```bash
supabase db reset   # apply all migrations to a local database to test
```

Open a PR into `dev`. The dry run shows what will be applied, and merging
applies it to dev. Promoting `dev` to `main` applies it to prod after an admin
approves.
