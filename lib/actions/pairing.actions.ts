"use client";

import { PairingLog, PairingRequest, SharedPairing } from "@/types/pairing";
import { mapRpcPairingLog } from "@/lib/pairing/mapDisplayLogs";
import { createClient } from "@supabase/supabase-js";
import { getProfile, getProfileRole } from "./user.actions";
import { supabase } from "../supabase/client";
import { getAccountEnrollments } from "./enrollment.actions";
import { Table } from "../supabase/tables";
import { PairingLogSchemaType } from "../pairing/types";
import { Person } from "@/types/enrollment";
import { Availability, Enrollment, Meeting, Profile } from "@/types";
import { ProfilePairingMetadata } from "@/types/profile";
import axios, { AxiosResponse } from "axios"; // Not used, can be removed
import { toast } from "react-hot-toast";
import { PairingConfirmationEmailProps } from "@/types/email";
import {
  sendStudentPairingConfirmationEmail,
  sendTutorPairingConfirmationEmail,
} from "./email.server.actions";
import { addEnrollment } from "./enrollment.server.actions";
import { getOverlappingAvailabilites } from "./enrollment.actions";
import { getSupabase } from "../supabase-server/serverClient";
import { number } from "zod";
import { getProfileWithProfileId } from "./user.actions";
import { getMeeting } from "./meeting.actions";
import { sendPairingAlertToWebhook } from "./pairing.server.actions";

export const getAllPairingRequests = async (profileType: "student" | "tutor") => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const { data, error } = await supabase.rpc("get_all_pairing_requests", {
    p_type: profileType,
  });

  if (error || !data?.length) {
    return { data: (data ?? null) as PairingRequest[] | null, error };
  }

  const hasRenderableProfileData = (profile: Record<string, any>) =>
    Boolean(
      profile.email ??
      profile.firstName ??
      profile.first_name ??
      profile.lastName ??
      profile.last_name,
    );

  const rows = (data as Record<string, any>[]).map((row) => {
    const profile = (row.profile ?? {}) as Record<string, any>;
    return {
      ...row,
      userId: row.userId ?? row.user_id ?? "",
      profile: {
        ...profile,
        firstName: profile.firstName ?? profile.first_name ?? profile.firstname ?? "",
        lastName: profile.lastName ?? profile.last_name ?? profile.lastname ?? "",
        availability: Array.isArray(profile.availability) ? profile.availability : [],
        subjects_of_interest: Array.isArray(profile.subjects_of_interest)
          ? profile.subjects_of_interest
          : [],
        languages_spoken: Array.isArray(profile.languages_spoken) ? profile.languages_spoken : [],
      },
    };
  }) as PairingRequest[];

  const missingProfileIds = Array.from(
    new Set(
      rows
        .filter((row) => !hasRenderableProfileData(row.profile as Record<string, any>))
        .map((row) => row.userId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (missingProfileIds.length > 0) {
    const [profilesByIdResult, profilesByUserIdResult] = await Promise.all([
      supabase
        .from(Table.Profiles)
        .select(
          "id, user_id, email, first_name, last_name, availability, subjects_of_interest, languages_spoken",
        )
        .in("id", missingProfileIds),
      supabase
        .from(Table.Profiles)
        .select(
          "id, user_id, email, first_name, last_name, availability, subjects_of_interest, languages_spoken",
        )
        .in("user_id", missingProfileIds),
    ]);

    const fallbackProfiles = [
      ...(profilesByIdResult.data ?? []),
      ...(profilesByUserIdResult.data ?? []),
    ] as Array<{
      id: string;
      user_id: string | null;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      availability: unknown[] | null;
      subjects_of_interest: string[] | null;
      languages_spoken: string[] | null;
    }>;

    const fallbackByKey = new Map<string, (typeof fallbackProfiles)[number]>();
    for (const profile of fallbackProfiles) {
      fallbackByKey.set(profile.id, profile);
      if (profile.user_id) fallbackByKey.set(profile.user_id, profile);
    }

    for (const row of rows) {
      if (hasRenderableProfileData(row.profile as Record<string, any>)) continue;
      const fallback = fallbackByKey.get(row.userId);
      if (!fallback) continue;
      row.profile = {
        ...row.profile,
        email: row.profile.email ?? fallback.email ?? "",
        firstName: row.profile.firstName ?? fallback.first_name ?? "",
        lastName: row.profile.lastName ?? fallback.last_name ?? "",
        availability: Array.isArray(row.profile.availability)
          ? row.profile.availability
          : Array.isArray(fallback.availability)
            ? fallback.availability
            : [],
        subjects_of_interest: Array.isArray(row.profile.subjects_of_interest)
          ? row.profile.subjects_of_interest
          : Array.isArray(fallback.subjects_of_interest)
            ? fallback.subjects_of_interest
            : [],
        languages_spoken: Array.isArray(row.profile.languages_spoken)
          ? row.profile.languages_spoken
          : Array.isArray(fallback.languages_spoken)
            ? fallback.languages_spoken
            : [],
      } as PairingRequest["profile"];
    }
  }

  const ids = rows.map((r) => r.request_id);
  const { data: queueRows, error: queueErr } = await supabase
    .from(Table.PairingRequests)
    .select("id, in_queue")
    .in("id", ids);

  if (queueErr || !queueRows?.length) {
    return { data: rows, error };
  }

  const activeIds = new Set(
    queueRows
      .filter((r) => (r as { in_queue?: boolean }).in_queue !== false)
      .map((r) => r.id as string),
  );

  return {
    data: rows.filter((r) => activeIds.has(r.request_id)),
    error: null,
  };
};

export type MyPairingRequest = {
  id: string;
  request_id: string;
  type: "student" | "tutor";
  status: string;
  priority: number;
  notes: string | null;
  createdAt: string;
  excludeRejectedTutors: boolean;
  /** false = left queue (archived); row kept for history */
  inQueue: boolean;
};

export const getProfilePairingQueueState = async (profileId: string): Promise<boolean> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data, error } = await supabase
    .from(Table.PairingRequests)
    .select("in_queue")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getProfilePairingQueueState error", error);
    return false;
  }

  return data?.in_queue === true;
};

export const getMyPairingRequest = async (profileId: string): Promise<MyPairingRequest | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const { data, error } = await supabase
    .from(Table.PairingRequests)
    .select("id, type, status, priority, notes, created_at, exclude_rejected_tutors, in_queue")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getMyPairingRequest error", error);
    return null;
  }
  if (!data) return null;

  const row = data as {
    id: string;
    type: string;
    status: string | null;
    priority: number | null;
    notes: string | null;
    created_at: string | null;
    exclude_rejected_tutors: boolean | null;
    in_queue?: boolean | null;
  };

  return {
    id: row.id,
    request_id: row.id,
    type: row.type as "student" | "tutor",
    status: row.status ?? "pending",
    priority: row.priority ?? 2,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    excludeRejectedTutors: row.exclude_rejected_tutors ?? true,
    inQueue: row.in_queue !== false,
  };
};

export const createPairingRequest = async (
  userId: string,
  notes: string,
  excludeRejectedTutors: boolean = true,
) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const [profile, enrollments] = await Promise.all([
    getProfile(userId),
    getAccountEnrollments(userId),
  ]);

  if (!profile) throw new Error("failed to validate profile role");

  const enrollmentCount = enrollments?.length ?? 0;
  const priority = enrollmentCount < 1 ? 1 : 2;

  const { data: existing } = await supabase
    .from(Table.PairingRequests)
    .select("id, in_queue")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingRow = existing as {
    id: string;
    in_queue?: boolean | null;
  } | null;

  if (existingRow?.id) {
    if (existingRow.in_queue !== false) {
      throw new Error("You are already in the pairing queue.");
    }

    const { error: upErr } = await supabase
      .from(Table.PairingRequests)
      .update({
        in_queue: true,
        notes,
        priority,
        exclude_rejected_tutors: excludeRejectedTutors,
        status: "pending",
      })
      .eq("id", existingRow.id);

    if (upErr) throw upErr;

    supabase.from("pairing_logs").insert([
      {
        type: "pairing-que-entered",
        message: `${profile.firstName} ${profile.lastName} has rejoined the pairing queue.`,
        error: false,
        metadata: {
          profile_id: profile.id,
        },
      } as PairingLogSchemaType,
    ]);
    return;
  }

  const result = await supabase.from(Table.PairingRequests).insert([
    {
      user_id: profile.id,
      type: profile.role.toLowerCase(),
      priority,
      notes,
      exclude_rejected_tutors: excludeRejectedTutors,
      in_queue: true,
    },
  ]);

  if (!result.error) {
    supabase.from("pairing_logs").insert([
      {
        type: "pairing-que-entered",
        message: `${profile.firstName} ${profile.lastName} has entered the queue.`,
        error: false,
        metadata: {
          profile_id: profile.id,
        },
      } as PairingLogSchemaType,
    ]);
  }
};

/** Archives the request (in_queue = false); row and notes are kept. */
export const removePairingRequest = async (id: string) => {
  try {
    const { error } = await supabase
      .from("pairing_requests")
      .update({ in_queue: false })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Unable to archive pairing request", error);
    throw error;
  }
};

export const updatePairingRequest = async (
  requestId: string,
  updates: {
    notes?: string;
    exclude_rejected_tutors?: boolean;
    priority?: number;
  },
) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const payload: Record<string, unknown> = {};
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.exclude_rejected_tutors !== undefined)
    payload.exclude_rejected_tutors = updates.exclude_rejected_tutors;
  if (updates.priority !== undefined) payload.priority = updates.priority;

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from("pairing_requests").update(payload).eq("id", requestId);

  if (error) throw error;
};

export const setExcludeRejectedTutorsPreference = async (
  userId: string,
  excludeRejectedTutors: boolean,
) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const [profile, enrollments] = await Promise.all([
    getProfile(userId),
    getAccountEnrollments(userId),
  ]);

  if (!profile) throw new Error("failed to validate profile role");

  const { data: existing, error: existingError } = await supabase
    .from(Table.PairingRequests)
    .select("id")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    await updatePairingRequest(existing.id, {
      exclude_rejected_tutors: excludeRejectedTutors,
    });
    return existing.id;
  }

  const priority = (enrollments?.length ?? 0) < 1 ? 1 : 2;

  const { data, error } = await supabase
    .from(Table.PairingRequests)
    .insert([
      {
        user_id: profile.id,
        type: profile.role.toLowerCase(),
        priority,
        notes: "",
        status: "draft",
        exclude_rejected_tutors: excludeRejectedTutors,
        in_queue: false,
      },
    ])
    .select("id")
    .single();

  if (error) throw error;

  return data.id as string;
};

export const acceptStudentMatch = () => {};

export const getPairingLogs = async (
  start_time: string,
  end_time: string,
): Promise<PairingLog[]> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const { data: logs, error } = await supabase.rpc("get_pairing_logs", {
    start_time,
    end_time,
  });

  if (error) throw error;
  if (!logs) return [];

  return logs.map((log) =>
    mapRpcPairingLog(log as unknown as Parameters<typeof mapRpcPairingLog>[0]),
  );
};

export type IncomingPairingMatch = {
  tutor: Person & ProfilePairingMetadata;
  student: Person & ProfilePairingMetadata;
  tutor_id: string;
  pairing_match_id: string;
  created_at: string;
  tutor_status?: string | null;
};

export const getIncomingPairingMatches = async (profileId: string) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const { data, error } = await supabase.rpc("get_pairing_matches_with_profiles", {
    requestor: profileId,
  });

  if (error || !data) return data;

  const list = data as unknown as IncomingPairingMatch[];
  return list.filter((m) => m.tutor_status !== "rejected" && m.tutor_status !== "accepted");
};

export const deletePairing = async (tutorId: string, studentId: string) => {
  try {
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("Enrollments")
      .select("id")
      .eq("tutor_id", tutorId)
      .eq("student_id", studentId);

    if (enrollmentsError) throw enrollmentsError;

    if (enrollments && enrollments.length > 0) {
      const now = new Date().toISOString();
      const enrollmentIds = enrollments.map((enrollment: any) => enrollment.id).filter(Boolean);

      const { error: deleteSessionsError } = await supabase
        .from("Sessions")
        .delete()
        .in("enrollment_id", enrollmentIds)
        .neq("status", "Complete")
        .gte("date", now);

      if (deleteSessionsError) throw deleteSessionsError;

      // Delete enrollments
      const { error: deleteEnrollmentsError } = await supabase
        .from("Enrollments")
        .delete()
        .eq("tutor_id", tutorId)
        .eq("student_id", studentId);

      if (deleteEnrollmentsError) throw deleteEnrollmentsError;
    }

    // Delete Pairings
    const { data, error } = await supabase
      .from("Pairings")
      .delete()
      .eq("tutor_id", tutorId)
      .eq("student_id", studentId);

    if (error) throw error;
  } catch (error) {
    console.error("Failed to delete pairing", error);
    throw error;
  }
};

export const handleResolveQueues = () => {
  const promise = axios.post("/api/pairing");
  toast.promise(promise, {
    success: "Successfully ran pairing process",
    error: "Failed to run pairing process",
    loading: "Pairing...",
  });
};

export const findAvailableSessionTimes = async () => {
  try {
    for (let i = 0; i < 1000; ++i) {}
  } catch (error) {}
};

// Function to convert time string to minutes since midnight
export function timeToMinutes(timeString: string): number {
  const [hours, minutes, seconds = 0] = timeString.split(":").map(Number);
  return hours * 60 + minutes + seconds / 60;
}

// Function to convert minutes back to time string
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.floor((totalMinutes % 1) * 60);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// Main function to get average time floored to hours with 1-hour duration
function getAverageTimeWithDuration(
  startTime: string,
  endTime: string,
  day: string,
): {
  startTime: string;
  endTime: string;
  day: string;
} {
  // Convert both times to minutes
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  // Calculate average
  const averageMinutes = (startMinutes + endMinutes) / 2;

  // Floor to nearest hour
  const flooredHour = Math.floor(averageMinutes / 60);
  const flooredStartMinutes = flooredHour * 60;

  // Add 1 hour for end time
  const flooredEndMinutes = flooredStartMinutes + 60;

  return {
    startTime: minutesToTime(flooredStartMinutes),
    endTime: minutesToTime(flooredEndMinutes),
    day: day,
  };
}

export const isOverlap = (start1: number, end1: number, start2: number, end2: number) => {
  try {
    return start1 < end2 && start2 < end1;
  } catch (error) {
    throw error;
  }
};

export const getAvailableMeetingLink = async (start: string, end: string, day: string) => {
  try {
    const requestedStart = timeToMinutes(start);
    const requestedEnd = timeToMinutes(end);

    if (!Number.isFinite(requestedStart) || !Number.isFinite(requestedEnd)) {
      throw new Error(`Invalid requested meeting time: ${start}-${end}`);
    }

    const { data: allEnrollments, error } = await supabase
      .from("Enrollments")
      .select("meetingId, day, start_time, end_time");

    if (error) throw error;

    // Filter in JavaScript
    const availableMeetings =
      allEnrollments?.filter((enrollment) => {
        // Not scheduled for the requested day - consider it available
        if (!enrollment.day || enrollment.day !== day) {
          return true;
        }

        const enrollmentStart = timeToMinutes(enrollment.start_time ?? "");
        const enrollmentEnd = timeToMinutes(enrollment.end_time ?? "");

        // An incomplete schedule cannot conflict with the requested slot.
        if (!Number.isFinite(enrollmentStart) || !Number.isFinite(enrollmentEnd)) {
          return true;
        }

        const hasConflict = isOverlap(enrollmentStart, enrollmentEnd, requestedStart, requestedEnd);

        // Return true if NO conflict (available)
        return !hasConflict;
      }) || [];

    return availableMeetings.length > 0 ? availableMeetings[0] : null;
  } catch (error) {
    console.error("Full error:", error);
    throw error;
  }
};

export const getAutoAvailableSessionTimes = async (start: string, end: string, day: string) => {
  try {
    let autoAvailability = null;
    let meetingId = null;

    for (let i = 0; i < 10; ++i) {
      autoAvailability = await getAverageTimeWithDuration(start, end, day);
      meetingId = await getAvailableMeetingLink(
        autoAvailability.startTime,
        autoAvailability.endTime,
        autoAvailability.day,
      );
      if (meetingId) return { schedule: autoAvailability, meeting: meetingId };
    }
    return null;
  } catch (error) {}
};

export const getAutomaticEnrollment = async (
  tutor: Profile,
  student: Profile,
): Promise<Omit<Enrollment, "id" | "createdAt"> | null | undefined> => {
  try {
    const availabilities = await getOverlappingAvailabilites(
      tutor.availability!,
      student.availability!,
    );

    if (availabilities) {
      const firstAvailability = availabilities[0];
      if (!firstAvailability) throw new Error("No overlapping availabilities");

      const autoAvailability = await getAutoAvailableSessionTimes(
        firstAvailability.startTime,
        firstAvailability.endTime,
        firstAvailability.day,
      );

      if (!autoAvailability) throw new Error("Unable to automatically set availability");
      if (!autoAvailability.meeting || !autoAvailability.meeting.meetingId) {
        throw new Error("Unable to identify meeting");
      }

      const autoEnrollment: Omit<Enrollment, "id" | "createdAt"> = {
        student: student,
        tutor: tutor,
        day: autoAvailability.schedule.day,
        startTime: autoAvailability.schedule.startTime,
        endTime: autoAvailability.schedule.endTime,
        meetingId: autoAvailability.meeting.meetingId,
        paused: false,
        duration: 1,
        startDate: new Date().toISOString(),
        endDate: null,
        summary: "Automatically Created Enrollment",
        frequency: "weekly",
      };

      return autoEnrollment;
    } else {
      throw new Error("No overlapping availabilitites");
    }
  } catch (error) {
    console.error("Unable to set automatic enrollment");
  }
};

export const updatePairingMatchStatus = async (
  profileId: string,
  matchId: string,
  status: "accepted" | "rejected",
  enrollment: Enrollment | null = null,
) => {
  let autoEnrollment: Omit<Enrollment, "id" | "createdAt"> | null | undefined = null;

  const { data: pmRaw, error: pmError } = await supabase
    .rpc("get_pairing_match", {
      match_id: matchId,
    })
    .single();

  if (pmError || !pmRaw) {
    console.error("get_pairing_match", pmError);
    return;
  }

  const pairingMatch = pmRaw as unknown as IncomingPairingMatch;
  const { student, tutor } = pairingMatch;

  if (status === "accepted") {
    const acceptUpdate = await supabase
      .from("pairing_matches")
      .update({ tutor_status: "accepted" })
      .eq("id", matchId)
      .eq("tutor_id", profileId);
    if (acceptUpdate.error) {
      console.error(acceptUpdate.error);
      return;
    }

    const studentData: Profile | null = await getProfileWithProfileId(student.id);
    const tutorData: Profile | null = await getProfileWithProfileId(tutor.id);

    if (!studentData) throw new Error("Unable to fetch student information");
    if (!tutorData) throw new Error("Unable to fetch tutorData");
    // create new unique student tutor pairing
    const createdPairingResult = await supabase.from("Pairings").insert([
      {
        student_id: student.id,
        tutor_id: tutor.id,
      },
    ]);

    const createdPairingError = createdPairingResult.error;
    if (createdPairingError) {
      if (createdPairingError?.code === "23505") {
        throw new Error("student - tutor pairing already exists");
      }
      console.error(createdPairingResult.error);
      throw new Error("failed to create pairings");
      return;
    }

    if (tutor.availability || student.availability) {
      autoEnrollment = await getAutomaticEnrollment(tutorData, studentData);

      if (autoEnrollment) {
        const result = await addEnrollment(autoEnrollment, true);
      } else {
        console.warn("failed to automatically create enrollment");
      }
    }

    //auto select first availability & create enrollment
    if (
      !autoEnrollment ||
      !autoEnrollment.day ||
      !autoEnrollment.startTime ||
      !autoEnrollment.endTime
    ) {
      throw new Error("Unable to automatically find availability");
    }

    const meetingData: Meeting | null = await getMeeting(autoEnrollment.meetingId);

    if (!meetingData) throw new Error("Unable to get meeting information");

    const emailData: PairingConfirmationEmailProps = {
      student: studentData,
      tutor: tutorData,
      startDate: autoEnrollment.startDate,
      availability: {
        day: autoEnrollment.day,
        startTime: autoEnrollment.startTime,
        endTime: autoEnrollment.endTime,
      },
      meeting: meetingData,
    };

    try {
      await sendStudentPairingConfirmationEmail(emailData, studentData.email);
      await sendTutorPairingConfirmationEmail(emailData, tutorData.email);
    } catch (error) {
      //rollback if error
      await supabase
        .from("Enrollments")
        .delete()
        .eq("tutor_id", tutor.id)
        .eq("student_id", student.id);

      await supabase
        .from("Pairings")
        .delete()
        .eq("tutor_id", tutor.id)
        .eq("student_id", student.id);
    }
    // Replace the fetch with:

    const log = await supabase.from("pairing_logs").insert([
      {
        type: "pairing-match-accepted",
        message: `${tutor.first_name} ${tutor.last_name} has accepted ${student.first_name} ${student.last_name} as a student`,
        error: false,
        metadata: {
          profile_id: profileId,
        },
      } as PairingLogSchemaType,
    ]);

    await sendPairingAlertToWebhook(tutorData, studentData, autoEnrollment);
  } else if (status === "rejected") {
    const rejectUpdate = await supabase
      .from("pairing_matches")
      .update({
        tutor_status: "rejected",
      })
      .eq("id", matchId)
      .eq("tutor_id", profileId);

    if (rejectUpdate.error) throw rejectUpdate.error;

    const { error: reqErr } = await supabase
      .from("pairing_requests")
      .update({
        status: "pending",
      })
      .in("user_id", [student.id, tutor.id]);

    if (reqErr) throw reqErr;

    await supabase.from("pairing_logs").insert([
      {
        type: "pairing-match-rejected",
        message: `${tutor.first_name} ${tutor.last_name} has declined ${student.first_name} ${student.last_name} as a student`,
        error: false,
        metadata: {
          profile_id: profileId,
        },
      } as PairingLogSchemaType,
    ]);
  }
};
