const KNOWN_ERRORS: Array<[RegExp | string, string]> = [
  [/minified react error/i, "Something went wrong. Please refresh the page or try again."],
  [/react\.dev\/errors/i, "Something went wrong. Please refresh the page or try again."],
  [/invalid (?:login )?credentials/i, "Invalid email or password. Please try again."],
  [/email not confirmed/i, "Please confirm your email address before logging in."],
  [/user already registered/i, "An account with this email address already exists."],
  [/token has expired/i, "The code or link has expired. Please request a new one."],
  [/invalid token|token is invalid/i, "The code entered is invalid. Please try again."],
  [/rate limit|too many requests/i, "Too many attempts. Please wait a minute and try again."],
  [/jwt expired/i, "Your session has expired. Please sign in again."],
  [/duplicate key|unique constraint/i, "An entry with these details already exists."],
  [/violates not-null constraint/i, "Please fill in all required fields."],
  [
    /failed to fetch|networkerror|network request failed/i,
    "Network error. Please check your internet connection.",
  ],
];

function isTechnicalError(text: string): boolean {
  return (
    /minified react/i.test(text) ||
    /react\.dev\/errors/i.test(text) ||
    /digest:\s*[a-z0-9_-]+/i.test(text) ||
    /postgres|supabase|pgrst|relation ".*" does not exist|column ".*" of relation/i.test(text) ||
    /syntax error at or near|violates .* constraint/i.test(text) ||
    /\bat\s+(?:[a-zA-Z0-9_$.<>]+\s+)?\(?[a-zA-Z0-9_\/\\:.-]+:\d+:\d+\)?/i.test(text) ||
    /\b(?:[a-zA-Z]:\\|\/(?:var|etc|usr|home|app|node_modules))[a-zA-Z0-9_.\/\\-]+/i.test(text) ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(text) ||
    /Webpack|Turbopack|ChunkLoadError|Invariant Violation/i.test(text)
  );
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) return fallback;

  let message = "";
  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    message = (error as { message: string }).message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "error_description" in error &&
    typeof (error as { error_description?: unknown }).error_description === "string"
  ) {
    message = (error as { error_description: string }).error_description;
  } else {
    message = String(error);
  }

  const clean = message.trim();
  if (
    !clean ||
    clean === "[object Object]" ||
    clean === "[object Error]" ||
    clean === "undefined" ||
    clean === "null"
  ) {
    return fallback;
  }

  for (const [pattern, friendly] of KNOWN_ERRORS) {
    const match =
      typeof pattern === "string"
        ? clean.toLowerCase().includes(pattern.toLowerCase())
        : pattern.test(clean);
    if (match) return friendly;
  }

  if (isTechnicalError(clean)) {
    return fallback;
  }

  return clean;
}

export const getUserFriendlyErrorMessage = getErrorMessage;
