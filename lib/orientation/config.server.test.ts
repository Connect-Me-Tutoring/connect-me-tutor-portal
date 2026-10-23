import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  evaluateFlags: vi.fn(),
  getClient: vi.fn(),
  isEnabled: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  default: () => mocks.getClient(),
}));

import {
  canViewTutorOrientation,
  hasTutorOrientationAccess,
  TUTOR_ORIENTATION_FLAG,
  TUTOR_ORIENTATION_FLAG_TIMEOUT_MS,
} from "@/lib/orientation/config.server";

describe("tutor orientation configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClient.mockReturnValue({ evaluateFlags: mocks.evaluateFlags });
    mocks.evaluateFlags.mockResolvedValue({ isEnabled: mocks.isEnabled });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows tutors and admins to view orientation content", () => {
    expect(canViewTutorOrientation("Tutor")).toBe(true);
    expect(canViewTutorOrientation("Admin")).toBe(true);
    expect(canViewTutorOrientation("Student")).toBe(false);
    expect(canViewTutorOrientation(null)).toBe(false);
  });

  describe("hasTutorOrientationAccess", () => {
    const tutor = {
      email: "tutor@example.com",
      id: "tutor-1",
      role: "Tutor" as const,
    };

    it("always allows admins to preview", async () => {
      await expect(hasTutorOrientationAccess({ role: "Admin" })).resolves.toBe(true);
      expect(mocks.evaluateFlags).not.toHaveBeenCalled();
    });

    it("denies non-tutors and missing profiles", async () => {
      await expect(hasTutorOrientationAccess(null)).resolves.toBe(false);
      await expect(hasTutorOrientationAccess({ role: "Student" })).resolves.toBe(false);
      expect(mocks.evaluateFlags).not.toHaveBeenCalled();
    });

    it("follows the existing PostHog flag for tutors", async () => {
      mocks.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);

      await expect(hasTutorOrientationAccess(tutor)).resolves.toBe(true);
      expect(mocks.evaluateFlags).toHaveBeenCalledWith("tutor-1", {
        flagKeys: [TUTOR_ORIENTATION_FLAG],
        personProperties: { email: "tutor@example.com", role: "Tutor" },
      });

      await expect(hasTutorOrientationAccess({ ...tutor, id: "tutor-2" })).resolves.toBe(false);
    });

    it("treats missing PostHog configuration as disabled", async () => {
      mocks.getClient.mockReturnValue(null);

      await expect(hasTutorOrientationAccess(tutor)).resolves.toBe(false);
      expect(mocks.evaluateFlags).not.toHaveBeenCalled();
    });

    it("treats evaluation failures and incomplete profile data as disabled", async () => {
      vi.mocked(mocks.evaluateFlags).mockRejectedValueOnce(new Error("network"));

      await expect(hasTutorOrientationAccess(tutor)).resolves.toBe(false);
      await expect(hasTutorOrientationAccess({ role: "Tutor" })).resolves.toBe(false);
    });

    it("fails open without waiting for the PostHog SDK timeout", async () => {
      vi.useFakeTimers();
      mocks.evaluateFlags.mockReturnValue(new Promise(() => undefined));

      const access = hasTutorOrientationAccess(tutor);
      await vi.advanceTimersByTimeAsync(TUTOR_ORIENTATION_FLAG_TIMEOUT_MS);

      await expect(access).resolves.toBe(false);
    });
  });
});
