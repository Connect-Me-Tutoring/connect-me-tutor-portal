import type { Metadata } from "next";

import { ExperiencedTutorTraining } from "@/components/orientation/ExperiencedTutorTraining";

export const metadata: Metadata = {
  title: "Experienced Tutor Examples | Connect Me",
  description: "Study real tutoring moments and reflect on effective teaching moves.",
};

export default function ExperiencedTutorPage() {
  return <ExperiencedTutorTraining />;
}
