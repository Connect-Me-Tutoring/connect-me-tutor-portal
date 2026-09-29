import { redirect } from "next/navigation";

import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";
import { hasTutorOrientationAccess } from "@/lib/orientation/config.server";

export default async function PolicyQuizPage() {
  const user = await cachedGetUser();
  const profile = user ? await cachedGetProfile(user.id) : null;
  if (!(await hasTutorOrientationAccess(profile))) redirect("/dashboard");

  redirect("/orientation/quiz");
}
