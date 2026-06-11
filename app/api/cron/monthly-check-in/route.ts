import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendMonthlyCheckInEmail } from "@/lib/actions/email.server.actions";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = await createAdminClient();

    // Fetch active users that need to be checked in on. 
    // TODO: Update the query below to match your actual Supabase schema rules for active profiles
    //  and other relevant criteria
    const { data: users, error } = await supabase
      .from("Profiles")
      .select("id, email, first_name, role")
      .eq("email", "kwei@connectmego.org");

    if (error) {
      console.error("Error fetching users for monthly check-in:", error);
      throw error;
    }

    if (users && users.length > 0) {
      const results = await Promise.all(
        users.map((user) => {
          if (!user.email || !user.first_name) return Promise.resolve();

          return sendMonthlyCheckInEmail(
            { firstName: user.first_name, role: user.role as any },
            user.email
          );
        })
      );
      
      console.log("Email dispatch results:", JSON.stringify(results, null, 2));
    }

    return NextResponse.json({
      success: true,
      emailsSent: users?.length || 0,
    });
  } catch (error: any) {
    console.error("Monthly check-in cron failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
