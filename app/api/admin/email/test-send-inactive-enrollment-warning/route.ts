import { NextRequest, NextResponse } from "next/server";
import { sendInactiveEnrollmentWarning } from "@/lib/actions/enrollment.server.actions";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import {
  tableToInterfaceEnrollments,
  tableToInterfaceProfiles,
} from "@/lib/type-utils";
import { Enrollment, Profile } from "@/types";

export async function GET(request: NextRequest) {
  const enrollmentId = request.nextUrl.searchParams.get("enrollmentId");

  if (!enrollmentId) {
    return NextResponse.json(
      { error: "Missing enrollmentId query param" },
      { status: 400 },
    );
  }
  try {
    const supabase = await createAdminClient();
    const { data: enrollment, error } = await supabase
      .from(Table.Enrollments)
      .select(
        `
        id,
        created_at,
        summary,
        student_id,
        tutor_id,
        start_date,
        end_date,
        availability,
        meetingId,
        paused,
        duration,
        frequency,
        student:Profiles!student_id(*),
        tutor:Profiles!tutor_id(*)
      `,
      )
      .eq("id", enrollmentId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found", details: error },
        { status: 404 },
      );
    }

    const tutorData: Profile = tableToInterfaceProfiles(enrollment.tutor);
    const studentData: Profile = tableToInterfaceProfiles(enrollment.student);
    const enrollmentData: Enrollment = tableToInterfaceEnrollments(enrollment);

    await sendInactiveEnrollmentWarning({
      tutor: tutorData,
      student: studentData,
      enrollment: enrollmentData,
    });

    return NextResponse.json({
      success: true,
      message: `Email sent to tutor ${tutorData.email}`,
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: String(error) },
      { status: 500 },
    );
  }
}
