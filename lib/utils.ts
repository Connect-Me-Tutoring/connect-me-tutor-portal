import { Availability } from "@/types";
import { type ClassValue, clsx } from "clsx";
import { yearsToDays } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getData = async (endpoint: any) => {
  const response = await fetch(`/${endpoint}`, {
    method: "",
  });
  const data = await response.json();

  return data;
};

export const postData = async (endpoint: any, body: any) => {
  const allHeaders = { "Content-Type": "application/json" };

  const response = await fetch(`/${endpoint}`, {
    method: "POST",
    headers: allHeaders,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return data;
};

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
    timeZoneName?:
      | "short"
      | "long"
      | "shortOffset"
      | "longOffset"
      | "shortGeneric"
      | "longGeneric";
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
    timeZone: options.timeZone ? options.timeZone : "America/New_York",
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
    timeZone: "America/New_York",
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
    hour12: true,
    timeZone: "America/New_York",
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
  // const startTimeStr = formatTime(originalTime);
  // const endTimeStr = formatTime(endTime);
  const startTimeStr = originalTime.toLocaleTimeString("en-US", options);
  const endTimeStr = endTime.toLocaleTimeString("en-US", options);

  return `${startTimeStr} - ${endTimeStr}`;
}

function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const isPM = hours >= 12;

  // Convert to 12-hour format
  hours = hours % 12 || 12; // convert 0 to 12

  // Format minutes to be 0 or 30 if applicable
  const formattedMinutes =
    minutes === 0 ? "" : `:${minutes < 10 ? "0" : ""}${minutes}`;

  // Construct the final formatted string
  return `${hours}${formattedMinutes} ${isPM ? "PM" : "AM"}`;
}

export function formatStandardToMilitaryTime(standardTime: string): string {
  const regex = /^(0?[1-9]|1[0-2]):[0-5][0-9]:[0-5][0-9] [APap][Mm]$/;

  if (!regex.test(standardTime)) {
    return "Invalid time format";
  }

  let [time, period] = standardTime.split(" ");
  let [hours, minutes, seconds] = time.split(":").map(Number);

  if (period.toUpperCase() === "PM") {
    hours = (hours % 12) + 12;
  } else if (hours === 12) {
    // handles edge case of 12 AM
    hours = 0;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function getToday(): string {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yyyy = today.getFullYear();

  const currentDate = `${mm}/${dd}/${yyyy}`;

  return currentDate;
}

export function addYearsToDate(date: string, years: number): string {
  const [month, day, year] = date.split("/").map(Number);
  let newYear = year + years;
  return `${month.toString().padStart(2, "0")}/${day
    .toString()
    .padStart(2, "0")}/${newYear.toString().padStart(2, "0")} `;
}

export function addOneHourToMilitaryTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  let newHours = hours + 1;
  let newMinutes = minutes;

  if (newHours === 24) {
    newHours = 0;
  }

  return `${newHours.toString().padStart(2, "0")}:${newMinutes
    .toString()
    .padStart(2, "0")}`;
}

export function formatMilitaryToStandardTime(militaryTime: string) {
  // Check if the input is in valid military time format
  if (!/^\d{2}:\d{2}$/.test(militaryTime)) {
    return "Invalid time format";
  }

  let [hours, minutes] = militaryTime.split(":").map(Number);

  // Adjust for times past midnight (e.g., 24:00)
  if (hours === 24) {
    hours = 0;
  }

  const period = hours < 12 ? "AM" : "PM";

  // Convert to 12-hour format
  hours = hours % 12 || 12;

  return `${hours}:${minutes.toString().padStart(2, "0")}${period}`;
}

export const formatSessionDuration = (duration: number) => {
  const hours = Math.floor(duration);
  const minutes = Math.round((duration - hours) * 60);

  return `${hours > 0 ? `${hours} hr${hours > 1 ? "s" : ""}` : ""} ${
    minutes > 0 ? `${minutes} min${minutes > 1 ? "s" : ""}` : ""
  }`.trim();
};

export function to12Hour(time24: string) {
  let [hour, minute] = time24.split(":").map(Number);
  const ampm = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12; // convert 0 to 12 for 12am
  return `${hour}${minute === 0 ? "" : `:${minute.toString().padStart(2, "0")}`}${ampm}`;
}

export const to12HourWithMinutes = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

/**
 *
 * @param timeStr - string representation of time in HH:MM
 */

export function timeStrToHours(timeStr: string) {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  const isValid = timeRegex.test(timeStr);

  if (isValid) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours + minutes / 60;
  } else {
    throw new Error("time string not in HH:MM format");
  }
}

export function capitalizeFirstLetter(word: string | undefined) {
  if (typeof word !== "string" || word.length == 0) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export const handleCalculateDuration = async (
  startTime: string,
  endTime: string,
) => {
  try {
    const startTimeNumber: number = timeStrToHours(startTime);
    const endTimeNumber: number = timeStrToHours(endTime);
    let difference = endTimeNumber - startTimeNumber;
    if (difference < 0) {
      difference += 24;
    }

    return difference;
  } catch (error) {
    console.error("Unable to calculate duration", error);
  }
};

export async function createPassword(length: number = 16): Promise<string> {
  // Character sets for password generation
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = lowercase + uppercase + numbers + symbols;

  // Use crypto.getRandomValues for cryptographically secure randomness
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let password = "";

  // Ensure at least one character from each character set
  const guaranteedChars = [
    lowercase[array[0] % lowercase.length],
    uppercase[array[1] % uppercase.length],
    numbers[array[2] % numbers.length],
    symbols[array[3] % symbols.length],
  ];

  // Fill remaining positions with random characters from all sets
  for (let i = 4; i < length; i++) {
    password += allChars[array[i] % allChars.length];
  }

  // Add guaranteed characters
  password += guaranteedChars.join("");

  // Shuffle the password to randomize guaranteed character positions
  return shuffleString(password);
}

function shuffleString(str: string): string {
  const array = str.split("");
  const randomArray = new Uint8Array(array.length);
  crypto.getRandomValues(randomArray);

  // Fisher-Yates shuffle with crypto random
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomArray[i] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array.join("");
}

export const toDateTime = (time: string, day: Number) => {
  if (!time) {
    return new Date(NaN);
  }
  const [hourStr, minuteStr] = time.split(":");
  const parsedDate = new Date();
  while (parsedDate.getDay() !== day) {
    parsedDate.setDate(parsedDate.getDate() + 1);
  }
  parsedDate.setHours(parseInt(hourStr), parseInt(minuteStr), 0, 0);
  return parsedDate;
};

export const formatAvailabilityAsDate = (date: Availability): Date[] => {
  try {
    type DayName =
      | "Sunday"
      | "Monday"
      | "Tuesday"
      | "Wednesday"
      | "Thursday"
      | "Friday"
      | "Saturday";
    const dayMap: { [key in DayName]: number } = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const dayIndex = dayMap[date.day as DayName];
    if (dayIndex === undefined) {
      throw new Error("Invalid Day of the Week");
    }
    return [
      toDateTime(date.startTime, dayIndex),
      toDateTime(date.endTime, dayIndex),
    ];
  } catch (error) {
    console.error("Failed to Format Date", error);

    const date5am = new Date(2024, 1, 23, 5, 0, 0, 0);
    return [date5am, date5am];
  }
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};
