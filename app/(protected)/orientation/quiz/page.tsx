import PolicyQuiz from "@/components/tutor/PolicyQuiz";
import { redirect } from "next/navigation";

export default function OrientationQuizPage() {
  if (process.env.ORIENTATION_QUIZ_ENABLED !== "true") redirect("/orientation");

  return <PolicyQuiz />;
}
