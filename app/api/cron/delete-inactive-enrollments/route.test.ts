import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEnrollmentsWithMissingSEF } from "@/lib/actions/enrollment.server.actions";

// Setup mocks before importing the route
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

// Now import after mocks are set up
const { GET } = await import("./route");

describe("DELETE /api/cron/delete-inactive-enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.resetModules();
  });

  it("should return success with deleted count when enrollments exist", async () => {
    const mockEnrollments = [
      { id: "enrollment-1" },
      { id: "enrollment-2" },
      { id: "enrollment-3" },
    ];

    (
      getEnrollmentsWithMissingSEF as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockEnrollments);

    // Set up the mock chain properly
    const mockIn = vi.fn().mockResolvedValue({ error: null });
    mockFromDelete.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        in: mockIn,
      }),
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe("Successfully deleted inactive enrollments");
    expect(json.deleted).toBe(3);
    expect(mockIn).toHaveBeenCalledWith("id", [
      "enrollment-1",
      "enrollment-2",
      "enrollment-3",
    ]);
  });

  it("should return 0 deleted when no enrollments match", async () => {
    (
      getEnrollmentsWithMissingSEF as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe("No enrollments to delete");
    expect(json.deleted).toBe(0);
  });

  it("should return 500 when getEnrollmentsWithMissingSEF throws", async () => {
    (
      getEnrollmentsWithMissingSEF as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error("Database error"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });

  it("should return 500 when delete fails", async () => {
    const mockEnrollments = [{ id: "enrollment-1" }];
    (
      getEnrollmentsWithMissingSEF as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockEnrollments);

    // Set up the mock to return an error
    const mockIn = vi
      .fn()
      .mockResolvedValue({ error: { message: "Delete failed" } });
    mockFromDelete.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        in: mockIn,
      }),
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to delete enrollments");
  });
});
