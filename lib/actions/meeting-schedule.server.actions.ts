"use server";
import { createClient } from "../supabase/server";
import { WeeklyMeetingSchedule } from "@/types/meeting";
import {
  interfaceToTableWeeklyMeetingSchedule,
  tableToInterfaceWeeklyMeetingSchedule,
} from "@/lib/type-utils";

export const getWeeklyMeetingSchedules = async (): Promise<WeeklyMeetingSchedule[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("weekly_meeting_schedules").select("*");
  if (error) throw error;
  return (data ?? []).map(tableToInterfaceWeeklyMeetingSchedule);
};

export const updateWeeklyMeetingSchedule = async (slot: WeeklyMeetingSchedule) => {
  const supabase = await createClient();
  const row = interfaceToTableWeeklyMeetingSchedule(slot);
  const { error } = await supabase
    .from("weekly_meeting_schedules")
    .upsert(row, { onConflict: "id" });
  if (error) throw error;
};
