// Picks the QStash token and base URL from the SAME region.
//
// The SDK only uses a token passed to `new Client({ token })` with the URL it
// resolves on its own: QSTASH_URL, or the EU endpoint when that is unset. So a
// US_EAST_1 token passed alone is sent to the EU endpoint and every publish is
// rejected. That broke reminders in March (fixed in 098dabc) and again in #878.
// Always pass both values from here.

export type QstashRegion = "EU_CENTRAL_1" | "US_EAST_1";

// Production has run on EU_CENTRAL_1 since 098dabc; QSTASH_REGION overrides it.
const DEFAULT_REGION: QstashRegion = "EU_CENTRAL_1";

// Used when <REGION>_QSTASH_URL is not set. The EU value is the SDK's own
// default, which is what production used with the EU token before #878.
const DEFAULT_URLS: Record<QstashRegion, string> = {
  EU_CENTRAL_1: "https://qstash.upstash.io",
  US_EAST_1: "https://qstash-us-east-1.upstash.io",
};

const REGIONS = Object.keys(DEFAULT_URLS) as QstashRegion[];

type Env = Record<string, string | undefined>;

function parseRegion(value: string | undefined): QstashRegion {
  if (!value) return DEFAULT_REGION;
  const normalized = value.trim().replaceAll("-", "_").toUpperCase();
  if ((REGIONS as string[]).includes(normalized)) return normalized as QstashRegion;
  throw new Error(`QSTASH_REGION "${value}" is not one of ${REGIONS.join(", ")}`);
}

export function resolveQstashCredentials(env: Env = process.env): {
  region: QstashRegion;
  token: string;
  baseUrl: string;
} {
  const region = parseRegion(env.QSTASH_REGION);
  const token = env[`${region}_QSTASH_TOKEN`];
  if (!token) throw new Error(`${region}_QSTASH_TOKEN is not set`);
  const baseUrl = env[`${region}_QSTASH_URL`] || DEFAULT_URLS[region];
  return { region, token, baseUrl };
}
