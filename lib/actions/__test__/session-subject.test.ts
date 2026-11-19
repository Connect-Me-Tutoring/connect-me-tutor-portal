import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitSessionExitForm, undoSessionExitForm } from "@/lib/actions/tutor/actions";

const { requireAccess, update, savedRow } = vi.hoisted(() => ({
  requireAccess: vi.fn(),
  update: vi.fn(),
  savedRow: { id: "session-1", status: "Complete", subject: "Math" },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/actions/auth/authz.server", () => ({
  requireSessionAccessById: requireAccess,
  requireAuthenticatedProfile: vi.fn(),
  requireTutorProfileAccess: vi.fn(),
}));
vi.mock("@/lib/email/session-reminders", () => ({ removeSessionReminders: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ logError: vi.fn() }));

const input = {
  sessionId: "session-1",
  notes: "We covered fractions.",
  subject: "Math",
  isQuestionOrConcern: false,
  isFirstSession: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  const builder = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: savedRow, error: null }),
    single: vi.fn().mockResolvedValue({ data: { ...savedRow, subject: null }, error: null }),
  };
  update.mockReturnValue(builder);
  requireAccess.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });
});

describe("session subject persistence", () => {
  it.each([undefined, "", "Unsupported subject"])(
    "rejects subject %s before writing",
    async (subject) => {
      await expect(
        submitSessionExitForm({ ...input, subject: subject as string }),
      ).resolves.toEqual({
        ok: false,
        reason: "invalid",
      });
      expect(requireAccess).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("saves the subject with the notes and returns it to the dashboard", async () => {
    await expect(submitSessionExitForm(input)).resolves.toMatchObject({
      ok: true,
      session: { subject: "Math" },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "Complete",
        subject: "Math",
        session_exit_form: input.notes,
      }),
    );
  });

  it("clears the subject when undoing a submission", async () => {
    await expect(undoSessionExitForm(input.sessionId)).resolves.toMatchObject({ subject: null });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: null,
        session_exit_form: null,
      }),
    );
  });
});
