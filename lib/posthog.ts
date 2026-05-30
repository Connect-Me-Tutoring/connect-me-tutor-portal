import { PostHog } from "posthog-node";

// Singleton pattern to reuse PostHog client instance
let posthogClient: PostHog | null = null;

const MAX_JSON_STRING_LENGTH = 24_000;

/** Keys (and substrings) that should never appear verbatim in PostHog JSON blobs */
const SENSITIVE_KEY_PATTERN =
  /^(plainToken|encryptedToken|authorization|password|secret|token|apikey|api_key|access_token|refresh_token)$/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key) || key.toLowerCase().includes("secret");
}

/**
 * Recursively redact sensitive fields before logging (tokens, secrets).
 */
export function redactForLogging(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactForLogging);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isSensitiveKey(k)) {
      out[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object") {
      out[k] = redactForLogging(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * JSON snapshot safe for PostHog: handles Error, circular refs, truncation.
 * Use for `*_json` properties so nested activity is visible in the event stream.
 */
export function serializeForPosthog(
  value: unknown,
  options?: { redact?: boolean },
): string {
  const redact = options?.redact !== false;
  const input = redact ? redactForLogging(value) : value;
  const seen = new WeakSet<object>();

  try {
    const json = JSON.stringify(
      input,
      (key, val) => {
        if (val instanceof Error) {
          return {
            name: val.name,
            message: val.message,
            stack: val.stack,
          };
        }
        if (val !== null && typeof val === "object") {
          if (seen.has(val as object)) return "[Circular]";
          seen.add(val as object);
        }
        return val;
      },
      0,
    );
    if (json.length > MAX_JSON_STRING_LENGTH) {
      return `${json.slice(0, MAX_JSON_STRING_LENGTH)}...[truncated ${json.length - MAX_JSON_STRING_LENGTH} chars]`;
    }
    return json;
  } catch (e) {
    return JSON.stringify({
      serialize_error: String(e),
      fallback: typeof value === "string" ? value.slice(0, 500) : "[unserializable]",
    });
  }
}

/**
 * Get or create PostHog client instance
 * Uses singleton pattern to reuse connection
 */
function getPostHogClient(): PostHog | null {
  // Return null if PostHog is not configured (graceful degradation)
  if (
    !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    !process.env.NEXT_PUBLIC_POSTHOG_HOST
  ) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1, // Flush immediately for real-time debugging
      flushInterval: 0, // Disable interval flushing, use immediate
    });
  }

  return posthogClient;
}

/**
 * Log an event to PostHog with properties
 * Gracefully handles cases where PostHog is not configured
 */
export async function logEvent(
  eventName: string,
  properties?: Record<string, any>,
  distinctId?: string
) {
  const client = getPostHogClient();
  if (!client) {
    // Silently fail if PostHog is not configured
    return;
  }

  const ts = new Date().toISOString();
  const flatProps = {
    ...properties,
    timestamp: ts,
  };

  try {
    client.capture({
      distinctId: distinctId || "zoom-webhook",
      event: eventName,
      properties: {
        ...flatProps,
        // Single searchable blob for PostHog (nested objects are easier to inspect as text)
        properties_json: serializeForPosthog(flatProps),
      },
    });

    // Flush immediately for real-time debugging
    await client.flush();
  } catch (error) {
    // Log error but don't throw - we don't want PostHog failures to break webhooks
    console.error("PostHog logging error:", error);
  }
}

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === "string") return m;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function nameFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (error && typeof error === "object" && "code" in error) {
    const c = (error as { code: unknown }).code;
    if (typeof c === "string" && c.length > 0) return `Error_${c}`;
  }
  return "NonErrorThrow";
}

/**
 * Log an error event to PostHog (full `context` + `error` snapshots as JSON strings)
 */
export async function logError(
  error: Error | unknown,
  context?: Record<string, any>,
  distinctId?: string
) {
  const errorMessage = messageFromUnknown(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorName = nameFromUnknown(error);

  const errorPayload =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { thrown: error };

  await logEvent(
    "zoom_webhook_error",
    {
      ...context,
      error_name: errorName,
      error_message: errorMessage,
      error_stack: errorStack,
      error_json: serializeForPosthog(errorPayload, { redact: false }),
      context_json: context ? serializeForPosthog(context) : undefined,
    },
    distinctId
  );
}

// Export the client function for direct use if needed
export default function PostHogClient() {
  return getPostHogClient();
}
