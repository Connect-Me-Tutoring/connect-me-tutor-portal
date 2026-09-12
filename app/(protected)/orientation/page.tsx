import type { Metadata } from "next";

import { OrientationLanding } from "@/components/orientation/OrientationLanding";
import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";

export const metadata: Metadata = {
  title: "Tutor Orientation | Connect Me",
  description: "Review the essentials for tutoring with Connect Me.",
};

export default async function TutorOrientationPage() {
  const user = await cachedGetUser();
  const profile = user ? await cachedGetProfile(user.id) : null;

  return <OrientationLanding previewMode={profile?.role === "Admin"} />;
}
