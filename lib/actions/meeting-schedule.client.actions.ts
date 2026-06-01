import { supabase } from "@/lib/supabase/client";
import { WeeklyMeetingSchedule } from "@/types/meeting";
import { tableToInterfaceWeeklyMeetingSchedule } from "@/lib/type-utils";

export const getWeeklyMeetingSchedules = async (): Promise<WeeklyMeetingSchedule[]> => {
  const { data, error } = await supabase
    .from("weekly_meeting_schedules")
    .select("*");
  if (error) throw error;
  return (data ?? []).map(tableToInterfaceWeeklyMeetingSchedule);
};
