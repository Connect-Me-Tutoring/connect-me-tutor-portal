import { redirect } from "next/navigation";

import { isTutorOrientationEnabled } from "@/lib/orientation/config.server";

export default function PolicyQuizPage() {
  if (!isTutorOrientationEnabled()) redirect("/dashboard");

  redirect("/orientation/quiz");
}
