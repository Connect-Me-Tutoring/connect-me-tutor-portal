import { describe, expect, it } from "vitest";
import {
  getEnrollmentAvailability,
  getEnrollmentSchedule,
  getEnrollmentScheduleFields,
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
    ).toEqual([
      { day: "Tuesday", startTime: "13:00", endTime: "14:00" },
    ]);
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
