import { describe, expect, it } from "vitest";
import { requiresParentalConsent } from "./requires-parental-consent";

describe("requiresParentalConsent", () => {
  it("requires consent for students under 13", () => {
    expect(requiresParentalConsent("Student", "12")).toBe(true);
    expect(requiresParentalConsent("student", " 8 ")).toBe(true);
  });

  it("does not require consent at 13 or older", () => {
    expect(requiresParentalConsent("Student", "13")).toBe(false);
    expect(requiresParentalConsent("Student", "17")).toBe(false);
  });

  it("fails safe when the age cannot be read", () => {
    expect(requiresParentalConsent("Student", "")).toBe(true);
    expect(requiresParentalConsent("Student", null)).toBe(true);
    expect(requiresParentalConsent("Student", "twelve")).toBe(true);
    expect(requiresParentalConsent("Student", "12.5")).toBe(true);
  });

  it("never gates non-students", () => {
    expect(requiresParentalConsent("Tutor", "")).toBe(false);
    expect(requiresParentalConsent("Admin", "9")).toBe(false);
  });
});
