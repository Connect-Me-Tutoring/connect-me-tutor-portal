import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyAdmin } from "@/lib/actions/auth/server.actions";
import { applyPairingWorkflowPreview, runPairingWorkflow } from "@/lib/pairing";

vi.mock("@/lib/actions/auth/server.actions", () => ({
  verifyAdmin: vi.fn(),
}));

vi.mock("@/lib/security/cron", () => ({
  isCronRequestAuthorized: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/pairing", () => ({
  applyPairingWorkflowPreview: vi.fn(),
  runPairingWorkflow: vi.fn(),
}));

const { POST } = await import("./route");

function request(body: unknown) {
  return new Request("http://localhost/api/pairing", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

const validMatch = {
  student_id: "11111111-1111-1111-1111-111111111111",
  tutor_id: "22222222-2222-2222-2222-222222222222",
  similarity: 0.87,
};

const validLog = {
  message: "matched",
  type: "pairing-match" as const,
};

describe("POST /api/pairing (apply-preview)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifyAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it("rejects non-uuid ids in matchesToInsert", async () => {
    const response = await POST(
      request({
        mode: "apply-preview",
        preview: {
          matchesToInsert: [
            { student_id: "not-a-uuid", tutor_id: "also-not-a-uuid", similarity: 1 },
          ],
          logs: [],
        },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.message).toBe("Invalid preview payload");
    expect(applyPairingWorkflowPreview).not.toHaveBeenCalled();
  });

  it("rejects a log entry with an unrecognized type", async () => {
    const response = await POST(
      request({
        mode: "apply-preview",
        preview: {
          matchesToInsert: [validMatch],
          logs: [{ message: "x", type: "not-a-real-type" }],
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(applyPairingWorkflowPreview).not.toHaveBeenCalled();
  });

  // zod strips unknown keys rather than erroring, so this asserts 200 + a clean object.
  it("strips unknown fields off a match row", async () => {
    const response = await POST(
      request({
        mode: "apply-preview",
        preview: {
          matchesToInsert: [{ ...validMatch, is_admin: true }],
          logs: [validLog],
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(applyPairingWorkflowPreview).toHaveBeenCalledWith(
      { matchesToInsert: [validMatch], logs: [validLog] },
      { debug: false },
    );
  });

  // Matches the log shape from the logs.push() calls in lib/pairing/index.ts. If
  // someone adds a log type there and not to the enum, this should fail instead of
  // an admin's apply silently 400ing.
  it("accepts a real workflow log with metadata intact", async () => {
    (applyPairingWorkflowPreview as ReturnType<typeof vi.fn>).mockResolvedValue({
      insertedMatches: 1,
      insertedLogs: 1,
    });

    const realWorldLog = {
      message: "Ada Lovelace matched with Grace Hopper",
      type: "pairing-match" as const,
      role: "student" as const,
      error: false,
      metadata: {
        timestamp: "2026-08-28T00:00:00.000Z",
        pairing_request_id: "33333333-3333-3333-3333-333333333333",
        match_profile_id: "22222222-2222-2222-2222-222222222222",
        student_id: "11111111-1111-1111-1111-111111111111",
        tutor_id: "22222222-2222-2222-2222-222222222222",
        requestor_role: "student",
        requestor_name: "Ada Lovelace",
      },
    };

    const response = await POST(
      request({
        mode: "apply-preview",
        preview: { matchesToInsert: [validMatch], logs: [realWorldLog] },
      }),
    );

    expect(response.status).toBe(200);
    // metadata is free-form, so it has to survive key-for-key.
    expect(applyPairingWorkflowPreview).toHaveBeenCalledWith(
      { matchesToInsert: [validMatch], logs: [realWorldLog] },
      { debug: false },
    );
  });

  it("accepts the other log type the workflow emits", async () => {
    // pairing-selection-failed is the only other type currently pushed.
    (applyPairingWorkflowPreview as ReturnType<typeof vi.fn>).mockResolvedValue({
      insertedMatches: 0,
      insertedLogs: 1,
    });

    const response = await POST(
      request({
        mode: "apply-preview",
        preview: {
          matchesToInsert: [],
          logs: [
            {
              message: "Failed to find pairing for tutor Alan Turing",
              type: "pairing-selection-failed",
              role: "tutor",
              error: true,
              metadata: { timestamp: "2026-08-28T00:00:00.000Z" },
            },
          ],
        },
      }),
    );

    expect(response.status).toBe(200);
  });

  it("applies a well-formed preview", async () => {
    (applyPairingWorkflowPreview as ReturnType<typeof vi.fn>).mockResolvedValue({
      insertedMatches: 1,
      insertedLogs: 1,
    });

    const response = await POST(
      request({
        mode: "apply-preview",
        preview: { matchesToInsert: [validMatch], logs: [validLog] },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.persisted).toEqual({ insertedMatches: 1, insertedLogs: 1 });
    expect(runPairingWorkflow).not.toHaveBeenCalled();
  });
});
