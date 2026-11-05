// QStash runs in US_EAST_1. Pass the token AND the base URL to the client.
//
// The SDK only uses a token passed to `new Client({ token })` with the URL it
// resolves on its own: QSTASH_URL, or the EU endpoint when that is unset. So a
// US_EAST_1 token passed alone is sent to the EU endpoint and every publish is
// rejected. That broke reminders after #878 (2026-10-19).

const US_EAST_1_DEFAULT_URL = "https://qstash-us-east-1.upstash.io";

type Env = Record<string, string | undefined>;

export function resolveQstashCredentials(env: Env = process.env): {
  token: string;
  baseUrl: string;
} {
  const token = env.US_EAST_1_QSTASH_TOKEN;
  if (!token) throw new Error("US_EAST_1_QSTASH_TOKEN is not set");
  const baseUrl = env.US_EAST_1_QSTASH_URL || US_EAST_1_DEFAULT_URL;
  return { token, baseUrl };
}
