import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date();
    const fortyEightHoursAgo = new Date(
      now.getTime() - 48 * 60 * 60 * 1000,
    ).toISOString();

    const { data: sessions, error: fetchError } = await supabase
      .from("Sessions")
      .select("tutor_id, date, status")
      .eq("status", "Active")
      .lt("date", fortyEightHoursAgo);

    if (fetchError) {
      console.error("Error fetching sessions to cancel:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 },
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        message: "No sessions to cancel",
        cancelled: 0,
      });
    }

    const { error: updateError } = await supabase
      .from("Sessions")
      .update({ status: "Complete" })
      .eq("status", "Active")
      .lt("date", fortyEightHoursAgo);

    if (updateError) {
      console.error("Error cancelling sessions:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel sessions" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Successfully cancelled unsubmitted SEFs",
      cancelled: sessions.length,
    });
  } catch (error) {
    console.error("Unable to cancel unsubmitted SEF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
