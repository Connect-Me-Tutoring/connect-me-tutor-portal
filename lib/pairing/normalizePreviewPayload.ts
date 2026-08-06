import type { PairingWorkflowPreviewPayload } from "@/types/pairing";

function getLogTimestampMs(log: {
  metadata?: Record<string, unknown>;
}): number {
  const ts = log.metadata?.timestamp;
  if (typeof ts !== "string") return 0;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Normalize API `PairingWorkflowResult` or stored JSON into a stable preview payload */
export function normalizePairingWorkflowPreviewPayload(
  data: unknown,
): PairingWorkflowPreviewPayload {
  const raw = data as Partial<PairingWorkflowPreviewPayload> & {
    dryRun?: boolean;
  };
  const logs = [...(raw.logs ?? [])].sort(
    (a, b) => getLogTimestampMs(b) - getLogTimestampMs(a),
  );
  const matchesToInsert = raw.matchesToInsert ?? [];
  return {
    logs,
    matchesToInsert,
    matchPreviews: raw.matchPreviews ?? [],
    summary: {
      matchedStudents: raw.summary?.matchedStudents ?? 0,
      matchedTutors: raw.summary?.matchedTutors ?? 0,
      matchesToInsert:
        raw.summary?.matchesToInsert ?? matchesToInsert.length,
      logsToInsert: raw.summary?.logsToInsert ?? logs.length,
    },
  };
}
