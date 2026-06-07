"use server";
import { createAdminClient } from "../supabase/server";
import { WeeklyMeetingSchedule } from "@/types/meeting";
import { interfaceToTableWeeklyMeetingSchedule } from "@/lib/type-utils";

export const updateWeeklyMeetingSchedule = async (slot: WeeklyMeetingSchedule) => {
  const supabase = await createAdminClient();
  const row = interfaceToTableWeeklyMeetingSchedule(slot);
  const { error } = await supabase
    .from("weekly_meeting_schedules")
    .upsert(row, { onConflict: "id" });
  if (error) throw error;
};
