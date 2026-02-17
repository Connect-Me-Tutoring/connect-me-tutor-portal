import { Enrollment } from "@/types";
import { Table } from "../supabase/tables";
import { supabase } from "@/lib/supabase/client";
import { SharedEnrollment } from "@/types/enrollment";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  parseISO,
  isAfter,
  isValid,
  previousDay,
} from "date-fns";

/**
 *@returns Prints to console enrollments where the corresponding past two sessions for the given enrollment haven't been filled out
 */

// export const getEnrollmentsWithMissingSEF = async () => {
//   try {
//     // Only consider sessions from the past two weeks that have already occurred
//     const twoWeeksAgo = subWeeks(new Date(), 2).toISOString();
//     const now = new Date().toISOString();

//     const { data: sessions, error: fetchSessionError } = await supabase
//       .from("Sessions")
//       .select(`*, student:Profiles!student_id(*), tutor:Profiles!tutor_id(*)`)
//       .not('enrollment_id', 'is', null)
//       .gte("date", twoWeeksAgo)
//       .lt("date", now)
//       .order("date", { ascending: false });

//     if (fetchSessionError) {
//       console.error("Error fetching sessions:", fetchSessionError);
//       return [];
//     }

//     if (!sessions || sessions.length === 0) {
//       console.log("No sessions found in the past two weeks.");
//       return [];
//     }

//     // Group sessions by enrollment_id; collect all, then keep the two most recent per enrollment
//     const enrollmentSessionsMap: Record<string, any[]> = {};

//     for (const s of sessions) {
//       if (!s.enrollment_id) continue;
//       const id = s.enrollment_id;
//       enrollmentSessionsMap[id] = enrollmentSessionsMap[id] || [];
//       enrollmentSessionsMap[id].push(s);
//     }

//     // Ensure sessions are sorted by date (most recent first) and keep only the top 2 per enrollment
//     for (const [id, arr] of Object.entries(enrollmentSessionsMap)) {
//       arr.sort((a: any, b: any) => (a.date < b.date ? 1 : -1)); // descending by date
//       enrollmentSessionsMap[id] = arr.slice(0, 2);
//     }

//     // Find enrollment IDs where the two most recent sessions are both Active
//     const enrollmentIdsWithMissingSEF: string[] = [];

//     // Debug: show per-enrollment sessions used for the decision
//     Object.entries(enrollmentSessionsMap).forEach(([id, arr]) => {
//       const dates = arr.map((s: any) => s.date).join(', ');
//       // only log short messages during development
//       console.debug(`Enrollment ${id} has sessions (most recent first): ${dates}`);
//     });

//     for (const [enrollmentId, sessArr] of Object.entries(enrollmentSessionsMap)) {
//       if (sessArr.length < 2) continue; // require two sessions in the past two weeks
//       const bothActive = sessArr[0].status === "Active" && sessArr[1].status === "Active";
//       if (bothActive) enrollmentIdsWithMissingSEF.push(enrollmentId);
//     }

//     if (!enrollmentIdsWithMissingSEF.length) {
//       console.log("No enrollments found with the last two sessions missing SEF (status=Active) in the past two weeks.");
//       return [];
//     }

//     // Fetch enrollment details for those IDs including profiles
//     const { data: enrollments, error: fetchEnrollmentsError } = await supabase
//       .from("Enrollments")
//       .select(`*, student:Profiles!student_id(*), tutor:Profiles!tutor_id(*)`)
//       .in("id", enrollmentIdsWithMissingSEF);

//     if (fetchEnrollmentsError) {
//       console.error("Error fetching enrollments:", fetchEnrollmentsError);
//       return [];
//     }

//     // Log each enrollment and its two sessions
//     for (const enrollment of enrollments || []) {
//       const id = (enrollment as any).id;
//       const student = (enrollment as any).student;
//       const tutor = (enrollment as any).tutor;
//       const sessionsForEnrollment = enrollmentSessionsMap[id] || [];

//       console.log(`Enrollment ${id} - student: ${student?.firstName || student?.id || "n/a"} ${student?.lastName || ""} - tutor: ${tutor?.firstName || tutor?.id || "n/a"} ${tutor?.lastName || ""}`);

//       sessionsForEnrollment.forEach((sess: any, idx: number) => {
//         let dateStr = sess.date ? format(parseISO(sess.date), "yyyy-MM-dd HH:mm") : "unknown";
//         console.log(`  Session ${idx + 1}: id=${sess.id} date=${dateStr} status=${sess.status}`);
//       });
//     }

//     return enrollments || [];
//   } catch (error) {
//     console.error("Unable to filter ", error);
//     throw error;
//   }

// }
