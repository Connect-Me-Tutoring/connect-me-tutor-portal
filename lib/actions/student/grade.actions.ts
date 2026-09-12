import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { getNextGrade, StudentGrade } from "@/types/grade";
import { logError } from "@/lib/posthog";

export interface UpdateStudentGradeLevelsOptions {
  testStudentId?: string;
  dryRun?: boolean;
}

export interface GradeUpdateRecord {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  previousGrade: string;
  newGrade: StudentGrade;
}

export interface SkippedStudentRecord {
  id: string;
  email: string | null;
  reason: string;
  grade?: string | null;
}

export interface UpdateStudentGradeLevelsResult {
  success: boolean;
  totalStudentsChecked: number;
  updatedCount: number;
  graduatedCount: number;
  skippedCount: number;
  dryRun: boolean;
  updates: GradeUpdateRecord[];
  skipped: SkippedStudentRecord[];
  errors: { id?: string; error: string }[];
}

export async function updateStudentGradeLevels(
  options: UpdateStudentGradeLevelsOptions = {},
): Promise<UpdateStudentGradeLevelsResult> {
  const { testStudentId, dryRun = false } = options;

  const result: UpdateStudentGradeLevelsResult = {
    success: false,
    totalStudentsChecked: 0,
    updatedCount: 0,
    graduatedCount: 0,
    skippedCount: 0,
    dryRun,
    updates: [],
    skipped: [],
    errors: [],
  };

  try {
    const supabase = await createAdminClient();

    let query = supabase
      .from(Table.Profiles)
      .select("id, email, first_name, last_name, grade, role")
      .eq("role", "Student");

    if (testStudentId) {
      query = query.eq("id", testStudentId);
    }

    const { data: students, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching students for grade update:", fetchError);
      await logError(fetchError, { options }, "cron_update_student_grade_levels_fetch_error");
      result.errors.push({ error: fetchError.message });
      return result;
    }

    if (!students || students.length === 0) {
      result.success = true;
      return result;
    }

    result.totalStudentsChecked = students.length;

    for (const student of students) {
      try {
        const rawGrade = student.grade?.trim();

        if (!rawGrade) {
          result.skipped.push({
            id: student.id,
            email: student.email,
            reason: "No grade specified",
            grade: student.grade,
          });
          continue;
        }

        const nextGrade = getNextGrade(rawGrade);

        if (!nextGrade) {
          const isGraduated = rawGrade.toLowerCase() === "graduated";
          result.skipped.push({
            id: student.id,
            email: student.email,
            reason: isGraduated ? "Already graduated" : `Unrecognized grade format: '${student.grade}'`,
            grade: student.grade,
          });
          continue;
        }

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from(Table.Profiles)
            .update({ grade: nextGrade })
            .eq("id", student.id);

          if (updateError) {
            console.error(`Error updating student ${student.id}:`, updateError);
            result.errors.push({ id: student.id, error: updateError.message });
            continue;
          }
        }

        result.updates.push({
          id: student.id,
          email: student.email,
          firstName: student.first_name,
          lastName: student.last_name,
          previousGrade: rawGrade,
          newGrade: nextGrade,
        });

        result.updatedCount++;
        if (nextGrade === "Graduated") {
          result.graduatedCount++;
        }
      } catch (err: any) {
        console.error(`Error processing student ${student.id}:`, err);
        result.errors.push({ id: student.id, error: err?.message || String(err) });
      }
    }

    result.skippedCount = result.skipped.length;
    result.success = result.errors.length === 0;
    return result;
  } catch (error: any) {
    console.error("Fatal error in updateStudentGradeLevels:", error);
    await logError(error, { options }, "cron_update_student_grade_levels_fatal_error");
    result.errors.push({ error: error?.message || String(error) });
    return result;
  }
}
