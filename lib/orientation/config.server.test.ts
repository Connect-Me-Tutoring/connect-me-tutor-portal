import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const isFeatureEnabled = vi.fn();
vi.mock("@/lib/posthog", () => ({
  default: () => ({ isFeatureEnabled }),
}));

import {
  canViewTutorOrientation,
  hasTutorOrientationAccess,
  isTutorOrientationEnabledForAll,
  TUTOR_ORIENTATION_FLAG,
} from "@/lib/orientation/config.server";

const originalFeatureFlag = process.env.TUTOR_ORIENTATION_ENABLED;
const originalLegacyFeatureFlag = process.env.ORIENTATION_QUIZ_ENABLED;

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

beforeEach(() => {
  delete process.env.TUTOR_ORIENTATION_ENABLED;
  delete process.env.ORIENTATION_QUIZ_ENABLED;
});

afterEach(() => {
  isFeatureEnabled.mockReset();
  restoreEnv("TUTOR_ORIENTATION_ENABLED", originalFeatureFlag);
  restoreEnv("ORIENTATION_QUIZ_ENABLED", originalLegacyFeatureFlag);
});

describe("tutor orientation configuration", () => {
  it("only enables the env override for the exact true value", () => {
    expect(isTutorOrientationEnabledForAll()).toBe(false);

    process.env.TUTOR_ORIENTATION_ENABLED = "TRUE";
    expect(isTutorOrientationEnabledForAll()).toBe(false);

    process.env.TUTOR_ORIENTATION_ENABLED = "true";
    expect(isTutorOrientationEnabledForAll()).toBe(true);
  });

  it("falls back to the legacy variable only when the canonical one is unset", () => {
    process.env.ORIENTATION_QUIZ_ENABLED = "true";
    expect(isTutorOrientationEnabledForAll()).toBe(true);

    process.env.TUTOR_ORIENTATION_ENABLED = "false";
    expect(isTutorOrientationEnabledForAll()).toBe(false);
  });

  it("allows tutors and admins to view orientation content", () => {
    expect(canViewTutorOrientation("Tutor")).toBe(true);
    expect(canViewTutorOrientation("Admin")).toBe(true);
    expect(canViewTutorOrientation("Student")).toBe(false);
    expect(canViewTutorOrientation(null)).toBe(false);
  });

  describe("hasTutorOrientationAccess", () => {
    const tutor = { id: "tutor-1", role: "Tutor" as const, email: "tutor@example.com" };

    it("always allows admins without consulting PostHog", async () => {
      await expect(
        hasTutorOrientationAccess({ id: "admin-1", role: "Admin", email: null } as any),
      ).resolves.toBe(true);
      expect(isFeatureEnabled).not.toHaveBeenCalled();
    });

    it("denies non-tutors and missing profiles", async () => {
      await expect(hasTutorOrientationAccess(null)).resolves.toBe(false);
      await expect(
        hasTutorOrientationAccess({ id: "s-1", role: "Student", email: "s@example.com" } as any),
      ).resolves.toBe(false);
      expect(isFeatureEnabled).not.toHaveBeenCalled();
    });

    it("follows the PostHog flag for tutors, sending email for targeting", async () => {
      isFeatureEnabled.mockResolvedValueOnce(true);
      await expect(hasTutorOrientationAccess(tutor)).resolves.toBe(true);
      expect(isFeatureEnabled).toHaveBeenCalledWith(TUTOR_ORIENTATION_FLAG, "tutor-1", {
        personProperties: { email: "tutor@example.com", role: "Tutor" },
      });

      isFeatureEnabled.mockResolvedValueOnce(false);
      await expect(hasTutorOrientationAccess({ ...tutor, id: "tutor-2" })).resolves.toBe(false);
    });

    it("lets every tutor in without consulting PostHog when the env override is on", async () => {
      process.env.TUTOR_ORIENTATION_ENABLED = "true";

      await expect(hasTutorOrientationAccess({ ...tutor, id: "tutor-5" })).resolves.toBe(true);
      expect(isFeatureEnabled).not.toHaveBeenCalled();
    });

    it("falls back to the PostHog flag when the env override is false", async () => {
      process.env.TUTOR_ORIENTATION_ENABLED = "false";
      isFeatureEnabled.mockResolvedValueOnce(false);

      await expect(hasTutorOrientationAccess({ ...tutor, id: "tutor-6" })).resolves.toBe(false);
      expect(isFeatureEnabled).toHaveBeenCalledOnce();
    });

    it("fails closed when PostHog errors or returns undefined", async () => {
      isFeatureEnabled.mockResolvedValueOnce(undefined);
      await expect(hasTutorOrientationAccess({ ...tutor, id: "tutor-3" })).resolves.toBe(false);

      isFeatureEnabled.mockRejectedValueOnce(new Error("network"));
      await expect(hasTutorOrientationAccess({ ...tutor, id: "tutor-4" })).resolves.toBe(false);
    });
  });
});
