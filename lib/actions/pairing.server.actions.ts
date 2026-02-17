"use server";

import { Enrollment, Meeting, Profile } from "@/types";
import { SharedPairing } from "@/types/pairing";
import { createClient } from "@/lib/supabase/server";
import axios from "axios";
import { getProfile } from "./user.actions";
import { createServerClient } from "../supabase/server";
import { getUserFromAction } from "./user.server.actions";
import { IncomingPairingMatch } from "./pairing.actions";
import { NextResponse } from "next/server";
import { PairingLogSchemaType } from "../pairing/types";
import { getSupabase } from "../supabase-server/serverClient";
import { getOverlappingAvailabilites } from "./enrollment.actions";
import { formatDateAdmin, to12Hour } from "../utils";

export const getPairingFromEnrollmentId = async (enrollmentId: string) => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("Enrollments")
      .select("pairing_id")
      .eq("id", enrollmentId)
      .single();
    if (error) throw error;
    return data.pairing_id;
  } catch (error) {
    console.error("Unable to get pairing from enrollment", error);
    throw error;
  }
};

export async function getAccountPairings(userId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_user_pairings_with_profiles",
      {
        requestor_auth_id: userId,
      },
    );

    if (error) {
      console.error("Error fetching enrollments:", error);
      return null;
    }

    return data as SharedPairing[];
  } catch (error) {
    console.error("Unable to get account pairings", error);
    throw error;
  }
}

export const deleteAllPairingRequests = async () => {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = await createClient();

    // // Delete all rows from pairing_requests
    // const { error: pairingRequestsError } = await supabase
    //   .from("pairing_requests")
    //   .delete()
    //   .not("id", "is", null);

    // if (pairingRequestsError) {
    //   console.error("Error deleting pairing_requests:", pairingRequestsError);
    // } else {
    //   console.log("All rows deleted from pairing_requests successfully");
    // }

    // // Delete all rows from pairing_matches
    // const { error: pairingMatchesError } = await supabase
    //   .from("pairing_matches")
    //   .delete()
    //   .not("id", "is", null);

    // if (pairingMatchesError) {
    //   console.error("Error deleting pairing_matches:", pairingMatchesError);
    // } else {
    //   console.log("All rows deleted from pairing_matches successfully");
    // }

    // // Delete all rows from pairing_logs
    // const { error: pairingLogsError } = await supabase
    //   .from("pairing_logs")
    //   .delete()
    //   .not("id", "is", null);

    // if (pairingLogsError) {
    //   console.error("Error deleting pairing_logs:", pairingLogsError);
    // } else {
    //   console.log("All rows deleted from pairing_logs successfully");
    // }
  } catch (err: any) {
    console.error(err.message);
  }
};

export const resetPairingQueues = async () => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("pairing_requests")
    .update({ status: "pending" })
    .not("id", "is", null); // forces Supabase to delete all rows

  if (error) {
    console.error("Error deleting rows:", error);
  } else {
  }
};

export const sendPairingAlertToWebhook = async (
  tutorData: Profile,
  studentData: Profile,
  autoEnrollment: Omit<Enrollment, "id" | "createdAt">,
) => {
  const response = await fetch(`${process.env.PAIRING_ALERTS_WEBHOOK}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `**Automatic Pairing**

**Tutor:** ${tutorData.firstName} ${tutorData.lastName}
Email: ${tutorData.email}

**Student:** ${studentData.firstName} ${studentData.lastName}
Email: ${studentData.email}
Parent Email: ${studentData.parentEmail}
Parent Phone: ${studentData.parentPhone}

**Enrollment Information**

**Day:** ${autoEnrollment.availability[0].day} 
**Start Time:** ${to12Hour(autoEnrollment.availability[0].startTime)} EST 
**End Time:** ${to12Hour(autoEnrollment.availability[0].endTime)} EST

**First Session Date:** ${formatDateAdmin(autoEnrollment.startDate, { includeTime: true, includeDate: true })}`,
    }),
  });
  if (response.status != 200) {
  }
};
