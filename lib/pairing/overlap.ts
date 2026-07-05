/** Availability slot shape used across pairing / profiles */
export type AvailabilitySlot = {
  day: string;
  startTime: string;
  endTime: string;
};

function parseTimeToMinutes(time: string): number {
  const parts = time.split(":").map((p) => Number.parseInt(p, 10));
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

function normalizeSubjectList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter(Boolean);
}

export function intersectSubjects(a: unknown, b: unknown): string[] {
  const setA = new Set(normalizeSubjectList(a));
  const listB = normalizeSubjectList(b);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const sub of listB) {
    if (setA.has(sub) && !seen.has(sub)) {
      seen.add(sub);
      // preserve display from original casing in B when possible
      const orig = Array.isArray(b)
        ? (b as string[]).find((x) => typeof x === "string" && x.trim().toLowerCase() === sub)
        : undefined;
      out.push(orig?.trim() ?? sub);
    }
  }
  return out;
}

function normalizeAvailability(raw: unknown): AvailabilitySlot[] {
  if (!Array.isArray(raw)) return [];
  const slots: AvailabilitySlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const day = typeof o.day === "string" ? o.day : "";
    const startTime =
      typeof o.startTime === "string"
        ? o.startTime
        : typeof o.start_time === "string"
          ? o.start_time
          : "";
    const endTime =
      typeof o.endTime === "string"
        ? o.endTime
        : typeof o.end_time === "string"
          ? o.end_time
          : "";
    if (day && startTime && endTime) {
      slots.push({ day, startTime, endTime });
    }
  }
  return slots;
}

function rangesOverlap(
  dayA: string,
  startA: string,
  endA: string,
  dayB: string,
  startB: string,
  endB: string,
): boolean {
  if (dayA.trim().toLowerCase() !== dayB.trim().toLowerCase()) return false;
  const s1 = parseTimeToMinutes(startA);
  const e1 = parseTimeToMinutes(endA);
  const s2 = parseTimeToMinutes(startB);
  const e2 = parseTimeToMinutes(endB);
  return s1 < e2 && s2 < e1;
}

/** Pairs of overlapping slots (one from each profile) for display */
export function computeOverlappingAvailabilitySlots(
  availabilityA: unknown,
  availabilityB: unknown,
  maxSlots = 12,
): AvailabilitySlot[] {
  const slotsA = normalizeAvailability(availabilityA);
  const slotsB = normalizeAvailability(availabilityB);
  const out: AvailabilitySlot[] = [];
  for (const a of slotsA) {
    for (const b of slotsB) {
      if (rangesOverlap(a.day, a.startTime, a.endTime, b.day, b.startTime, b.endTime)) {
        out.push({
          day: a.day,
          startTime:
            parseTimeToMinutes(a.startTime) >= parseTimeToMinutes(b.startTime)
              ? a.startTime
              : b.startTime,
          endTime:
            parseTimeToMinutes(a.endTime) <= parseTimeToMinutes(b.endTime)
              ? a.endTime
              : b.endTime,
        });
        if (out.length >= maxSlots) return dedupeSlots(out);
      }
    }
  }
  return dedupeSlots(out);
}

function slotKey(s: AvailabilitySlot): string {
  return `${s.day}|${s.startTime}|${s.endTime}`;
}

function dedupeSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const seen = new Set<string>();
  const out: AvailabilitySlot[] = [];
  for (const s of slots) {
    const k = slotKey(s);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}
