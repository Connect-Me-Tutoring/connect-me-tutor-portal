import type { PairingLogSchemaType } from "./types";

type PreviewLogRow = {
  type: string;
  message: string;
  error?: boolean;
  metadata?: Record<string, unknown>;
};

function getLogTimestampMs(log: PreviewLogRow): number {
  const ts = log.metadata?.timestamp;
  if (typeof ts !== "string") return 0;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Keep failed steps; keep pairing-match rows whose requestor request + matched profile are selected */
export function filterPairingPreviewLogsForKeys(
  logs: PreviewLogRow[],
  selectedKeys: Set<string>,
): PairingLogSchemaType[] {
  return logs
    .filter((log) => {
      if (log.type === "pairing-selection-failed") return true;
      if (log.type !== "pairing-match") return false;
      const meta = log.metadata as
        { pairing_request_id?: string; match_profile_id?: string } | undefined;
      if (!meta?.pairing_request_id || !meta?.match_profile_id) return false;
      return selectedKeys.has(`${meta.pairing_request_id}:${meta.match_profile_id}`);
    })
    .sort((a, b) => getLogTimestampMs(b) - getLogTimestampMs(a)) as PairingLogSchemaType[];
}
