/**
 * Normalize Zoom webhook rows into a stable join/leave timeline and summaries.
 * Handles: duplicate consecutive events, missing join when someone joined before
 * the portal could resolve the session, and join timestamps before scheduled start.
 */

export type RawZoomParticipantEvent = {
  id: string;
  participant_id: string;
  name: string;
  email: string | null;
  action: string;
  timestamp: string;
};

export type NormalizedParticipationEvent = {
  id: string;
  participantId: string;
  name: string;
  email: string;
  action: "joined" | "left";
  timestamp: string;
  /** Inserted because the first stored event was a leave (join was never logged). */
  inferred?: boolean;
  /** True when Zoom logged a join before the scheduled session start. */
  joinedBeforeScheduledStart?: boolean;
};

export type NormalizedParticipationSummary = {
  id: string;
  name: string;
  email: string;
  totalDuration: number;
  joinCount: number;
  currentlyInMeeting: boolean;
  firstJoined: string;
  lastActivity: string;
  /** At least one synthetic join was added for this person. */
  hadInferredJoin?: boolean;
  /** They have a real join event before session start. */
  joinedBeforeScheduledStart?: boolean;
};

function trimLower(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Stable key so join/leave rows pair even when Zoom user_id is empty on one side. */
export function zoomParticipantGroupKey(row: {
  participant_id: string;
  email: string | null;
  name: string;
}): string {
  const email = trimLower(row.email);
  if (email) return `e:${email}`;
  const pid = (row.participant_id ?? "").trim();
  if (pid) return `p:${pid}`;
  return `n:${trimLower(row.name) || "unknown"}`;
}

function toIso(d: Date): string {
  return d.toISOString();
}

function collapseDuplicateActions(
  sorted: NormalizedParticipationEvent[],
): NormalizedParticipationEvent[] {
  const out: NormalizedParticipationEvent[] = [];
  for (const e of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.action === e.action) {
      continue;
    }
    out.push(e);
  }
  return out;
}

function ensureOpensWithJoin(
  sorted: NormalizedParticipationEvent[],
  sessionStart: Date,
  participantId: string,
  name: string,
  email: string,
): NormalizedParticipationEvent[] {
  if (sorted.length === 0) return sorted;
  if (sorted[0].action === "joined") return sorted;
  const firstTs = new Date(sorted[0].timestamp);
  const joinTs =
    firstTs.getTime() < sessionStart.getTime() ? firstTs : sessionStart;
  const inferredJoin: NormalizedParticipationEvent = {
    id: `inferred-join-${participantId}-${sorted[0].id}`,
    participantId,
    name,
    email,
    action: "joined",
    timestamp: toIso(joinTs),
    inferred: true,
  };
  return [inferredJoin, ...sorted];
}

function markJoinsBeforeSession(
  events: NormalizedParticipationEvent[],
  sessionStartMs: number,
): NormalizedParticipationEvent[] {
  return events.map((e) => {
    if (e.action !== "joined" || e.inferred) return e;
    const t = new Date(e.timestamp).getTime();
    if (t < sessionStartMs) {
      return { ...e, joinedBeforeScheduledStart: true };
    }
    return e;
  });
}

function summarizeParticipantChain(
  chain: NormalizedParticipationEvent[],
  participantId: string,
  name: string,
  email: string,
  sessionStartMs: number,
  sessionEndMs: number | null,
  nowMs: number,
  hadInferredJoin: boolean,
): NormalizedParticipationSummary {
  let totalMinutes = 0;
  let joinCount = 0;
  let joinTime: number | null = null;
  const firstJoined =
    chain.find((e) => e.action === "joined")?.timestamp ?? "";
  let lastActivity =
    chain.length > 0 ? chain[chain.length - 1].timestamp : firstJoined;
  const joinedBeforeScheduledStart = chain.some(
    (e) => e.action === "joined" && e.joinedBeforeScheduledStart,
  );

  const effectiveEnd = sessionEndMs ?? nowMs;

  for (const e of chain) {
    if (e.action === "joined") {
      if (!e.inferred) {
        joinCount++;
      }
      joinTime = new Date(e.timestamp).getTime();
    } else if (e.action === "left" && joinTime !== null) {
      const leaveMs = new Date(e.timestamp).getTime();
      const segStart = Math.max(joinTime, sessionStartMs);
      const segEnd = Math.min(leaveMs, effectiveEnd);
      if (segEnd > segStart) {
        totalMinutes += (segEnd - segStart) / (1000 * 60);
      }
      joinTime = null;
    }
    lastActivity = e.timestamp;
  }

  const stillIn = joinTime !== null;
  if (stillIn && joinTime !== null) {
    const segStart = Math.max(joinTime, sessionStartMs);
    const segEnd = Math.min(effectiveEnd, nowMs);
    if (segEnd > segStart) {
      totalMinutes += (segEnd - segStart) / (1000 * 60);
    }
  }

  const effectiveJoinCount =
    joinCount > 0 ? joinCount : hadInferredJoin ? 1 : 0;

  return {
    id: participantId,
    name,
    email,
    totalDuration: Math.max(0, Math.round(totalMinutes)),
    joinCount: effectiveJoinCount,
    currentlyInMeeting: stillIn,
    firstJoined: firstJoined || lastActivity,
    lastActivity,
    hadInferredJoin: hadInferredJoin || undefined,
    joinedBeforeScheduledStart: joinedBeforeScheduledStart || undefined,
  };
}

export type NormalizeParticipationOptions = {
  sessionStart: Date;
  sessionEnd: Date | null;
  now?: Date;
};

/**
 * Aggregate DB rows: group participants, collapse duplicate actions, infer missing joins,
 * merge into one chronological list, and compute per-person summaries (minutes in session).
 */
export function normalizeZoomParticipationEvents(
  rows: RawZoomParticipantEvent[],
  opts: NormalizeParticipationOptions,
): {
  events: NormalizedParticipationEvent[];
  participantSummaries: NormalizedParticipationSummary[];
} {
  const { sessionStart, sessionEnd, now = new Date() } = opts;
  const sessionStartMs = sessionStart.getTime();
  const sessionEndMs = sessionEnd ? sessionEnd.getTime() : null;
  const nowMs = now.getTime();

  const byKey = new Map<
    string,
    { name: string; email: string; participantId: string; raw: RawZoomParticipantEvent[] }
  >();

  for (const row of rows) {
    const action = String(row.action).toLowerCase();
    if (action !== "joined" && action !== "left") continue;
    const key = zoomParticipantGroupKey(row);
    const email = (row.email ?? "").trim();
    const name = (row.name ?? "Unknown").trim() || "Unknown";
    const participantId = (row.participant_id ?? "").trim() || key;
    if (!byKey.has(key)) {
      byKey.set(key, { name, email, participantId, raw: [] });
    }
    const bucket = byKey.get(key)!;
    if (name && name !== "Unknown") bucket.name = name;
    if (email) bucket.email = email;
    if ((row.participant_id ?? "").trim()) {
      bucket.participantId = (row.participant_id ?? "").trim();
    }
    bucket.raw.push(row);
  }

  const participantSummaries: NormalizedParticipationSummary[] = [];
  const allNormalized: NormalizedParticipationEvent[] = [];

  for (const [, bucket] of byKey) {
    const sortedRaw = [...bucket.raw].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let chain: NormalizedParticipationEvent[] = sortedRaw.map((r) => ({
      id: r.id,
      participantId: bucket.participantId,
      name: bucket.name,
      email: bucket.email,
      action: r.action.toLowerCase() as "joined" | "left",
      timestamp: r.timestamp,
    }));

    chain = collapseDuplicateActions(chain);
    const hadLeadingLeave = chain.length > 0 && chain[0].action === "left";
    chain = ensureOpensWithJoin(
      chain,
      sessionStart,
      bucket.participantId,
      bucket.name,
      bucket.email,
    );
    chain = markJoinsBeforeSession(chain, sessionStartMs);

    const inferredUsed = hadLeadingLeave || chain.some((e) => e.inferred);

    participantSummaries.push(
      summarizeParticipantChain(
        chain,
        bucket.participantId,
        bucket.name,
        bucket.email,
        sessionStartMs,
        sessionEndMs,
        nowMs,
        inferredUsed,
      ),
    );
    allNormalized.push(...chain);
  }

  allNormalized.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  participantSummaries.sort((a, b) => b.totalDuration - a.totalDuration);

  return { events: allNormalized, participantSummaries };
}
