import { Profile } from "@/types";
import { User } from "@supabase/supabase-js";
import { createClient } from "../../supabase/server";
import { cachedGetUser } from "../user/actions";
import { tableToInterfaceProfiles } from "../../utils/type-utils";

function authzError(message = "Unauthorized"): never {
  throw new Error(message);
}

const ACTIVE_PROFILE_SELECT = `
  id,
  created_at,
  role,
  user_id,
  first_name,
  last_name,
  date_of_birth,
  start_date,
  availability,
  email,
  phone_number,
  parent_name,
  parent_phone,
  parent_email,
  tutor_ids,
  timezone,
  subjects_of_interest,
  status,
  student_number,
  settings_id,
  languages_spoken,
  age,
  grade,
  gender,
  orientation_completed_at
`;

async function fetchActiveProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select(`profile:Profiles!last_active_profile_id(${ACTIVE_PROFILE_SELECT})`)
    .eq("user_id", userId)
    .single();

  if (error || !data?.profile) {
    return null;
  }

  return tableToInterfaceProfiles(data.profile as never);
}

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await cachedGetUser();
  if (!user) {
    authzError("Unauthenticated");
  }
  return user;
}

export async function requireAuthenticatedProfile(): Promise<{
  user: User;
  profile: Profile;
}> {
  const user = await requireAuthenticatedUser();
  const profile = await fetchActiveProfile(user.id);
  if (!profile) {
    authzError("Profile not found");
  }
  return { user, profile };
}

/**
 * The one definition of "admin" in this app: an Active Admin profile.
 *
 * Deactivating an admin has to remove their access everywhere, not just from
 * the pages that happened to check status, so every elevated branch below
 * goes through this. It mirrors public.is_active_admin() in the database,
 * which is the authoritative gate for anything RLS covers.
 */
export function isActiveAdmin(profile: Pick<Profile, "role" | "status">): boolean {
  return profile.role === "Admin" && profile.status === "Active";
}

export async function requireAdmin(): Promise<{ user: User; profile: Profile }> {
  const ctx = await requireAuthenticatedProfile();
  if (!isActiveAdmin(ctx.profile)) {
    authzError("Admin access required");
  }
  return ctx;
}

export async function requireSelfOrAdmin(targetUserId: string): Promise<{
  user: User;
  profile: Profile;
}> {
  const ctx = await requireAuthenticatedProfile();
  if (isActiveAdmin(ctx.profile) || ctx.user.id === targetUserId) {
    return ctx;
  }
  authzError();
}

export async function requireTutorProfileAccess(tutorProfileId: string): Promise<{
  user: User;
  profile: Profile;
}> {
  const ctx = await requireAuthenticatedProfile();
  if (isActiveAdmin(ctx.profile)) {
    return ctx;
  }
  if (ctx.profile.role === "Tutor" && ctx.profile.id === tutorProfileId) {
    return ctx;
  }
  authzError();
}

export async function requireStudentProfileAccess(
  studentProfileId: string,
): Promise<{ user: User; profile: Profile }> {
  const ctx = await requireAuthenticatedProfile();
  if (isActiveAdmin(ctx.profile)) {
    return ctx;
  }
  if (ctx.profile.role === "Student" && ctx.profile.id === studentProfileId) {
    return ctx;
  }
  authzError();
}

export async function assertProfileBelongsToUser(userId: string, profileId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    authzError("Profile does not belong to user");
  }
}

export async function requireEnrollmentAccess(enrollmentId: string): Promise<{
  user: User;
  profile: Profile;
}> {
  const ctx = await requireAuthenticatedProfile();
  if (isActiveAdmin(ctx.profile)) {
    return ctx;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Enrollments")
    .select("student_id, tutor_id")
    .eq("id", enrollmentId)
    .single();

  if (error || !data) {
    authzError("Enrollment not found");
  }

  if (ctx.profile.id === data.student_id || ctx.profile.id === data.tutor_id) {
    return ctx;
  }

  authzError();
}

export async function requireSessionAccess(session: {
  tutor?: { id: string } | null;
  student?: { id: string } | null;
  tutor_id?: string | null;
  student_id?: string | null;
}): Promise<{ user: User; profile: Profile }> {
  const ctx = await requireAuthenticatedProfile();
  if (isActiveAdmin(ctx.profile)) {
    return ctx;
  }

  const tutorId = session.tutor?.id ?? session.tutor_id;
  const studentId = session.student?.id ?? session.student_id;

  if (ctx.profile.id === tutorId || ctx.profile.id === studentId) {
    return ctx;
  }

  authzError();
}

export function applySessionScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  profile: Profile,
): T {
  if (isActiveAdmin(profile)) {
    return query;
  }
  if (profile.role === "Tutor") {
    return query.eq("tutor_id", profile.id);
  }
  if (profile.role === "Student") {
    return query.eq("student_id", profile.id);
  }
  authzError();
}
