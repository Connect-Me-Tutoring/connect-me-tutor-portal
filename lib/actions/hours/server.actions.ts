"use server";

import { cache } from "react";
import { createClient } from "../../supabase/server";
import { requireTutorProfileAccess } from "../auth/authz.server";
import { logError } from "@/lib/posthog";

/**
 * Fetches hours for each student
 *@param {string} tutorId
 *@returns An array containing hours for each student
 */
export const getSessionHoursByStudent = cache(async (tutorId: string) => {
  await requireTutorProfileAccess(tutorId);
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("get_session_hours_by_student", {
      p_tutor_id: tutorId,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching hours by student", error);
    await logError(error, { action: "getSessionHoursByStudent", tutorId }, "hours_error");
    throw error;
  }
});

/**
 * Fetches event details for the tutor's dashboard
 * @param {string} tutorId
 */
export const getAllEventDetailsForTutor = async (tutorId: string) => {
  await requireTutorProfileAccess(tutorId);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_all_event_details_for_tutor", {
      p_tutor_id: tutorId,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching event details", error);
    await logError(error, { action: "getAllEventDetailsForTutor", tutorId }, "hours_error");
    throw error;
  }
};
