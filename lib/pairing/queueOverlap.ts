import type {
  PairingOverlapSlot,
  PairingRequest,
} from "@/types/pairing";
import {
  computeOverlappingAvailabilitySlots,
  intersectSubjects,
} from "./overlap";

export type QueueCandidateOverlap = {
  request_id: string;
  displayName: string;
  role: "tutor" | "student";
  overlapping_subjects: string[];
  overlapping_slots: PairingOverlapSlot[];
};

export type QueueRowOverlapInsight = {
  request_id: string;
  profileName: string;
  role: "tutor" | "student";
  previousPriority: number;
  newPriority: number;
  topCandidates: QueueCandidateOverlap[];
};

function profileDisplayName(profile: PairingRequest["profile"]): string {
  const name = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim();
  return name || "Unknown";
}

/** For each row with unsaved priority, rank opposite-role queue members by subject overlap */
export function buildQueuePriorityOverlapInsights(
  pendingRequests: PairingRequest[],
  allRequests: PairingRequest[],
  savedPriorities: Record<string, number>,
): QueueRowOverlapInsight[] {
  return pendingRequests.map((request) => {
    const opposite = allRequests.filter(
      (o) => o.type !== request.type && o.request_id !== request.request_id,
    );

    const ranked = opposite
      .map((o) => {
        const overlapping_subjects = intersectSubjects(
          request.profile.subjects_of_interest,
          o.profile.subjects_of_interest,
        );
        const overlapping_slots = computeOverlappingAvailabilitySlots(
          request.profile.availability,
          o.profile.availability,
        );
        const subjectScore = overlapping_subjects.length;
        const slotScore = overlapping_slots.length;
        return {
          request_id: o.request_id,
          displayName: profileDisplayName(o.profile),
          role: o.type as "tutor" | "student",
          overlapping_subjects,
          overlapping_slots,
          subjectScore,
          slotScore,
        };
      })
      .sort(
        (a, b) =>
          b.subjectScore - a.subjectScore ||
          b.slotScore - a.slotScore ||
          a.displayName.localeCompare(b.displayName),
      )
      .slice(0, 3)
      .map(({ subjectScore: _s, slotScore: _sl, ...rest }) => rest);

    return {
      request_id: request.request_id,
      profileName: profileDisplayName(request.profile),
      role: request.type,
      previousPriority:
        savedPriorities[request.request_id] ?? request.priority,
      newPriority: request.priority,
      topCandidates: ranked,
    };
  });
}
