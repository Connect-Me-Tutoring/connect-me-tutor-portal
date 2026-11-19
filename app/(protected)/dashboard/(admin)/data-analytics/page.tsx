import React from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";

export default async function DataDashboard() {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  return (
    <>
      <AnalyticsDashboard />
    </>
  );
}
