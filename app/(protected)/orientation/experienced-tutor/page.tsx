import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ExperiencedTutorTraining } from "@/components/orientation/ExperiencedTutorTraining";
import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";

export const metadata: Metadata = {
  title: "Experienced Tutor Examples | Connect Me",
  description: "Study real tutoring moments and reflect on effective teaching moves.",
};

export default async function ExperiencedTutorPage() {
  const user = await cachedGetUser();
  if (!user) redirect("/");

  const profile = await cachedGetProfile(user.id);
  if (!profile) redirect("/dashboard");

  return <ExperiencedTutorTraining profileId={profile.id} />;
}
