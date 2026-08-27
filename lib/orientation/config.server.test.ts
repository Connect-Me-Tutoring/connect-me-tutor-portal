import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  canViewTutorOrientation,
  isTutorOrientationEnabled,
} from "@/lib/orientation/config.server";

const originalFeatureFlag = process.env.TUTOR_ORIENTATION_ENABLED;

afterEach(() => {
  if (originalFeatureFlag === undefined) {
    delete process.env.TUTOR_ORIENTATION_ENABLED;
  } else {
    process.env.TUTOR_ORIENTATION_ENABLED = originalFeatureFlag;
  }
});

describe("tutor orientation configuration", () => {
  it("defaults off and only enables for the exact true value", () => {
    delete process.env.TUTOR_ORIENTATION_ENABLED;
    expect(isTutorOrientationEnabled()).toBe(false);

    process.env.TUTOR_ORIENTATION_ENABLED = "TRUE";
    expect(isTutorOrientationEnabled()).toBe(false);

    process.env.TUTOR_ORIENTATION_ENABLED = "true";
    expect(isTutorOrientationEnabled()).toBe(true);
  });

  it("allows tutors and admins to view orientation content", () => {
    expect(canViewTutorOrientation("Tutor")).toBe(true);
    expect(canViewTutorOrientation("Admin")).toBe(true);
    expect(canViewTutorOrientation("Student")).toBe(false);
    expect(canViewTutorOrientation(null)).toBe(false);
  });
});
