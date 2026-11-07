// QStash runs in US_EAST_1. Pass the token AND the base URL to the client.
//
// The SDK only uses a token passed to `new Client({ token })` with the URL it
// resolves on its own: QSTASH_URL, or the EU endpoint when that is unset. So a
// US_EAST_1 token passed alone is sent to the EU endpoint and every publish is
// rejected. That broke reminders after #878 (2026-10-19).

const US_EAST_1_DEFAULT_URL = "https://qstash-us-east-1.upstash.io";

type Env = Record<string, string | undefined>;

// Values pasted into Vercel from a .env file keep their quotes: prod had
// US_EAST_1_QSTASH_URL = "\"https://qstash-us-east-1.upstash.io\"", so every publish
// threw "Invalid URL" before reaching QStash. Strip whitespace and one pair of
// surrounding quotes.
function clean(value: string | undefined): string | undefined {
  const trimmed = value
    ?.trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim();
  return trimmed || undefined;
}

export function resolveQstashCredentials(env: Env = process.env): {
  token: string;
  baseUrl: string;
} {
  const token = clean(env.US_EAST_1_QSTASH_TOKEN);
  if (!token) throw new Error("US_EAST_1_QSTASH_TOKEN is not set");
  const baseUrl = (clean(env.US_EAST_1_QSTASH_URL) || US_EAST_1_DEFAULT_URL).replace(/\/+$/, "");
  return { token, baseUrl };
}
