export interface WeeklyMeetingSchedule {
  id: string;
  createdAt: string;
  meetingId: string | null;
  title: string;
  description: string;
  dayOfWeek: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}
