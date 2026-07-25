import { describe, expect, it } from "vitest";
import { isOverlap, timeToMinutes } from "../pairing/client.actions";

describe("timeToMinutes", () => {
  it("converts HH:MM (no seconds) to minutes since midnight", () => {
    // Regression case: enrollment schedule times come back as "HH:MM", and
    // splitting on ":" previously left `seconds` undefined, making the whole
    // sum NaN.
    expect(timeToMinutes("13:00")).toBe(780);
  });

  it("converts HH:MM:SS to minutes since midnight", () => {
    expect(timeToMinutes("13:00:30")).toBe(780.5);
  });

  it("handles midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
  });
});

describe("isOverlap", () => {
  it("returns true when ranges overlap", () => {
    expect(isOverlap(60, 120, 90, 150)).toBe(true);
  });

  it("returns false when ranges don't overlap", () => {
    expect(isOverlap(60, 120, 150, 180)).toBe(false);
  });

  it("treats touching boundaries as non-overlapping", () => {
    expect(isOverlap(60, 120, 120, 180)).toBe(false);
  });

  it("returns true when one range fully contains the other", () => {
    expect(isOverlap(60, 180, 90, 120)).toBe(true);
  });
});
