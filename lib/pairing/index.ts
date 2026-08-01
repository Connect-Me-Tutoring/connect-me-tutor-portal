import type { PairingMatch, PairingMatchPreview } from "@/types/pairing";
import { createAdminClient, createClient } from "../supabase/server";
import { Person } from "@/types/enrollment";
import { PairingLogSchemaType } from "./types";
import { PairingRequestNotificationEmailProps } from "@/types/email";
import { getProfileWithProfileId } from "../actions/user/actions";
import { sendPairingRequestEmail } from "../actions/email/server.actions";
import { getRejectedTutorIdsForStudent } from "../actions/pairing/server.actions";
import { Profile } from "@/types";
import { computeOverlappingAvailabilitySlots, intersectSubjects } from "./overlap";

type QueueItem = {
  pairing_request_id: string;
  profile_id: string;
};

type QueueItemMatch = {
  pairing_request_id: string;
  similarity: number;
  match_profile: Person;
  requestor_profile: Person;
};

/** Requestor's pairing_requests row id + RPC match row */
type MatchWithContext = {
  requestor_pairing_request_id: string;
  result: QueueItemMatch;
};

type PairingWorkflowOptions = {
  dryRun?: boolean;
  debug?: boolean;
};

type PairingMatchInsert = Pick<PairingMatch, "student_id" | "tutor_id" | "similarity">;

export type PairingWorkflowResult = {
  dryRun: boolean;
  logs: PairingLogSchemaType[];
  matchesToInsert: PairingMatchInsert[];
  matchPreviews: PairingMatchPreview[];
  summary: {
    matchedStudents: number;
    matchedTutors: number;
    matchesToInsert: number;
    logsToInsert: number;
  };
};

export type PairingWorkflowPersistResult = {
  insertedMatches: number;
  insertedLogs: number;
};

const logDebug = (enabled: boolean, message: string, payload?: Record<string, unknown>) => {
  if (!enabled) return;
  if (payload) {
    console.log(`[pairing-queue][debug] ${message}`, payload);
    return;
  }
  console.log(`[pairing-queue][debug] ${message}`);
};

const getRequestorDisplayName = async (
  supabase: any,
  profileId: string,
  fallbackRole: "student" | "tutor",
  cache: Map<string, string>,
) => {
  const cached = cache.get(profileId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("Profiles")
    .select("first_name, last_name")
    .or(`id.eq.${profileId},user_id.eq.${profileId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load requestor profile for pairing logs:", error);
    const fallbackName = `${fallbackRole} ${profileId}`;
    cache.set(profileId, fallbackName);
    return fallbackName;
  }

  const firstName = data?.first_name?.trim() ?? "";
  const lastName = data?.last_name?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const resolvedName = fullName.length > 0 ? fullName : `${fallbackRole} ${profileId}`;
  cache.set(profileId, resolvedName);
  return resolvedName;
};

const sendPairingRequestNotification = async (tutorId: string, studentId: string) => {
  const tutorData: Profile | null = await getProfileWithProfileId(tutorId);

  const studentData: Profile | null = await getProfileWithProfileId(studentId);

  if (tutorData && studentData) {
    const emailData: PairingRequestNotificationEmailProps = {
      tutor: tutorData,
      student: studentData,
    };
    return sendPairingRequestEmail(emailData, tutorData.email);
  }
};

const getPairingSupabaseClient = async () => {
  let supabase = await createClient();
  try {
    supabase = await createAdminClient();
  } catch (error) {
    console.error("Failed to create service-role client, falling back to request client:", error);
  }
  return supabase;
};

const profileName = (p: { first_name?: string | null; last_name?: string | null }) =>
  `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unknown";

const buildMatchesFromContexts = (contexts: MatchWithContext[]): PairingMatchInsert[] => {
  return contexts.map(({ result: match }) => {
    const requestorIsStudent = match.requestor_profile.role?.toLowerCase() === "student";
    const student_id = requestorIsStudent ? match.requestor_profile.id : match.match_profile.id;
    const tutor_id = requestorIsStudent ? match.match_profile.id : match.requestor_profile.id;
    return {
      student_id,
      tutor_id,
      similarity: match.similarity,
    } as PairingMatchInsert;
  });
};

async function buildMatchPreviews(
  supabase: Awaited<ReturnType<typeof getPairingSupabaseClient>>,
  contexts: MatchWithContext[],
): Promise<PairingMatchPreview[]> {
  if (contexts.length === 0) return [];

  const ids = new Set<string>();
  for (const { result: m } of contexts) {
    ids.add(m.requestor_profile.id);
    ids.add(m.match_profile.id);
  }

  const { data: rows, error } = await supabase
    .from("Profiles")
    .select("id, first_name, last_name, subjects_of_interest, availability")
    .in("id", [...ids]);

  if (error) {
    console.error("buildMatchPreviews: failed to load profiles", error);
    return contexts.map(({ requestor_pairing_request_id, result: m }) => {
      const requestorIsStudent = m.requestor_profile.role?.toLowerCase() === "student";
      const student_id = requestorIsStudent ? m.requestor_profile.id : m.match_profile.id;
      const tutor_id = requestorIsStudent ? m.match_profile.id : m.requestor_profile.id;
      return {
        pairing_request_id: requestor_pairing_request_id,
        match_profile_id: m.match_profile.id,
        student_id,
        tutor_id,
        similarity: m.similarity,
        student_name: profileName(requestorIsStudent ? m.requestor_profile : m.match_profile),
        tutor_name: profileName(requestorIsStudent ? m.match_profile : m.requestor_profile),
        overlapping_subjects: [],
        overlapping_slots: [],
      };
    });
  }

  type Row = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    subjects_of_interest: string[] | null;
    availability: unknown;
  };

  const byId = new Map<string, Row>();
  for (const r of (rows ?? []) as Row[]) {
    byId.set(r.id, r);
  }

  const previews: PairingMatchPreview[] = [];

  for (const { requestor_pairing_request_id, result: m } of contexts) {
    const requestorIsStudent = m.requestor_profile.role?.toLowerCase() === "student";
    const student_id = requestorIsStudent ? m.requestor_profile.id : m.match_profile.id;
    const tutor_id = requestorIsStudent ? m.match_profile.id : m.requestor_profile.id;

    const ps = byId.get(student_id);
    const pt = byId.get(tutor_id);
    const student_name = ps
      ? profileName(ps)
      : profileName(requestorIsStudent ? m.requestor_profile : m.match_profile);
    const tutor_name = pt
      ? profileName(pt)
      : profileName(requestorIsStudent ? m.match_profile : m.requestor_profile);

    const overlapping_subjects =
      ps && pt ? intersectSubjects(ps.subjects_of_interest, pt.subjects_of_interest) : [];
    const overlapping_slots =
      ps && pt ? computeOverlappingAvailabilitySlots(ps.availability, pt.availability) : [];

    previews.push({
      pairing_request_id: requestor_pairing_request_id,
      match_profile_id: m.match_profile.id,
      student_id,
      tutor_id,
      similarity: m.similarity,
      student_name,
      tutor_name,
      overlapping_subjects,
      overlapping_slots,
    });
  }

  return previews;
}

const persistPairingWorkflowResult = async (
  matchesToInsert: PairingMatchInsert[],
  logs: PairingLogSchemaType[],
  debug = false,
): Promise<PairingWorkflowPersistResult> => {
  const supabase = await getPairingSupabaseClient();
  let insertedMatches = 0;
  let insertedLogs = 0;

  if (matchesToInsert.length > 0) {
    logDebug(debug, "Inserting pairing matches", {
      count: matchesToInsert.length,
      matches: matchesToInsert.map((m) => ({
        student_id: m.student_id,
        tutor_id: m.tutor_id,
        similarity: m.similarity,
      })),
    });

    // Insert one at a time so a duplicate key (23505) on one pair doesn't
    // roll back the entire batch — students who have never been matched still land.
    const results = await Promise.all(
      matchesToInsert.map((m) =>
        supabase
          .from("pairing_matches")
          .insert({ ...m, tutor_status: "pending" })
          .select("id, student_id, tutor_id, tutor_status")
          .single(),
      ),
    );

    for (const { data, error } of results) {
      if (error) {
        if (error.code === "23505") {
          logDebug(debug, "Skipped duplicate pairing match (already exists)");
        } else {
          console.error("Failed to insert pairing match:", error);
        }
      } else {
        insertedMatches++;
        logDebug(debug, "Saved pairing match", {
          id: data?.id,
          student_id: data?.student_id,
          tutor_id: data?.tutor_id,
          tutor_status: data?.tutor_status,
        });
      }
    }
  }

  if (logs.length > 0) {
    const { error: logError } = await supabase.from("pairing_logs").insert(logs);

    if (logError) {
      console.error("Failed to insert pairing logs:", logError);
    } else {
      insertedLogs = logs.length;
    }
  }

  logDebug(debug, "Persisted pairing workflow result", {
    attempted: matchesToInsert.length,
    insertedMatches,
    insertedLogs,
  });

  console.log(
    `[pairing] Saved ${insertedMatches}/${matchesToInsert.length} matches, ${insertedLogs} logs`,
  );

  return { insertedMatches, insertedLogs };
};

export const applyPairingWorkflowPreview = async (
  preview: Pick<PairingWorkflowResult, "matchesToInsert" | "logs">,
  options: Pick<PairingWorkflowOptions, "debug"> = {},
): Promise<PairingWorkflowPersistResult> => {
  return persistPairingWorkflowResult(
    preview.matchesToInsert ?? [],
    preview.logs ?? [],
    options.debug ?? false,
  );
};

export const runPairingWorkflow = async (
  options: PairingWorkflowOptions = {},
): Promise<PairingWorkflowResult> => {
  const { dryRun = false, debug = false } = options;
  const logs: PairingLogSchemaType[] = [];

  const supabase = await getPairingSupabaseClient();
  logDebug(debug, "Using pairing Supabase client for pairing workflow");
  logDebug(debug, "Starting pairing queue run", { dryRun });

  // Get top pairing requests for tutors & students
  const [tutorQueueResult, studentQueueResult] = await Promise.all([
    supabase.rpc("get_top_pairing_request", { request_type: "tutor" }),
    supabase.rpc("get_top_pairing_request", { request_type: "student" }),
  ]);
  if (tutorQueueResult.error) {
    console.error("get_top_pairing_request(tutor) error:", tutorQueueResult.error);
  }
  if (studentQueueResult.error) {
    console.error("get_top_pairing_request(student) error:", studentQueueResult.error);
  }

  const [tutorQueue, studentQueue] = [
    tutorQueueResult.data ?? [],
    studentQueueResult.data ?? [],
  ] as [QueueItem[], QueueItem[]];
  logDebug(debug, "Loaded queue sizes", {
    tutorQueueSize: tutorQueue.length,
    studentQueueSize: studentQueue.length,
  });

  // Alternate pairing: student, tutor, student, tutor
  const maxLength = Math.max(studentQueue.length, tutorQueue.length);

  const studentMatchContexts: MatchWithContext[] = [];
  const tutorMatchContexts: MatchWithContext[] = [];
  const requestorNameCache = new Map<string, string>();

  for (let i = 0; i < maxLength; i++) {
    // Handle students first (student → tutor)
    if (i < studentQueue.length) {
      const studentReq = studentQueue[i];
      // Fetch request row to check exclude_rejected_tutors preference
      const { data: requestRow } = await supabase
        .from("pairing_requests")
        .select("exclude_rejected_tutors")
        .eq("id", studentReq.pairing_request_id)
        .single();

      const excludeRejected = requestRow?.exclude_rejected_tutors ?? true;
      const excludedTutorIds: string[] = excludeRejected
        ? await getRejectedTutorIdsForStudent(studentReq.profile_id)
        : [];

      const rpcParams: {
        request_type: string;
        request_id: string;
        p_exclude_tutor_ids?: string[];
      } = {
        request_type: "student",
        request_id: studentReq.pairing_request_id,
      };
      if (excludedTutorIds.length > 0) {
        rpcParams.p_exclude_tutor_ids = excludedTutorIds;
      }
      logDebug(debug, "Evaluating student request", {
        pairing_request_id: studentReq.pairing_request_id,
        profile_id: studentReq.profile_id,
        excluded_tutor_ids_count: excludedTutorIds.length,
      });

      const { data, error } = await supabase.rpc("get_best_match", rpcParams).single();

      const result = data as QueueItemMatch | null;
      // PGRST116 means no rows found, which is expected when there are no matches
      if (error && error.code !== "PGRST116") {
        console.error("Student best_match error:", error);
      }

      // Fallback: if RPC doesn't support p_exclude_tutor_ids, skip matches with rejected tutors
      const isExcluded =
        result && excludedTutorIds.length > 0 && excludedTutorIds.includes(result.match_profile.id);

      if (result && !isExcluded) {
        const { requestor_profile, match_profile } = result;
        const student_id = requestor_profile.id;
        const tutor_id = match_profile.id;
        logDebug(debug, "Student match found", {
          pairing_request_id: studentReq.pairing_request_id,
          requestor_profile_id: requestor_profile.id,
          match_profile_id: match_profile.id,
          requestor_name: `${requestor_profile.first_name} ${requestor_profile.last_name}`,
          match_name: `${match_profile.first_name} ${match_profile.last_name}`,
          similarity: result.similarity,
        });
        logs.push({
          message: `${requestor_profile.first_name} ${requestor_profile.last_name} matched with ${match_profile?.first_name} ${match_profile?.last_name}`,
          type: "pairing-match",
          role: "student",
          error: false,
          metadata: {
            timestamp: new Date().toISOString(),
            pairing_request_id: studentReq.pairing_request_id,
            match_profile_id: result.match_profile.id,
            student_id,
            tutor_id,
            requestor_role: "student",
            requestor_name: `${requestor_profile.first_name} ${requestor_profile.last_name}`,
          },
        });

        studentMatchContexts.push({
          requestor_pairing_request_id: studentReq.pairing_request_id,
          result,
        });
      } else {
        const requestorName = await getRequestorDisplayName(
          supabase,
          studentReq.profile_id,
          "student",
          requestorNameCache,
        );
        logDebug(debug, "Student match not found", {
          pairing_request_id: studentReq.pairing_request_id,
          requestor_name: requestorName,
          excluded_match: Boolean(isExcluded),
        });
        logs.push({
          message: isExcluded
            ? `Skipped match for ${requestorName} (tutor previously declined student)`
            : `Failed to find pairing for student ${requestorName}`,
          type: "pairing-selection-failed",
          role: "student",
          error: true,
          metadata: {
            timestamp: new Date().toISOString(),
            pairing_request_id: studentReq.pairing_request_id,
            profile_id: studentReq.profile_id,
            requestor_role: "student",
            requestor_name: requestorName,
          },
        });
      }
    }

    // Handle tutors (tutor → student)
    if (i < tutorQueue.length) {
      const tutorReq = tutorQueue[i];
      logDebug(debug, "Evaluating tutor request", {
        pairing_request_id: tutorReq.pairing_request_id,
        profile_id: tutorReq.profile_id,
      });
      const { data, error } = await supabase
        .rpc("get_best_match", {
          request_type: "tutor",
          request_id: tutorReq.pairing_request_id,
        })
        .single();

      const result = data as QueueItemMatch | null;
      // PGRST116 means no rows found, which is expected when there are no matches
      if (error && error.code !== "PGRST116") {
        console.error("Tutor best_match error:", error);
      }

      if (result) {
        const student_id = result.match_profile.id;
        const tutor_id = result.requestor_profile.id;
        logDebug(debug, "Tutor match found", {
          pairing_request_id: tutorReq.pairing_request_id,
          requestor_profile_id: result.requestor_profile.id,
          match_profile_id: result.match_profile.id,
          requestor_name: `${result.requestor_profile.first_name} ${result.requestor_profile.last_name}`,
          match_name: `${result.match_profile.first_name} ${result.match_profile.last_name}`,
          similarity: result.similarity,
        });
        tutorMatchContexts.push({
          requestor_pairing_request_id: tutorReq.pairing_request_id,
          result,
        });
        logs.push({
          message: `Tutor ${result.requestor_profile.first_name} matched with ${result.match_profile.first_name}`,
          type: "pairing-match",
          role: "tutor",
          error: false,
          metadata: {
            timestamp: new Date().toISOString(),
            pairing_request_id: tutorReq.pairing_request_id,
            match_profile_id: result.match_profile.id,
            student_id,
            tutor_id,
            requestor_role: "tutor",
            requestor_name: `${result.requestor_profile.first_name} ${result.requestor_profile.last_name}`,
          },
        });
      } else {
        const requestorName = await getRequestorDisplayName(
          supabase,
          tutorReq.profile_id,
          "tutor",
          requestorNameCache,
        );
        logDebug(debug, "Tutor match not found", {
          pairing_request_id: tutorReq.pairing_request_id,
          requestor_name: requestorName,
        });
        logs.push({
          message: `Failed to find pairing for tutor ${requestorName}`,
          type: "pairing-selection-failed",
          role: "tutor",
          error: true,
          metadata: {
            timestamp: new Date().toISOString(),
            pairing_request_id: tutorReq.pairing_request_id,
            profile_id: tutorReq.profile_id,
            requestor_role: "tutor",
            requestor_name: requestorName,
          },
        });
      }
    }
  }

  const matchedStudents = buildMatchesFromContexts(studentMatchContexts);
  const matchedTutors = buildMatchesFromContexts(tutorMatchContexts);
  const allMatchContexts = [...studentMatchContexts, ...tutorMatchContexts];
  const matchPreviews = await buildMatchPreviews(supabase, allMatchContexts);

  // Insert pairing matches to track all suggested matches
  // Handle duplicates gracefully (users stay in queue and may get same matches on subsequent runs)
  const matchesToInsert = [...matchedStudents, ...matchedTutors].filter(
    ({ similarity }) => similarity,
  );
  const result: PairingWorkflowResult = {
    dryRun,
    logs,
    matchesToInsert,
    matchPreviews,
    summary: {
      matchedStudents: matchedStudents.length,
      matchedTutors: matchedTutors.length,
      matchesToInsert: matchesToInsert.length,
      logsToInsert: logs.length,
    },
  };

  logDebug(debug, "Pairing run complete", {
    ...result.summary,
    dryRun,
  });

  if (dryRun) {
    logDebug(debug, "Dry run enabled: skipping pairing_matches and pairing_logs inserts");
    return result;
  }

  await persistPairingWorkflowResult(matchesToInsert, logs, debug);
  return result;
};
