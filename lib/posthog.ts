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
export function serializeForPosthog(value: unknown, options?: { redact?: boolean }): string {
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
 * PostHog properties are flat; nested objects are often truncated or dropped.
 * Stringify objects/arrays/errors so full messages appear in the UI.
 */
function serializeForPostHog(value: unknown): string | number | boolean | null {
  if (value === null) return null;
  if (value === undefined) return null;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    return value as string | number | boolean;
  }
  if (value instanceof Error) {
    return JSON.stringify({
      name: value.name,
      message: value.message,
      stack: value.stack,
    });
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function normalizePropertiesForPostHog(
  properties?: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  if (!properties) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    out[key] = serializeForPostHog(value);
  }
  return out;
}

/**
 * Get or create PostHog client instance
 * Uses singleton pattern to reuse connection
 */
function getPostHogClient(): PostHog | null {
  // Return null if PostHog is not configured (graceful degradation)
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !process.env.NEXT_PUBLIC_POSTHOG_HOST) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      // Ordinary events explicitly flush below. A larger queue lets bulk audit events
      // enqueue all rows and make one network request instead of one request per row.
      flushAt: 100,
      flushInterval: 0,
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
  distinctId?: string,
  options?: { flush?: boolean; includePropertiesJson?: boolean },
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
    const normalized = normalizePropertiesForPostHog({
      ...properties,
      timestamp: new Date().toISOString(),
    });
    client.capture({
      distinctId: distinctId || "zoom-webhook",
      event: eventName,
      properties: {
        ...normalized,
        ...(options?.includePropertiesJson === false
          ? {}
          : { properties_json: serializeForPosthog(flatProps) }),
      },
    });

    if (options?.flush !== false) {
      await client.flush();
    }
  } catch (error) {
    // Log error but don't throw - we don't want PostHog failures to break webhooks
    console.error("PostHog logging error:", error);
  }
}

async function flushPostHog(): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;

  try {
    await client.flush();
  } catch (error) {
    console.error("PostHog flush error:", error);
  }
}

export type DestructiveActivityActor = {
  type: "user" | "system";
  userId?: string;
  profileId?: string;
  role?: string;
};

export type DestructiveActivityContext = {
  actor: DestructiveActivityActor;
  source: string;
  reason?: string;
  relatedResourceType?: string;
  relatedResourceIds?: string[];
};

type DestructiveActivityInput = DestructiveActivityContext & {
  resourceType: string;
  resourceId?: string | null;
  deletedObject: unknown;
  flush?: boolean;
};

function getDeletedObjectId(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("id" in value)) return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
}

/**
 * Record a completed destructive action with a redacted snapshot of the deleted row.
 * Logging is best-effort: PostHog failures never make the already-completed deletion fail.
 */
export async function logDestructiveActivity({
  actor,
  source,
  reason,
  relatedResourceType,
  relatedResourceIds,
  resourceType,
  resourceId,
  deletedObject,
  flush = true,
}: DestructiveActivityInput): Promise<void> {
  const resolvedResourceId = resourceId ?? getDeletedObjectId(deletedObject);
  const distinctId = actor.userId ?? actor.profileId ?? `system:${source}`;

  await logEvent(
    "destructive_activity",
    {
      action: "delete",
      resource_type: resourceType,
      resource_id: resolvedResourceId,
      source,
      reason,
      actor_type: actor.type,
      actor_user_id: actor.userId,
      actor_profile_id: actor.profileId,
      actor_role: actor.role,
      related_resource_type: relatedResourceType,
      related_resource_ids_json: relatedResourceIds
        ? serializeForPosthog(relatedResourceIds)
        : undefined,
      deleted_object_json: serializeForPosthog(deletedObject),
    },
    distinctId,
    {
      flush,
      // The deleted snapshot already has a dedicated property. Copying it into the
      // aggregate JSON property doubles sensitive data and can truncate useful context.
      includePropertiesJson: false,
    },
  );
}

/** Log bulk deletions as individual events so every deleted row keeps a complete snapshot. */
export async function logDestructiveActivities(
  input: DestructiveActivityContext & {
    resourceType: string;
    deletedObjects: unknown[];
  },
): Promise<void> {
  for (const deletedObject of input.deletedObjects) {
    await logDestructiveActivity({
      ...input,
      deletedObject,
      flush: false,
    });
  }
  await flushPostHog();
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
 *
 * `eventName` defaults to "zoom_webhook_error" for backward compatibility with the
 * original Zoom-webhook-only callers. Every other caller should pass an explicit,
 * domain-specific event name (e.g. "enrollment_error") so errors aren't all bucketed
 * under the Zoom webhook event in PostHog.
 */
export async function logError(
  error: Error | unknown,
  context?: Record<string, any>,
  eventName: string = "zoom_webhook_error",
  distinctId?: string,
) {
  const errorMessage = messageFromUnknown(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorName = nameFromUnknown(error);

  const errorPayload =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { thrown: error };

  await logEvent(
    eventName,
    {
      ...context,
      error_name: errorName,
      error_message: errorMessage,
      error_stack: errorStack,
      error_json: serializeForPosthog(errorPayload, { redact: false }),
      context_json: context ? serializeForPosthog(context) : undefined,
    },
    distinctId,
  );
}

// Export the client function for direct use if needed
export default function PostHogClient() {
  return getPostHogClient();
}
