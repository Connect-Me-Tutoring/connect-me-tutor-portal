"use server";

import { createClient } from "@/lib/supabase/server";

export type TimeInterval = "7d" | "30d" | "90d" | "1y" | "all";

export async function getUserGrowthMetrics(interval: TimeInterval = "30d") {
  try {
    const supabase = await createClient();
    const now = new Date();
    let startDate = new Date();

    if (interval === "7d") {
      startDate.setDate(now.getDate() - 7);
    } else if (interval === "30d") {
      startDate.setDate(now.getDate() - 30);
    } else if (interval === "90d") {
      startDate.setDate(now.getDate() - 90);
    } else if (interval === "1y") {
      startDate.setFullYear(now.getFullYear() - 1);
    } else {
      startDate = new Date("2020-01-01");
    }

    const { data: profiles, error } = await supabase
      .from("Profiles")
      .select("id, role, created_at, status")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    const isLongRange = interval === "1y" || interval === "all";
    const counts: Record<
      string,
      { tutorsAdded: number; studentsAdded: number; studentsRemoved: number }
    > = {};

    let totalTutors = 0;
    let totalStudents = 0;
    let totalRemoved = 0;

    if (profiles) {
      for (const p of profiles) {
        if (!p.created_at) continue;
        const d = new Date(p.created_at);

        const key = isLongRange
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        if (!counts[key]) {
          counts[key] = { tutorsAdded: 0, studentsAdded: 0, studentsRemoved: 0 };
        }

        const role = p.role ? p.role.toLowerCase() : "";
        const status = p.status ? p.status.toLowerCase() : "";

        if (role === "tutor") {
          counts[key].tutorsAdded += 1;
          totalTutors += 1;
        } else if (role === "student") {
          if (status === "inactive" || status === "archived" || status === "removed") {
            counts[key].studentsRemoved += 1;
            totalRemoved += 1;
          } else {
            counts[key].studentsAdded += 1;
            totalStudents += 1;
          }
        }
      }
    }

    const labels = Object.keys(counts).sort();

    return {
      data: {
        interval,
        labels,
        tutorsAdded: labels.map((k) => counts[k].tutorsAdded),
        studentsAdded: labels.map((k) => counts[k].studentsAdded),
        studentsRemoved: labels.map((k) => counts[k].studentsRemoved),
        summary: {
          totalTutorsAdded: totalTutors,
          totalStudentsAdded: totalStudents,
          totalStudentsRemoved: totalRemoved,
        },
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to load metrics" };
  }
}
