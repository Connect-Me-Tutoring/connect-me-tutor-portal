import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFrom = vi.fn();
const mockSupabase = vi.fn(() => ({
  from: mockFrom,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase()),
}));

const { GET } = await import("./route");

const authorizedRequest = () =>
  new Request("http://localhost/api/cron/cancel-unsubmitted-sef", {
    headers: { authorization: "Bearer test-secret" },
  }) as any;

describe("GET /api/cron/cancel-unsubmitted-sef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
  });

  it("should return 401 without cron authorization", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/cancel-unsubmitted-sef") as any,
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should return 401 with the wrong cron authorization", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/cancel-unsubmitted-sef", {
        headers: { authorization: "Bearer wrong-value" },
      }) as any,
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("should return success with cancelled count when sessions exist", async () => {
    const mockSessions = [
      { tutor_id: "tutor-1", session_date: "2024-01-01", status: "Active" },
      { tutor_id: "tutor-2", session_date: "2024-01-02", status: "Active" },
      { tutor_id: "tutor-1", session_date: "2024-01-03", status: "Active" },
    ];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
            }),
          }),
        };
      } else {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
    });

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe("Successfully cancelled unsubmitted SEFs");
    expect(json.cancelled).toBe(3);
  });

  it("should return 0 cancelled when no sessions match", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }));

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe("No sessions to cancel");
    expect(json.cancelled).toBe(0);
  });

  it("should return 500 when fetch fails", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Fetch failed" },
          }),
        }),
      }),
    }));

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fetch sessions");
  });

  it("should return 500 when update fails", async () => {
    const mockSessions = [
      { tutor_id: "tutor-1", session_date: "2024-01-01", status: "Active" },
    ];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
            }),
          }),
        };
      } else {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi
                .fn()
                .mockResolvedValue({ error: { message: "Update failed" } }),
            }),
          }),
        };
      }
    });

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to cancel sessions");
  });

  it("should return 500 when unexpected error occurs", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });
});
