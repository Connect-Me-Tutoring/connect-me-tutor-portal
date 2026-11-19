"use server";

import { revalidatePath } from "next/cache";

import {
  DEFAULT_TUTOR_MANUAL_SECTIONS,
  tutorManualSchema,
  type TutorManual,
  type TutorManualSection,
} from "@/constants/tutor-manual";
import { requireAdmin, requireAuthenticatedProfile } from "@/lib/actions/auth/authz.server";
import { logError } from "@/lib/posthog";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";

// tutor_manual_versions has no RLS policies for tutors, so both reads and writes go through
// the service role, gated here: tutors and admins can read, only admins can save.

const MANUAL_PATH = "/dashboard/manual";

const DEFAULT_MANUAL: TutorManual = {
  sections: DEFAULT_TUTOR_MANUAL_SECTIONS,
  updatedAt: null,
  updatedByName: null,
};

export async function getTutorManual(): Promise<TutorManual> {
  const { profile } = await requireAuthenticatedProfile();
  if (profile.role !== "Tutor" && profile.role !== "Admin") {
    throw new Error("The tutor manual is only available to tutors and admins");
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from(Table.TutorManualVersions)
    .select("sections, created_at, editor:Profiles!created_by(first_name, last_name)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A read failure (e.g. the migration hasn't run yet) still shows tutors the default manual.
  if (error) {
    await logError(error, { function: "getTutorManual" }, "tutor_manual_error");
    return DEFAULT_MANUAL;
  }
  if (!data) return DEFAULT_MANUAL;

  const parsed = tutorManualSchema.safeParse({ sections: data.sections });
  if (!parsed.success) {
    await logError(parsed.error, { function: "getTutorManual" }, "tutor_manual_error");
    return DEFAULT_MANUAL;
  }

  const editor = data.editor as { first_name: string | null; last_name: string | null } | null;
  const editorName = [editor?.first_name, editor?.last_name].filter(Boolean).join(" ");

  return {
    sections: parsed.data.sections,
    updatedAt: data.created_at,
    updatedByName: editorName || null,
  };
}

export async function saveTutorManual(sections: TutorManualSection[]): Promise<TutorManual> {
  const { profile } = await requireAdmin();
  const parsed = tutorManualSchema.parse({ sections });

  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from(Table.TutorManualVersions)
    .insert({ sections: parsed.sections, created_by: profile.id })
    .select("created_at")
    .single();

  if (error) {
    await logError(error, { function: "saveTutorManual" }, "tutor_manual_error");
    throw new Error("Unable to save the tutor manual");
  }

  revalidatePath(MANUAL_PATH);

  return {
    sections: parsed.sections,
    updatedAt: data.created_at,
    updatedByName: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null,
  };
}
