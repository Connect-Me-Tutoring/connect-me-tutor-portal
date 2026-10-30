import type { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["Profiles"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["Enrollments"]["Row"];
type PairingRow = Database["public"]["Tables"]["Pairings"]["Row"];

type ProfileDeletionSource = Pick<
  ProfileRow,
  "id" | "user_id" | "first_name" | "last_name" | "email"
>;
type RelatedProfileSource = Pick<ProfileRow, "first_name" | "last_name" | "email">;
type EnrollmentDeletionSource = Pick<EnrollmentRow, "id" | "start_date" | "duration">;
type PairingDeletionSource = Pick<PairingRow, "id">;

export const DELETION_AUDIT_PROFILE_SELECT = `
  id,
  user_id,
  first_name,
  last_name,
  email
`;

const RELATED_PROFILE_SELECT = `
  first_name,
  last_name,
  email
`;

export const ENROLLMENT_DELETION_AUDIT_SELECT = `
  id,
  start_date,
  duration,
  student:Profiles!student_id(${RELATED_PROFILE_SELECT}),
  tutor:Profiles!tutor_id(${RELATED_PROFILE_SELECT})
`;

export const PAIRING_DELETION_AUDIT_SELECT = `
  id,
  student:Profiles!student_id(${RELATED_PROFILE_SELECT}),
  tutor:Profiles!tutor_id(${RELATED_PROFILE_SELECT})
`;

function relatedProfileSnapshot(profile?: RelatedProfileSource | null) {
  return profile
    ? {
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        email: profile.email,
      }
    : null;
}

/** Only the requested profile fields are sent to PostHog. */
export function buildProfileDeletionSnapshot(profile: ProfileDeletionSource) {
  return {
    id: profile.id,
    name: `${profile.first_name} ${profile.last_name}`.trim(),
    email: profile.email,
  };
}

export type ProfileDeletionSnapshot = ReturnType<typeof buildProfileDeletionSnapshot>;

export function profileDeletionProperties(profile: ProfileDeletionSnapshot) {
  return {
    profile_name: profile.name,
    profile_email: profile.email,
  };
}

/** Only date, duration, and the student/tutor names and emails are sent to PostHog. */
export function buildEnrollmentDeletionSnapshot(
  enrollment: EnrollmentDeletionSource,
  student?: RelatedProfileSource | null,
  tutor?: RelatedProfileSource | null,
) {
  return {
    id: enrollment.id,
    date: enrollment.start_date,
    duration: enrollment.duration,
    student: relatedProfileSnapshot(student),
    tutor: relatedProfileSnapshot(tutor),
  };
}

export type EnrollmentDeletionSnapshot = ReturnType<typeof buildEnrollmentDeletionSnapshot>;

export function enrollmentDeletionProperties(enrollment: EnrollmentDeletionSnapshot) {
  return {
    enrollment_date: enrollment.date,
    enrollment_duration: enrollment.duration,
    student_name: enrollment.student?.name,
    student_email: enrollment.student?.email,
    tutor_name: enrollment.tutor?.name,
    tutor_email: enrollment.tutor?.email,
  };
}

/** Only the student/tutor names and emails are sent to PostHog. */
export function buildPairingDeletionSnapshot(
  pairing: PairingDeletionSource,
  student?: RelatedProfileSource | null,
  tutor?: RelatedProfileSource | null,
) {
  return {
    id: pairing.id,
    student: relatedProfileSnapshot(student),
    tutor: relatedProfileSnapshot(tutor),
  };
}

export type PairingDeletionSnapshot = ReturnType<typeof buildPairingDeletionSnapshot>;

export function pairingDeletionProperties(pairing: PairingDeletionSnapshot) {
  return {
    student_name: pairing.student?.name,
    student_email: pairing.student?.email,
    tutor_name: pairing.tutor?.name,
    tutor_email: pairing.tutor?.email,
  };
}
