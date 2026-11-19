import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appendOrientationQuestionToSheet: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  hasTutorOrientationAccess: vi.fn(),
  maybeSingle: vi.fn(),
  requireAuthenticatedProfile: vi.fn(),
  revalidatePath: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

const query = {
  eq: mocks.eq,
  maybeSingle: mocks.maybeSingle,
  select: mocks.select,
  update: mocks.update,
};

mocks.from.mockReturnValue(query);
mocks.update.mockReturnValue(query);
mocks.eq.mockReturnValue(query);
mocks.select.mockReturnValue(query);

vi.mock("@/lib/actions/auth/authz.server", () => ({
  requireAuthenticatedProfile: (...args: unknown[]) => mocks.requireAuthenticatedProfile(...args),
}));

vi.mock("@/lib/orientation/config.server", () => ({
  hasTutorOrientationAccess: (...args: unknown[]) => mocks.hasTutorOrientationAccess(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockResolvedValue({ from: mocks.from }),
}));

vi.mock("@/lib/google-sheet", () => ({
  appendOrientationQuestionToSheet: (...args: unknown[]) =>
    mocks.appendOrientationQuestionToSheet(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}));

import { policyQuizQuestions } from "@/constants/policy-quiz";
import { submitQuizCompletion } from "./server.actions";

const originalWebhookUrl = process.env.ORIENTATION_QUESTION_WEBHOOK;
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

describe("submitQuizCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ORIENTATION_QUESTION_WEBHOOK = "https://example.test/orientation-webhook";
    mocks.from.mockReturnValue(query);
    mocks.update.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.hasTutorOrientationAccess.mockResolvedValue(true);
    mocks.appendOrientationQuestionToSheet.mockResolvedValue(null);
    mocks.requireAuthenticatedProfile.mockResolvedValue({
      profile: {
        email: "taylor@example.com",
        firstName: "Taylor",
        id: "profile-1",
        lastName: "Morgan",
        orientationCompletedAt: null,
        role: "Tutor",
      },
      user: { id: "user-1" },
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    vi.unstubAllGlobals();
    if (originalWebhookUrl === undefined) {
      delete process.env.ORIENTATION_QUESTION_WEBHOOK;
    } else {
      process.env.ORIENTATION_QUESTION_WEBHOOK = originalWebhookUrl;
    }
  });

  it("posts a submitted question only after completion is saved", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: { message: "database unavailable" },
      })
      .mockResolvedValueOnce({ data: { id: "profile-1" }, error: null });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const payload = {
      questionsText: "Could you explain the cancellation policy?",
      retries: 0,
      totalAttempts: policyQuizQuestions.length,
      totalQuestions: policyQuizQuestions.length,
    };

    await expect(submitQuizCompletion(payload)).rejects.toThrow(
      "Unable to save orientation completion.",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(submitQuizCompletion(payload)).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledOnce();

    const webhookRequest = fetchMock.mock.calls[0][1];
    const webhookBody = JSON.parse(webhookRequest.body as string);
    expect(webhookBody.embeds[0].description).toBe("Could you explain the cancellation policy?");
  });

  it("logs the question to the Operations sheet with the tutor's email", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "profile-1" }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await submitQuizCompletion({
      questionsText: "  What if a student is late?  ",
      retries: 2,
      totalAttempts: policyQuizQuestions.length + 2,
      totalQuestions: policyQuizQuestions.length,
    });

    expect(mocks.appendOrientationQuestionToSheet).toHaveBeenCalledOnce();
    expect(mocks.appendOrientationQuestionToSheet.mock.calls[0][0]).toMatchObject({
      userName: "Taylor Morgan",
      userEmail: "taylor@example.com",
      questionText: "What if a student is late?",
      quizStats: { totalQuestions: policyQuizQuestions.length, retries: 2 },
      status: "New",
    });
  });

  it("still completes and posts to Discord when the sheet write fails", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "profile-1" }, error: null });
    mocks.appendOrientationQuestionToSheet.mockRejectedValue(new Error("Unable to parse range"));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitQuizCompletion({
        questionsText: "Where are the worksheets?",
        retries: 0,
        totalAttempts: policyQuizQuestions.length,
        totalQuestions: policyQuizQuestions.length,
      }),
    ).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("skips the sheet and Discord when there is no question", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "profile-1" }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await submitQuizCompletion({
      questionsText: "   ",
      retries: 0,
      totalAttempts: policyQuizQuestions.length,
      totalQuestions: policyQuizQuestions.length,
    });
    expect(mocks.appendOrientationQuestionToSheet).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not save completion while the PostHog flag is disabled", async () => {
    mocks.hasTutorOrientationAccess.mockResolvedValue(false);

    await expect(
      submitQuizCompletion({
        questionsText: null,
        retries: 0,
        totalAttempts: policyQuizQuestions.length,
        totalQuestions: policyQuizQuestions.length,
      }),
    ).rejects.toThrow("Tutor orientation is not enabled.");

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.appendOrientationQuestionToSheet).not.toHaveBeenCalled();
  });
});
