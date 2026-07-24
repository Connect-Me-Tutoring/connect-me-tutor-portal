import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeSpreadSheet } from "@/lib/google-sheet";

vi.mock("@/lib/google-sheet", () => ({
  writeSpreadSheet: vi.fn(),
}));

const { POST } = await import("./route");

describe("POST /api/session-exit-form/questions-concerns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid json", async () => {
    const response = await POST(
      new Request("http://localhost/api/session-exit-form/questions-concerns", {
        method: "POST",
        body: "{",
      }) as any,
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
    expect(writeSpreadSheet).not.toHaveBeenCalled();
  });

  it("rejects invalid form data", async () => {
    const response = await POST(
      new Request("http://localhost/api/session-exit-form/questions-concerns", {
        method: "POST",
        body: JSON.stringify({
          studentEmail: "not-an-email",
          formContent: "question",
        }),
      }) as any,
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(writeSpreadSheet).not.toHaveBeenCalled();
  });

  it("writes valid form data", async () => {
    (writeSpreadSheet as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const response = await POST(
      new Request("http://localhost/api/session-exit-form/questions-concerns", {
        method: "POST",
        body: JSON.stringify({
          tutorFirstName: " Ada ",
          tutorLastName: " Lovelace ",
          studentFirstName: " Grace ",
          studentLastName: " Hopper ",
          tutorEmail: "tutor@example.com",
          studentEmail: "student@example.com",
          formContent: "   =1+1   ",
        }),
      }) as any,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(writeSpreadSheet).toHaveBeenCalledWith({
      tutorFirstName: "Ada",
      tutorLastName: "Lovelace",
      studentFirstName: "Grace",
      studentLastName: "Hopper",
      tutorEmail: "tutor@example.com",
      studentEmail: "student@example.com",
      formContent: "=1+1",
    });
  });
});
