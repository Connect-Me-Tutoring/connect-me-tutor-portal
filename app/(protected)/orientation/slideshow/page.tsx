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
    <div className="flex h-[calc(100dvh-4.25rem)] min-h-0 flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
      <Link
        className="mb-3 inline-flex shrink-0 items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        href="/orientation"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Orientation
      </Link>
      <header className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold sm:text-3xl">Orientation Slideshow</h1>
        <p className="mt-2 text-muted-foreground">
          Review Connect Me policies, tutor expectations, and frequently asked questions.
        </p>
      </header>
      <OrientationSlideshow className="min-h-0 flex-1" />
    </div>
  );
}
