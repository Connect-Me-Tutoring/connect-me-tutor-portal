import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const EASTERN_TIMEZONE = "America/New_York";

export const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Start/end (as real UTC instants) of the school week containing `referenceDate`,
 * where "week" is defined in America/New_York wall-clock time. Correct regardless
 * of what timezone the calling code (browser or server) happens to run in, since
 * it derives the week purely from Eastern wall-clock fields rather than from
 * whichever local timezone `referenceDate` was constructed in.
 */
export function getEasternWeekBounds(
  referenceDate: Date = new Date(),
  weekStartsOn: 0 | 1 = 0,
): { weekStart: Date; weekEnd: Date } {
  const zonedReference = toZonedTime(referenceDate, EASTERN_TIMEZONE);
  return {
    weekStart: fromZonedTime(startOfWeek(zonedReference, { weekStartsOn }), EASTERN_TIMEZONE),
    weekEnd: fromZonedTime(endOfWeek(zonedReference, { weekStartsOn }), EASTERN_TIMEZONE),
  };
}

/**
 * Moves `oldDateISO` to the given day/time within the same America/New_York school week
 * (per getEasternWeekBounds), for re-anchoring an existing session's date when an
 * enrollment's recurring schedule changes.
 */
export function computeSessionDateForSchedule(
  oldDateISO: string,
  day: string,
  startTime: string,
): string {
  const { weekStart } = getEasternWeekBounds(new Date(oldDateISO));
  const dayIndex = DAY_NAME_TO_INDEX[day.toLowerCase()];
  const newLocalDate = addDays(toZonedTime(weekStart, EASTERN_TIMEZONE), dayIndex);
  const dateString = `${format(newLocalDate, "yyyy-MM-dd")}T${startTime}:00`;
  return fromZonedTime(dateString, EASTERN_TIMEZONE).toISOString();
}

export function formatSessionDate(dateString: string): string {
  // Create a new Date object
  const date: Date = new Date(dateString);
  // Define options for formatting
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long", // Can be 'short' or 'numeric' for different formats
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    // second: "numeric",
    timeZoneName: "short", // To include time zone information
  };

  // Format the date using toLocaleDateString
  return date.toLocaleDateString("en-US", options);
}

export function formatDate(dateString: string): string {
  // Create a new Date object
  const date: Date = new Date(dateString);

  // Define options for formatting
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long", // Can be 'short' or 'numeric' for different formats
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    timeZoneName: "short", // To include time zone information
  };

  // Format the date using toLocaleDateString
  return date.toLocaleDateString("en-US", options);
}

/**
 * Formats a date string with customizable options for display.
 *
 * @param dateString - The date string to format (should be parseable by the Date constructor)
 * @param options - Configuration options for formatting the date
 * @param options.includeYear - Whether to include the year in the output
 * @param options.includeMonth - Whether to include the month in the output
 * @param options.includeDay - Whether to include the day in the output
 * @param options.includeHour - Whether to include the hour in the output
 * @param options.includeMinute - Whether to include the minute in the output
 * @param options.includeSecond - Whether to include the second in the output
 * @param options.timeZone - The IANA timezone identifier (defaults to "America/New_York")
 * @param options.timeZoneName - The format for displaying the timezone name (defaults to "short")
 *
 * @returns The formatted date string
 *
 * @example
 * ```typescript
 * formatDateWithOptions("2024-01-15T10:30:00Z", {
 *   includeYear: true,
 *   includeMonth: true,
 *   includeDay: true,
 *   includeHour: true,
 *   includeMinute: true
 * });
 * ```
 */
export function formatDateWithOptions(
  dateString: string,
  options: {
    year?: boolean;
    month?: boolean;
    day?: boolean;
    hour?: boolean;
    minute?: boolean;
    second?: boolean;
    timeZone?: string;
    timeZoneName?: "short" | "long" | "shortOffset" | "longOffset" | "shortGeneric" | "longGeneric";
  },
): string {
  const date: Date = new Date(dateString);

  const dateOptions: Intl.DateTimeFormatOptions = {
    year: options.year ? "numeric" : undefined,
    month: options.month ? "long" : undefined,
    day: options.day ? "numeric" : undefined,
    hour: options.hour ? "numeric" : undefined,
    minute: options.minute ? "numeric" : undefined,
    second: options.second ? "numeric" : undefined,
    timeZone: options.timeZone ? options.timeZone : EASTERN_TIMEZONE,
    timeZoneName: options.timeZoneName ? options.timeZoneName : undefined,
  };

  return date.toLocaleDateString("en-US", dateOptions);
}

export function formatDateAdmin(
  dateString: string,
  params?: {
    includeTime?: boolean;
    includeDate?: boolean;
  },
): string {
  const { includeTime = true, includeDate = true } = params
    ? params
    : { includeTime: true, includeDate: true };

  // Create a new Date object
  const date: Date = new Date(dateString);

  // Define options for formattings

  const options: Intl.DateTimeFormatOptions = {
    year: includeDate ? "numeric" : undefined,
    month: includeDate ? "long" : undefined, // Can be 'short' or 'numeric' for different formats
    day: includeDate ? "numeric" : undefined,
    hour: includeTime ? "numeric" : undefined,
    minute: includeTime ? "numeric" : undefined,
    second: includeTime ? "numeric" : undefined,
    timeZone: EASTERN_TIMEZONE,
    timeZoneName: "short", // To include time zone information
  };

  // Format the date using toLocaleDateString
  return date.toLocaleDateString("en-US", options);
}

export function formatDateUTC(
  dateString: string,
  params: {
    includeTime?: boolean;
    includeDate?: boolean;
  },
) {
  const date: Date = new Date(dateString);

  const { includeTime = true, includeDate = true } = params;

  const options: Intl.DateTimeFormatOptions = {
    year: includeDate ? "numeric" : undefined,
    month: includeDate ? "long" : undefined, // Can be 'short' or 'numeric' for different formats
    day: includeDate ? "numeric" : undefined,
    hour: includeTime ? "numeric" : undefined,
    minute: includeTime ? "numeric" : undefined,
    second: includeTime ? "numeric" : undefined,
    timeZone: "UTC",
    // timeZoneName: "short", // To include time zone information
  };

  return date.toLocaleDateString("en-US", options);
}

export function getSessionTimespan(timeStr: string, duration: number): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: EASTERN_TIMEZONE,
    // timeZoneName: "short", // To include time zone information
  };

  // Parse the input string into a Date object
  const originalTime = new Date(timeStr);

  // Check if the date is valid
  if (isNaN(originalTime.getTime())) {
    throw new Error("Invalid date format: " + timeStr);
  }

  // // Add 1.5 hours (1 hour and 30 minutes)
  // Add 1 hour * duration
  const endTime = new Date(originalTime.getTime() + 60 * 60 * 1000 * duration); // Had originally multiplied by 1.5 for endtime

  // Format start and end times
  const startTimeStr = originalTime.toLocaleTimeString("en-US", options);
  const endTimeStr = endTime.toLocaleTimeString("en-US", options);

  return `${startTimeStr} - ${endTimeStr}`;
}
