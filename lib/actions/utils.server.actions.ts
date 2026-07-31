"use server";

export const formatDateServer = async (
  dateString: string,
  params: {
    includeTime?: boolean;
    includeDate?: boolean;
  },
) => {
  const { includeTime = false, includeDate = false } = params;
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
};
