import type { Metadata } from "next";
import { redirect } from "next/navigation";

import TutorManualPage from "@/components/tutor/manual/TutorManualPage";
import { cachedGetProfile } from "@/lib/actions/cache";
import { getTutorManual } from "@/lib/actions/tutor-manual/server.actions";
import { cachedGetUser } from "@/lib/actions/user/actions";

export const metadata: Metadata = {
  title: "Tutor Portal Manual | Connect Me",
  description: "How to use the Connect Me tutor portal.",
};

export default async function ManualPage() {
  const user = await cachedGetUser();
  const profile = user ? await cachedGetProfile(user.id) : null;

  // Tutors read the manual and admins edit it; students have no link to it.
  if (profile?.role !== "Tutor" && profile?.role !== "Admin") redirect("/dashboard");

  const manual = await getTutorManual();

  return (
    <main>
      <TutorManualPage initialManual={manual} canEdit={profile.role === "Admin"} />
    </main>
  );
}
