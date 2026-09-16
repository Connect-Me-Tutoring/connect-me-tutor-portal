import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
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
  isTutorOrientationEnabled: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mocks.from }),
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
    mocks.requireAuthenticatedProfile.mockResolvedValue({
      profile: {
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
});
