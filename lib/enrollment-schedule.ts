import type { Availability, Enrollment } from "@/types";

type AvailabilityLike = Partial<Availability> & {
  start_time?: string | null;
  end_time?: string | null;
};

type EnrollmentScheduleSource = {
  availability?: Availability[] | null;
  day?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

const normalizeTime = (time?: string | null) => {
  if (!time) return "";
  return time.slice(0, 5);
};

const normalizeAvailability = (
  availability?: AvailabilityLike | null,
): Availability => ({
  day: availability?.day || "",
  startTime: normalizeTime(
    availability?.startTime || availability?.start_time,
  ),
  endTime: normalizeTime(availability?.endTime || availability?.end_time),
});

const hasCompleteSchedule = (schedule: Availability) =>
  Boolean(schedule.day && schedule.startTime && schedule.endTime);

const normalizeAvailabilityList = (
  availability?: EnrollmentScheduleSource["availability"],
) =>
  (availability || [])
    .map((slot) => normalizeAvailability(slot as AvailabilityLike))
    .filter(hasCompleteSchedule);

export function getEnrollmentSchedule(
  enrollment: EnrollmentScheduleSource,
): Availability {
  const fallback = normalizeAvailability(
    enrollment.availability?.[0] as AvailabilityLike | undefined,
  );

  return {
    day: enrollment.day || fallback.day,
    startTime: normalizeTime(enrollment.startTime || fallback.startTime),
    endTime: normalizeTime(enrollment.endTime || fallback.endTime),
  };
}

export function getEnrollmentAvailability(
  enrollment: EnrollmentScheduleSource,
): Availability[] {
  const schedule = getEnrollmentSchedule(enrollment);

  if (
    enrollment.day &&
    enrollment.startTime &&
    enrollment.endTime &&
    hasCompleteSchedule(schedule)
  ) {
    return [schedule];
  }

  return normalizeAvailabilityList(enrollment.availability);
}

export function getEnrollmentScheduleFields(
  enrollment: EnrollmentScheduleSource,
) {
  const schedule = getEnrollmentSchedule(enrollment);

  return {
    day: schedule.day || null,
    startTime: schedule.startTime || null,
    endTime: schedule.endTime || null,
  };
}

export function getEnrollmentScheduleForSave(
  enrollment: EnrollmentScheduleSource,
) {
  const submittedAvailability = normalizeAvailabilityList(
    enrollment.availability,
  );

  if (submittedAvailability.length > 0) {
    return {
      schedule: submittedAvailability[0],
      availability: submittedAvailability,
    };
  }

  const schedule = getEnrollmentSchedule(enrollment);

  return {
    schedule,
    availability: hasCompleteSchedule(schedule) ? [schedule] : [],
  };
}
