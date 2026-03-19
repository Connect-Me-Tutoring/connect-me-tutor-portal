import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEnrollmentsWithMissingSEF } from "@/lib/actions/enrollment.server.actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date();
    const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));

    const targetEnrollments = await getEnrollmentsWithMissingSEF(
      oneMonthAgo,
      4,
    );

    if (!targetEnrollments || targetEnrollments.length === 0) {
      return NextResponse.json({
        message: "No enrollments to delete",
        deleted: 0,
      });
    }

    const enrollmentIds = targetEnrollments.map((e) => e.id);

    const { error: deleteError } = await supabase
      .from("Enrollments")
      .delete()
      .in("id", enrollmentIds);

    if (deleteError) {
      console.error("Error deleting enrollments:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete enrollments" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Successfully deleted inactive enrollments",
      deleted: enrollmentIds.length,
    });
  } catch (error) {
    console.error("Unable to delete inactive enrollments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
