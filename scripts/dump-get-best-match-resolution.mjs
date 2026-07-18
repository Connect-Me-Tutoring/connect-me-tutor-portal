#!/usr/bin/env node
/**
 * Resolve public.get_best_match for queued requests (or one explicit request) and print JSON.
 *
 *   export DATABASE_URL=postgresql://...
 *   node scripts/dump-get-best-match-resolution.mjs
 *   node scripts/dump-get-best-match-resolution.mjs --request-id <uuid> --type student
 *   node scripts/dump-get-best-match-resolution.mjs --queue-limit 10 --exclude-tutors <uuid>,<uuid>
 *
 * Loads .env.local / .env like dump-rpc-definitions.mjs. Falls back to docker compose Postgres
 * when DATABASE_URL is unset (same behavior as dump-rpc-definitions.mjs).
 *
 * Output: single JSON object on stdout (use `> out.json` to save). Each resolution
 * includes similarity, subjects.requestor / subjects.candidate (subjects_of_interest),
 * and full match (profiles + subject arrays on the match object).
 *
 * get_best_match: when SUPABASE_URL + an API key are set, calls PostgREST /rpc/get_best_match
 * (avoids transaction pooler SQL bugs). Otherwise uses a simple SQL string over DATABASE_URL.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function loadEnvFile() {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = join(repoRoot, envFile);
    try {
      const content = readFileSync(envPath, "utf8");
      content.split("\n").forEach((line) => {
        const match = line.match(/^([^=#\s][^=]*?)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = value;
          }
        }
      });
      break;
    } catch {
      // continue
    }
  }
}

loadEnvFile();

function composePostgresUp() {
  const r = spawnSync(
    "docker",
    ["compose", "-f", join(repoRoot, "docker-compose.yml"), "ps", "postgres"],
    { encoding: "utf8" },
  );
  return r.status === 0 && /Up/.test(r.stdout || "");
}

function resolveDatabaseUrl() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl && composePostgresUp()) {
    const port = process.env.POSTGRES_PORT || "5432";
    const db = process.env.POSTGRES_DB || "connect_me";
    databaseUrl = `postgresql://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD || "postgres"}@127.0.0.1:${port}/${db}`;
    console.error(`DATABASE_URL not set; using docker compose Postgres: ${databaseUrl}`);
  }
  return databaseUrl;
}

function redactDatabaseUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

function parseUuidList(s) {
  if (!s || !String(s).trim()) return null;
  const parts = String(s)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Single-quoted SQL string literal (safe for validated inputs only). */
function sqlStringLiteral(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function assertUuid(u, label = "uuid") {
  if (!UUID_RE.test(String(u))) {
    throw new Error(`Invalid ${label}`);
  }
}

/**
 * Build get_best_match(...) call as a single SQL string so node-pg uses the simple
 * query protocol. Supabase transaction pooler + extended/prepared protocol can raise
 * "a column definition list is redundant for a function with OUT parameters" on
 * set-returning functions with OUT params.
 */
function buildGetBestMatchSql(requestType, requestId, excludeTutorIds) {
  if (requestType !== "student" && requestType !== "tutor") {
    throw new Error('request_type must be "student" or "tutor"');
  }
  assertUuid(requestId, "request_id");
  const exclude =
    requestType === "student" && excludeTutorIds && excludeTutorIds.length > 0
      ? excludeTutorIds
      : null;
  if (exclude) {
    for (const id of exclude) assertUuid(id, "exclude_tutor_id");
  }

  const third =
    exclude === null
      ? "NULL::uuid[]"
      : `ARRAY[${exclude.map((id) => sqlStringLiteral(id)).join(", ")}]::uuid[]`;

  return `
SELECT pairing_request_id, similarity, match_profile, requestor_profile
FROM public.get_best_match(
  ${sqlStringLiteral(requestType)}::text,
  ${sqlStringLiteral(requestId)}::uuid,
  ${third}
)`;
}

function getPostgrestConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Call get_best_match via PostgREST HTTP (bypasses transaction pooler SQL quirks).
 */
async function fetchGetBestMatchRow(requestType, requestId, excludeTutorIds) {
  const cfg = getPostgrestConfig();
  if (!cfg) return null;

  const exclude =
    requestType === "student" && excludeTutorIds && excludeTutorIds.length > 0
      ? excludeTutorIds
      : null;
  const body = {
    request_type: requestType,
    request_id: requestId,
  };
  if (exclude) body.p_exclude_tutor_ids = exclude;

  const res = await fetch(`${cfg.url}/rest/v1/rpc/get_best_match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PostgREST get_best_match ${res.status}: ${text.slice(0, 800)}`);
  }

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`PostgREST invalid JSON: ${text.slice(0, 300)}`);
  }

  if (data == null) return null;
  if (Array.isArray(data)) {
    return data.length ? data[0] : null;
  }
  return data;
}

function usage(code = 0) {
  console.error(`
Usage: node scripts/dump-get-best-match-resolution.mjs [options]

Options:
  --request-id UUID     Resolve a single pairing_requests.id (use with --type)
  --type student|tutor  Request type (must match pairing_requests.type for that id)
  --queue-limit N       How many queued student + tutor requests to resolve (default: 5)
  --exclude-tutors U,U  For student resolutions: tutor profile UUIDs to exclude (optional)
  --help, -h            This message

Without --request-id, resolves the first --queue-limit rows per role from the queue
(in_queue, ordered by priority ASC NULLS LAST, created_at ASC).

Environment:
  DATABASE_URL              Postgres connection string (required unless docker compose postgres is up)
  EXCLUDE_TUTOR_IDS         Comma-separated UUIDs (same as --exclude-tutors)

  For Supabase transaction pooler (pooler.supabase.com), SQL calls to get_best_match often fail.
  Set these so the script uses PostgREST for that RPC (same as the app):
  SUPABASE_URL              Project URL (https://xxx.supabase.co)
  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY
`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = {
    requestId: null,
    type: null,
    queueLimit: 5,
    excludeTutorIds: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    if (a === "--request-id") {
      out.requestId = argv[++i];
      continue;
    }
    if (a === "--type") {
      out.type = argv[++i];
      continue;
    }
    if (a === "--queue-limit") {
      out.queueLimit = Math.max(1, parseInt(argv[++i], 10) || 5);
      continue;
    }
    if (a === "--exclude-tutors") {
      out.excludeTutorIds = parseUuidList(argv[++i]);
      continue;
    }
    console.error("Unknown argument:", a);
    usage(1);
  }
  const envEx = parseUuidList(process.env.EXCLUDE_TUTOR_IDS);
  if (envEx && !out.excludeTutorIds) out.excludeTutorIds = envEx;
  return out;
}

async function fetchQueue(client, role, limit) {
  const { rows } = await client.query(
    `
    SELECT pr.id AS request_id, pr.user_id AS profile_id, pr.priority, pr.created_at
    FROM pairing_requests pr
    WHERE pr.in_queue IS DISTINCT FROM false
      AND pr.type = $1
    ORDER BY pr.priority ASC NULLS LAST, pr.created_at ASC
    LIMIT $2
    `,
    [role, limit],
  );
  return rows;
}

/**
 * Load subjects_of_interest for requestor + candidate profiles (used for JSON dump).
 */
async function enrichMatchWithSubjects(client, match) {
  if (!match) return null;

  const reqId = match.requestor_profile?.id;
  const candId = match.match_profile?.id;
  if (!reqId || !candId) {
    return {
      ...match,
      requestor_subjects: null,
      match_subjects: null,
    };
  }

  assertUuid(String(reqId), "requestor_profile.id");
  assertUuid(String(candId), "match_profile.id");

  const sql = `
    SELECT id, COALESCE(subjects_of_interest, '{}'::text[]) AS subjects_of_interest
    FROM public."Profiles"
    WHERE id IN (${sqlStringLiteral(String(reqId))}::uuid, ${sqlStringLiteral(String(candId))}::uuid)
  `;
  const { rows } = await client.query(sql);

  const byId = Object.fromEntries(
    rows.map((r) => [String(r.id), r.subjects_of_interest ?? []]),
  );

  return {
    ...match,
    similarity: match.similarity,
    requestor_subjects: byId[String(reqId)] ?? [],
    match_subjects: byId[String(candId)] ?? [],
  };
}

async function resolveOne(client, requestType, requestId, excludeTutorIds) {
  const usePostgrest = getPostgrestConfig() != null;
  let row = null;

  if (usePostgrest) {
    row = await fetchGetBestMatchRow(requestType, requestId, excludeTutorIds);
  } else {
    const sql = buildGetBestMatchSql(requestType, requestId, excludeTutorIds);
    const { rows } = await client.query(sql);
    row = rows.length ? rows[0] : null;
  }

  if (!row) {
    return null;
  }

  const base = {
    pairing_request_id: row.pairing_request_id,
    similarity: row.similarity,
    match_profile: row.match_profile,
    requestor_profile: row.requestor_profile,
  };
  return enrichMatchWithSubjects(client, base);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error("Set DATABASE_URL or start: docker compose up -d postgres");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  if (
    /pooler\.supabase\.com/i.test(databaseUrl) &&
    !getPostgrestConfig()
  ) {
    console.error(
      "Warning: DATABASE_URL uses Supabase transaction pooler; get_best_match via SQL often fails.\n" +
        "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON key) to use PostgREST for matching.",
    );
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    databaseUrl: redactDatabaseUrl(databaseUrl),
    options: {
      queueLimit: opts.queueLimit,
      singleRequestId: opts.requestId,
      singleRequestType: opts.type,
      excludeTutorIds: opts.excludeTutorIds,
    },
    resolutions: [],
  };

  try {
    if (opts.requestId) {
      if (!opts.type || !["student", "tutor"].includes(opts.type)) {
        console.error("--type student|tutor is required with --request-id");
        process.exit(1);
      }
      try {
        const match = await resolveOne(
          client,
          opts.type,
          opts.requestId,
          opts.excludeTutorIds,
        );
        payload.resolutions.push({
          mode: "single",
          request_type: opts.type,
          request_id: opts.requestId,
          exclude_tutor_ids: opts.excludeTutorIds ?? null,
          similarity: match?.similarity ?? null,
          subjects: match
            ? {
                requestor: match.requestor_subjects ?? null,
                candidate: match.match_subjects ?? null,
              }
            : null,
          match,
          error: null,
        });
      } catch (e) {
        payload.resolutions.push({
          mode: "single",
          request_type: opts.type,
          request_id: opts.requestId,
          exclude_tutor_ids: opts.excludeTutorIds ?? null,
          similarity: null,
          subjects: null,
          match: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    } else {
      const [students, tutors] = await Promise.all([
        fetchQueue(client, "student", opts.queueLimit),
        fetchQueue(client, "tutor", opts.queueLimit),
      ]);

      payload.queue = {
        student_requests: students,
        tutor_requests: tutors,
      };

      for (const row of students) {
        try {
          const match = await resolveOne(
            client,
            "student",
            row.request_id,
            opts.excludeTutorIds,
          );
          payload.resolutions.push({
            mode: "queue",
            request_type: "student",
            request_id: row.request_id,
            profile_id: row.profile_id,
            priority: row.priority,
            created_at: row.created_at,
            exclude_tutor_ids: opts.excludeTutorIds ?? null,
            similarity: match?.similarity ?? null,
            subjects: match
              ? {
                  requestor: match.requestor_subjects ?? null,
                  candidate: match.match_subjects ?? null,
                }
              : null,
            match,
            error: null,
          });
        } catch (e) {
          payload.resolutions.push({
            mode: "queue",
            request_type: "student",
            request_id: row.request_id,
            profile_id: row.profile_id,
            similarity: null,
            subjects: null,
            match: null,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      for (const row of tutors) {
        try {
          const match = await resolveOne(client, "tutor", row.request_id, null);
          payload.resolutions.push({
            mode: "queue",
            request_type: "tutor",
            request_id: row.request_id,
            profile_id: row.profile_id,
            priority: row.priority,
            created_at: row.created_at,
            exclude_tutor_ids: null,
            similarity: match?.similarity ?? null,
            subjects: match
              ? {
                  requestor: match.requestor_subjects ?? null,
                  candidate: match.match_subjects ?? null,
                }
              : null,
            match,
            error: null,
          });
        } catch (e) {
          payload.resolutions.push({
            mode: "queue",
            request_type: "tutor",
            request_id: row.request_id,
            profile_id: row.profile_id,
            similarity: null,
            subjects: null,
            match: null,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
