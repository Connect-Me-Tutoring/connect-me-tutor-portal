import { supabase } from "@/lib/supabase/client";
import { Enrollment } from "@/types";
import { WeeklyMeetingSchedule } from "@/types/meeting";
import { tableToInterfaceWeeklyMeetingSchedule, tableToInterfaceEnrollments } from "@/lib/type-utils";

export const getWeeklyMeetingSchedules = async (): Promise<WeeklyMeetingSchedule[]> => {
  const { data, error } = await supabase
    .from("weekly_meeting_schedules")
    .select("*");
  if (error) throw error;
  return (data ?? []).map(tableToInterfaceWeeklyMeetingSchedule);
};

export const getActiveEnrollmentsWithMeetings = async (): Promise<Enrollment[]> => {
  const { data, error } = await supabase
    .from("Enrollments")
    .select(`
      id, created_at, summary, start_date, end_date,
      availability, day, start_time, end_time,
      meetingId, paused, duration, frequency,
      student:Profiles!student_id(*),
      tutor:Profiles!tutor_id(*)
    `)
    .eq("paused", false)
    .not("meetingId", "is", null);
  if (error) throw error;
  return (data ?? []).map(tableToInterfaceEnrollments);
};
