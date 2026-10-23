import { describe, expect, it } from "vitest";

import { isTutorNavigationRestricted, requiresTutorOrientation } from "./navigation";

describe("tutor orientation navigation", () => {
  it("requires orientation only for incomplete tutors", () => {
    expect(requiresTutorOrientation("Tutor", null)).toBe(true);
    expect(requiresTutorOrientation("Tutor", undefined)).toBe(true);
    expect(requiresTutorOrientation("Tutor", "2026-09-13T12:00:00.000Z")).toBe(false);
    expect(requiresTutorOrientation("Admin", null)).toBe(false);
    expect(requiresTutorOrientation("Student", null)).toBe(false);
  });

  it("restricts incomplete tutors while orientation is enabled", () => {
    expect(isTutorNavigationRestricted(true, "Tutor", null)).toBe(true);
    expect(isTutorNavigationRestricted(true, "Tutor", undefined)).toBe(true);
  });

  it("leaves completed tutors, admins, students, and disabled orientation unrestricted", () => {
    expect(isTutorNavigationRestricted(true, "Tutor", "2026-09-13T12:00:00.000Z")).toBe(false);
    expect(isTutorNavigationRestricted(true, "Admin", null)).toBe(false);
    expect(isTutorNavigationRestricted(true, "Student", null)).toBe(false);
    expect(isTutorNavigationRestricted(false, "Tutor", null)).toBe(false);
  });
});
