import { describe, expect, it } from "vitest";
import {
  getEnrollmentAvailability,
  getEnrollmentSchedule,
  getEnrollmentScheduleFields,
  isEnrollmentSessionDate,
} from "./enrollment-schedule";

describe("enrollment schedule column adapters", () => {
  it("normalizes database time values to HH:MM", () => {
    expect(
      getEnrollmentSchedule({
        day: "Monday",
        startTime: "09:30:00",
        endTime: "10:45:00",
      }),
    ).toEqual({
      day: "Monday",
      startTime: "09:30",
      endTime: "10:45",
    });
  });

  it("adapts a complete column schedule for list-based display components", () => {
    expect(
      getEnrollmentAvailability({
        day: "Tuesday",
        startTime: "13:00",
        endTime: "14:00",
      }),
    ).toEqual([{ day: "Tuesday", startTime: "13:00", endTime: "14:00" }]);
  });

  it("does not expose an incomplete schedule", () => {
    expect(
      getEnrollmentAvailability({
        day: "Wednesday",
        startTime: null,
        endTime: "16:00",
      }),
    ).toEqual([]);
  });

  it("maps a selected form slot to enrollment columns", () => {
    expect(
      getEnrollmentScheduleFields({
        day: "Thursday",
        startTime: "15:00:00",
        endTime: "16:00:00",
      }),
    ).toEqual({
      day: "Thursday",
      startTime: "15:00",
      endTime: "16:00",
    });
  });
});

describe("isEnrollmentSessionDate", () => {
  const biweekly = { frequency: "biweekly", startDate: "2026-10-07T04:00:00.000Z" }; // Wed

  it("treats every week as a session week for weekly enrollments", () => {
    expect(
      isEnrollmentSessionDate({ frequency: "weekly", startDate: "2026-10-07" }, "2026-10-19"),
    ).toBe(true);
  });

  it("meets on the first slot after the start date, then every other week", () => {
    expect(isEnrollmentSessionDate(biweekly, "2026-10-12")).toBe(true); // Mon, 5 days in
    expect(isEnrollmentSessionDate(biweekly, "2026-10-19")).toBe(false);
    expect(isEnrollmentSessionDate(biweekly, "2026-10-26")).toBe(true);
    expect(isEnrollmentSessionDate(biweekly, "2026-11-02")).toBe(false);
  });

  it("falls back to weekly when the start date is missing", () => {
    expect(isEnrollmentSessionDate({ frequency: "biweekly", startDate: "" }, "2026-10-19")).toBe(
      true,
    );
  });
});
