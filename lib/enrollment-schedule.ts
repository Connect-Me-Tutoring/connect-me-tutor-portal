import type { Availability } from "@/types";

type EnrollmentScheduleSource = {
  day?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

const normalizeTime = (time?: string | null) => {
  if (!time) return "";
  return time.slice(0, 5);
};

const hasCompleteSchedule = (schedule: Availability) =>
  Boolean(schedule.day && schedule.startTime && schedule.endTime);

export function getEnrollmentSchedule(enrollment: EnrollmentScheduleSource): Availability {
  return {
    day: enrollment.day || "",
    startTime: normalizeTime(enrollment.startTime),
    endTime: normalizeTime(enrollment.endTime),
  };
}

export function getEnrollmentAvailability(enrollment: EnrollmentScheduleSource): Availability[] {
  const schedule = getEnrollmentSchedule(enrollment);
  return hasCompleteSchedule(schedule) ? [schedule] : [];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether an enrollment meets in the week starting at `weekStart`. Biweekly enrollments meet
 * every other week, counted from the week of their start date; everything else is weekly.
 * Both arguments should be Eastern week starts (getEasternWeekBounds).
 */
export function enrollmentMeetsInWeek(
  enrollment: { frequency?: string | null },
  enrollmentStartWeek: Date | null,
  weekStart: Date,
) {
  if (enrollment.frequency !== "biweekly" || !enrollmentStartWeek) return true;
  // Rounded because a DST change makes one week an hour shorter or longer.
  const weeks = Math.round((weekStart.getTime() - enrollmentStartWeek.getTime()) / WEEK_MS);
  return weeks % 2 === 0;
}

export function getEnrollmentScheduleFields(schedule?: Partial<Availability> | null) {
  const normalizedSchedule = getEnrollmentSchedule({
    day: schedule?.day,
    startTime: schedule?.startTime,
    endTime: schedule?.endTime,
  });

  return {
    day: normalizedSchedule.day || null,
    startTime: normalizedSchedule.startTime || null,
    endTime: normalizedSchedule.endTime || null,
  };
}

type EnrollmentFrequencySource = {
  frequency?: string | null;
  startDate?: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcDay = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);

/**
 * Whether an enrollment meets on the given calendar date (yyyy-MM-dd, Eastern).
 * Biweekly enrollments meet every other week, counted in 7-day blocks from the start date,
 * so the first slot on or after the start date is always a session week.
 * Every other frequency falls back to weekly.
 */
export function isEnrollmentSessionDate(
  enrollment: EnrollmentFrequencySource,
  sessionDate: string,
): boolean {
  if (enrollment.frequency !== "biweekly" || !enrollment.startDate) return true;

  const start = toUtcDay(enrollment.startDate);
  const session = toUtcDay(sessionDate);
  if (Number.isNaN(start) || Number.isNaN(session)) return true;

  const weeksSinceStart = Math.floor(Math.round((session - start) / MS_PER_DAY) / 7);
  return weeksSinceStart % 2 === 0;
}
