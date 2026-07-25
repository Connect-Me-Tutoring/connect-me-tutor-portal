import { Profile } from "@/types";

type PairingStatus = "pending" | "accepted" | "rejected";

/** Overlap slot shown in pairing preview UI */
export type PairingOverlapSlot = {
  day: string;
  startTime: string;
  endTime: string;
};

/** Rich preview row for admin overlap review before apply */
export type PairingMatchPreview = {
  /** Requestor's `pairing_requests.id` (correlates with preview logs) */
  pairing_request_id: string;
  /** Matched profile id (same as log `metadata.match_profile_id`) */
  match_profile_id: string;
  student_id: string;
  tutor_id: string;
  similarity: number;
  student_name: string;
  tutor_name: string;
  overlapping_subjects: string[];
  overlapping_slots: PairingOverlapSlot[];
};

export type PairingRequest = {
  request_id: string; //uuid;
  type: "student" | "tutor";
  userId: string; //uuid
  status: string;
  priority: number;
  createdAt: Date;
  profile: Profile;
  /** When true (default), students are not matched with tutors who previously rejected them. */
  excludeRejectedTutors?: boolean;
  /** false = archived (left queue); omitted/true = active for matching lists */
  in_queue?: boolean;
};
export type PairingMatch = {
  id: string; //uuid
  tutor_id: string; //uuid
  student_id: string; //uuid
  tutor_status: PairingStatus;
  similarity: number; //uuid
  createdAt: Date;
};

/** Client/server preview payload from `/api/pairing` dry run */
export type PairingWorkflowPreviewPayload = {
  logs: {
    type: string;
    message: string;
    error?: boolean;
    metadata?: Record<string, unknown>;
  }[];
  matchesToInsert: Pick<PairingMatch, "student_id" | "tutor_id" | "similarity">[];
  matchPreviews: PairingMatchPreview[];
  summary: {
    matchedStudents: number;
    matchedTutors: number;
    matchesToInsert: number;
    logsToInsert: number;
  };
};

export type PairingLog = {
  id: string;
  type:
    | "pairing-match"
    | "pairing-match-rejected"
    | "pairing-match-accepted"
    | "pairing-selection-failed";
  profile: {
    firstName: string;
    lastName: string;
    role: "student" | "tutor";
  } | null;
  message: string;
  status: string;
  created_at?: string;
};

// DATABSE TABLE SCHEMA PairingLog = {
//   message: string;
//   type:
//     | "pairing-match"
//     | "pairing-match-rejected"
//     | "pairing-match-accepted"
//     | "pairing-selection-failed";
//   error?: boolean;
//   role?: "student" | "tutor";
//   metadata?: Record<string, any>;
// };

interface Person {
  id: string;
  email: string;
  user_id: string;
  last_name: string;
  first_name: string;
}

export interface SharedPairing {
  id: string;
  created_at: string; // ISO date string
  student_id: string;
  tutor_id: string;
  student: Person;
  tutor: Person;
}
