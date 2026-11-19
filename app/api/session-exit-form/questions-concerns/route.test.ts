import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeSpreadSheet } from "@/lib/google-sheet";
import { createSessionExitFormTechTicket } from "@/lib/tickets/server";
import { requireAuthenticatedProfile } from "@/lib/actions/auth/authz.server";

vi.mock("@/lib/google-sheet", () => ({ writeSpreadSheet: vi.fn() }));
vi.mock("@/lib/tickets/server", () => ({ createSessionExitFormTechTicket: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ logEvent: vi.fn(), logError: vi.fn() }));
vi.mock("@/lib/actions/auth/authz.server", () => ({ requireAuthenticatedProfile: vi.fn() }));

const { POST } = await import("./route");

const ctx = { user: { id: "user-1" }, profile: { id: "profile-1" } };

function request(body: unknown) {
  return new Request("http://localhost/api/session-exit-form/questions-concerns", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

const body = (category: string) => ({
  tutorFirstName: "Tia",
  tutorLastName: "Tutor",
  studentFirstName: "Sam",
  studentLastName: "Student",
  formContent: "Zoom link didn't work",
  category,
});

describe("POST /api/session-exit-form/questions-concerns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthenticatedProfile).mockResolvedValue(ctx as any);
    vi.mocked(writeSpreadSheet).mockResolvedValue({} as any);
    vi.mocked(createSessionExitFormTechTicket).mockResolvedValue("ticket-1");
  });

  it("opens a tech ticket for technical concerns after the sheet write", async () => {
    const response = await POST(request(body("technical")));

    expect(response.status).toBe(200);
    expect(writeSpreadSheet).toHaveBeenCalledWith(
      expect.objectContaining({ category: "Technical and Portal Issues" }),
    );
    expect(createSessionExitFormTechTicket).toHaveBeenCalledWith(ctx, {
      formContent: "Zoom link didn't work",
      tutorName: "Tia Tutor",
      studentName: "Sam Student",
    });
  });

  it.each(["attendance", "behavior", "urgent"])("does not open a ticket for %s", async (cat) => {
    const response = await POST(request(body(cat)));

    expect(response.status).toBe(200);
    expect(createSessionExitFormTechTicket).not.toHaveBeenCalled();
  });

  it("does not open a ticket when the sheet write fails", async () => {
    vi.mocked(writeSpreadSheet).mockRejectedValue(new Error("sheets down"));

    const response = await POST(request(body("technical")));

    expect(response.status).toBe(500);
    expect(createSessionExitFormTechTicket).not.toHaveBeenCalled();
  });

  it("still succeeds when ticket creation fails", async () => {
    vi.mocked(createSessionExitFormTechTicket).mockResolvedValue(null);

    const response = await POST(request(body("technical")));

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });
});
