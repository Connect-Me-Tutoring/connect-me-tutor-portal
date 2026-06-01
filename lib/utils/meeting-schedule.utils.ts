import { areIntervalsOverlapping } from "date-fns";
import { toDateTime } from "@/lib/utils";
import { Meeting } from "@/types";
import { WeeklyMeetingSchedule } from "@/types/meeting";

const DAY_INDEX: Record<WeeklyMeetingSchedule["dayOfWeek"], number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

const scheduleToRange = (s: Pick<WeeklyMeetingSchedule, "dayOfWeek" | "startTime" | "endTime">) => ({
  start: toDateTime(s.startTime, DAY_INDEX[s.dayOfWeek]),
  end: toDateTime(s.endTime, DAY_INDEX[s.dayOfWeek]),
});

export const checkAvailableMeetingForWeeklySchedules = (
  newSchedule: Pick<WeeklyMeetingSchedule, "dayOfWeek" | "startTime" | "endTime">,
  existingSchedules: WeeklyMeetingSchedule[],
  meetings: Meeting[]
): Record<string, boolean> => {
  const availability: Record<string, boolean> = Object.fromEntries(
    meetings.map((m) => [m.id, true])
  );

  const newRange = scheduleToRange(newSchedule);

  for (const schedule of existingSchedules) {
    if (schedule.dayOfWeek !== newSchedule.dayOfWeek || !schedule.meetingId) continue;
    if (!availability[schedule.meetingId]) continue;
    try {
      if (areIntervalsOverlapping(newRange, scheduleToRange(schedule))) {
        availability[schedule.meetingId] = false;
      }
    } catch {
      availability[schedule.meetingId] = false;
    }
  }

  return availability;
};
