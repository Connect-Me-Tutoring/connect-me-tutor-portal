import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEnrollmentsWithMissingSEF } from "@/lib/actions/enrollment.server.actions";

const mockFromDelete = vi.fn();
const mockDelete = vi.fn();
const mockSupabase = vi.fn(() => ({
  from: mockFromDelete,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase()),
}));

vi.mock("@/lib/actions/enrollment.server.actions", () => ({
  getEnrollmentsWithMissingSEF: vi.fn(),
}));

const { GET } = await import("./route");

const authorizedRequest = () =>
  new Request("http://localhost/api/cron/delete-inactive-enrollments", {
    headers: { authorization: "Bearer test-secret" },
  }) as any;

describe("DELETE /api/cron/delete-inactive-enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    mockFromDelete.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockDelete.mockReturnValue({
      in: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
  });

  it("should return 401 without cron authorization", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/delete-inactive-enrollments") as any,
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(getEnrollmentsWithMissingSEF).not.toHaveBeenCalled();
    expect(mockFromDelete).not.toHaveBeenCalled();
  });

  it("should return 401 with the wrong cron authorization", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/delete-inactive-enrollments", {
        headers: { authorization: "Bearer wrong-value" },
      }) as any,
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(getEnrollmentsWithMissingSEF).not.toHaveBeenCalled();
    expect(mockFromDelete).not.toHaveBeenCalled();
  });

  it("should return success with deleted count when enrollments exist", async () => {
    const mockEnrollments = [
      { id: "enrollment-1" },
      { id: "enrollment-2" },
      { id: "enrollment-3" },
    ];

    (getEnrollmentsWithMissingSEF as ReturnType<typeof vi.fn>).mockResolvedValue(mockEnrollments);

    const mockIn = vi.fn().mockResolvedValue({ error: null });
    mockFromDelete.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        in: mockIn,
      }),
    });

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe("Successfully deleted inactive enrollments");
    expect(json.deleted).toBe(3);
    expect(mockIn).toHaveBeenCalledWith("id", ["enrollment-1", "enrollment-2", "enrollment-3"]);
  });

  it("should return 0 deleted when no enrollments match", async () => {
    (getEnrollmentsWithMissingSEF as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe("No enrollments to delete");
    expect(json.deleted).toBe(0);
  });

  it("should return 500 when getEnrollmentsWithMissingSEF throws", async () => {
    (getEnrollmentsWithMissingSEF as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Database error"),
    );

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });

  it("should return 500 when delete fails", async () => {
    const mockEnrollments = [{ id: "enrollment-1" }];
    (getEnrollmentsWithMissingSEF as ReturnType<typeof vi.fn>).mockResolvedValue(mockEnrollments);

    const mockIn = vi.fn().mockResolvedValue({ error: { message: "Delete failed" } });
    mockFromDelete.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        in: mockIn,
      }),
    });

    const response = await GET(authorizedRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to delete enrollments");
  });
});
