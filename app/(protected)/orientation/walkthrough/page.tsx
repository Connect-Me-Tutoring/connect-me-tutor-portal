import type { Metadata } from "next";

import { TutorPortalSandbox } from "@/components/orientation/walkthrough/TutorPortalSandbox";

export const metadata: Metadata = {
  title: "Portal Walkthrough | Connect Me",
  description: "Practice the tutor portal in a safe, guided environment.",
};

export default function PortalWalkthroughPage() {
  return <TutorPortalSandbox />;
}
