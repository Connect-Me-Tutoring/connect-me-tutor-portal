import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { capture, flush, PostHog } = vi.hoisted(() => ({
  capture: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  PostHog: vi.fn(function () {
    return { capture, flush };
  }),
}));

vi.mock("posthog-node", () => ({ PostHog }));

const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const originalHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

process.env.NEXT_PUBLIC_POSTHOG_KEY = "test-key";
process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example.com";

const { logDestructiveActivities, logDestructiveActivity, logEvent } = await import("./posthog");

describe("destructive activity logging", () => {
  beforeEach(() => {
    capture.mockClear();
    flush.mockClear();
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;

    if (originalHost === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = originalHost;
  });

  it("keeps immediate flushing and aggregate properties for ordinary events", async () => {
    await logEvent("ordinary_event", { source: "test" }, "user-1");

    const event = capture.mock.calls[0][0];
    expect(event.event).toBe("ordinary_event");
    expect(JSON.parse(event.properties.properties_json)).toMatchObject({ source: "test" });
    expect(flush).toHaveBeenCalledOnce();
  });

  it("captures the actor, resource, and a redacted deleted-row snapshot", async () => {
    await logDestructiveActivity({
      actor: {
        type: "user",
        userId: "auth-user-1",
        profileId: "profile-1",
        role: "Admin",
      },
      source: "removeSessionServer",
      reason: "manual_session_deletion",
      resourceType: "session",
      deletedObject: {
        id: "session-1",
        enrollment_id: "enrollment-1",
        token: "must-not-leak",
      },
    });

    expect(capture).toHaveBeenCalledOnce();
    const event = capture.mock.calls[0][0];
    expect(event).toMatchObject({
      distinctId: "auth-user-1",
      event: "destructive_activity",
      properties: {
        action: "delete",
        resource_type: "session",
        resource_id: "session-1",
        source: "removeSessionServer",
        reason: "manual_session_deletion",
        actor_type: "user",
        actor_user_id: "auth-user-1",
        actor_profile_id: "profile-1",
        actor_role: "Admin",
      },
    });
    expect(JSON.parse(event.properties.deleted_object_json)).toEqual({
      id: "session-1",
      enrollment_id: "enrollment-1",
      token: "[REDACTED]",
    });
    expect(event.properties).not.toHaveProperty("properties_json");
    expect(flush).toHaveBeenCalledOnce();
  });

  it("uses a stable system distinct ID for automated cleanup", async () => {
    await logDestructiveActivity({
      actor: { type: "system" },
      source: "deleteInactiveEnrollments",
      resourceType: "enrollment",
      deletedObject: { id: "enrollment-1" },
    });

    expect(capture.mock.calls[0][0].distinctId).toBe("system:deleteInactiveEnrollments");
  });

  it("emits one event per deleted object in a bulk deletion", async () => {
    await logDestructiveActivities({
      actor: { type: "system" },
      source: "deleteInactiveEnrollments",
      resourceType: "enrollment",
      deletedObjects: [{ id: "enrollment-1" }, { id: "enrollment-2" }],
    });

    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls.map(([event]) => event.properties.resource_id)).toEqual([
      "enrollment-1",
      "enrollment-2",
    ]);
    expect(flush).toHaveBeenCalledOnce();
  });
});
