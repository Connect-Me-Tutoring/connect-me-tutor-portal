import type { Metadata } from "next";

import { OrientationLanding } from "@/components/orientation/OrientationLanding";

export const metadata: Metadata = {
  title: "Tutor Orientation | Connect Me",
  description: "Review the essentials for tutoring with Connect Me.",
};

export default function TutorOrientationPage() {
  const quizEnabled = process.env.ORIENTATION_QUIZ_ENABLED === "true";

  return <OrientationLanding quizEnabled={quizEnabled} />;
}
