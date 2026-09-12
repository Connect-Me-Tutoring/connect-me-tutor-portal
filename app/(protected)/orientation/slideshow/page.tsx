import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { OrientationSlideshow } from "@/components/orientation/OrientationSlideshow";

export const metadata: Metadata = {
  title: "Orientation Slideshow | Connect Me",
  description: "Review Connect Me tutor policies and frequently asked questions.",
};

export default function OrientationSlideshowPage() {
  return (
    <div className="p-8">
      <Link
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        href="/orientation"
      >
        <ChevronLeft className="h-4 w-4" />
        Orientation
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Orientation Slideshow</h1>
        <p className="mt-2 text-muted-foreground">
          Review Connect Me policies, tutor expectations, and frequently asked questions.
        </p>
      </header>
      <OrientationSlideshow />
    </div>
  );
}
