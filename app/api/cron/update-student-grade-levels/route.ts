import { NextRequest, NextResponse } from "next/server";
import { updateStudentGradeLevels } from "@/lib/actions/student/grade.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError } from "@/lib/posthog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const testStudentId = searchParams.get("testStudentId") || undefined;
    const dryRun = searchParams.get("dryRun") === "true";

    const result = await updateStudentGradeLevels({
      testStudentId,
      dryRun,
    });

    return NextResponse.json(
      {
        message: result.success
          ? "Student grade levels updated successfully"
          : "Student grade levels update completed with errors",
        result,
      },
      { status: result.success ? 200 : 207 },
    );
  } catch (error: any) {
    console.error("Error in update-student-grade-levels cron route:", error);
    await logError(error, {}, "cron_update_student_grade_levels_route_error");
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
