import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNextGrade, StudentGrade } from "@/types/grade";

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("@/lib/posthog", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

const { updateStudentGradeLevels } = await import("../student/grade.actions");

describe("Grade progression logic (getNextGrade)", () => {
  it("advances Kindergarten to 1st-grade", () => {
    expect(getNextGrade("Kindergarten")).toBe("1st-grade");
    expect(getNextGrade("kindergarten")).toBe("1st-grade");
    expect(getNextGrade("K")).toBe("1st-grade");
  });

  it("advances standard numbered grades consecutively", () => {
    const grades: StudentGrade[] = [
      "1st-grade",
      "2nd-grade",
      "3rd-grade",
      "4th-grade",
      "5th-grade",
      "6th-grade",
      "7th-grade",
      "8th-grade",
      "9th-grade",
      "10th-grade",
      "11th-grade",
      "12th-grade",
    ];

    for (let i = 0; i < grades.length - 1; i++) {
      expect(getNextGrade(grades[i])).toBe(grades[i + 1]);
    }
  });

  it("advances 12th-grade to Graduated", () => {
    expect(getNextGrade("12th-grade")).toBe("Graduated");
    expect(getNextGrade("12th Grade")).toBe("Graduated");
    expect(getNextGrade("12")).toBe("Graduated");
  });

  it("returns null for already graduated students", () => {
    expect(getNextGrade("Graduated")).toBeNull();
    expect(getNextGrade("graduated")).toBeNull();
    expect(getNextGrade("alumni")).toBeNull();
  });

  it("returns null for invalid or missing grades", () => {
    expect(getNextGrade(null)).toBeNull();
    expect(getNextGrade(undefined)).toBeNull();
    expect(getNextGrade("")).toBeNull();
    expect(getNextGrade("Unknown")).toBeNull();
  });
});

describe("updateStudentGradeLevels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances student grades and calculates counts correctly", async () => {
    const mockStudents = [
      {
        id: "student-1",
        email: "s1@example.com",
        first_name: "Alice",
        last_name: "Smith",
        grade: "5th-grade",
        role: "Student",
      },
      {
        id: "student-2",
        email: "s2@example.com",
        first_name: "Bob",
        last_name: "Jones",
        grade: "12th-grade",
        role: "Student",
      },
      {
        id: "student-3",
        email: "s3@example.com",
        first_name: "Charlie",
        last_name: "Brown",
        grade: "Graduated",
        role: "Student",
      },
      {
        id: "student-4",
        email: "s4@example.com",
        first_name: "David",
        last_name: "Miller",
        grade: "",
        role: "Student",
      },
    ];

    const mockSelectBuilder: any = {
      eq: vi.fn().mockImplementation((col, val) => {
        return Promise.resolve({ data: mockStudents, error: null });
      }),
    };

    const mockUpdateBuilder: any = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "Profiles") {
        return {
          select: vi.fn().mockReturnValue(mockSelectBuilder),
          update: vi.fn().mockReturnValue(mockUpdateBuilder),
        };
      }
      return {};
    });

    const result = await updateStudentGradeLevels();

    expect(result.success).toBe(true);
    expect(result.totalStudentsChecked).toBe(4);
    expect(result.updatedCount).toBe(2);
    expect(result.graduatedCount).toBe(1);
    expect(result.skippedCount).toBe(2);

    expect(result.updates).toEqual([
      {
        id: "student-1",
        email: "s1@example.com",
        firstName: "Alice",
        lastName: "Smith",
        previousGrade: "5th-grade",
        newGrade: "6th-grade",
      },
      {
        id: "student-2",
        email: "s2@example.com",
        firstName: "Bob",
        lastName: "Jones",
        previousGrade: "12th-grade",
        newGrade: "Graduated",
      },
    ]);

    expect(result.skipped).toEqual([
      {
        id: "student-3",
        email: "s3@example.com",
        reason: "Already graduated",
        grade: "Graduated",
      },
      {
        id: "student-4",
        email: "s4@example.com",
        reason: "No grade specified",
        grade: "",
      },
    ]);
  });

  it("does not update the database when dryRun is true", async () => {
    const mockStudents = [
      {
        id: "student-1",
        email: "s1@example.com",
        first_name: "Alice",
        last_name: "Smith",
        grade: "1st-grade",
        role: "Student",
      },
    ];

    const mockUpdateFn = vi.fn();
    const mockSelectBuilder: any = {
      eq: vi.fn().mockResolvedValue({ data: mockStudents, error: null }),
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(mockSelectBuilder),
      update: mockUpdateFn,
    });

    const result = await updateStudentGradeLevels({ dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.updates[0].newGrade).toBe("2nd-grade");
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });
});
