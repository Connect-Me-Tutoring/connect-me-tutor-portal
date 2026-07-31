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
