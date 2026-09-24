import {
  BookOpenCheck,
  ClipboardCheck,
  MousePointerClick,
  Presentation,
  Video,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const MODULES = [
  {
    key: "slideshow",
    title: "Orientation slideshow",
    description: "Review Connect Me policies, expectations, and frequently asked questions.",
    href: "/orientation/slideshow",
    action: "View slideshow",
    icon: Presentation,
  },
  {
    key: "portal_walkthrough",
    title: "Portal walkthrough",
    description: "Follow a guided tour of the tools and features you will use as a tutor.",
    href: "/orientation/walkthrough",
    action: "Start walkthrough",
    icon: MousePointerClick,
  },
  {
    key: "experienced_tutor",
    title: "Experienced Tutor Examples",
    description:
      "Watch real tutoring moments, identify effective teaching moves, and reflect on how you would apply them.",
    href: "/orientation/experienced-tutor",
    action: "Watch training clips",
    icon: Video,
  },
  {
    key: "quiz",
    title: "Knowledge check",
    description: "Complete a short quiz to reinforce the most important orientation details.",
    href: "/orientation/quiz",
    action: "Take knowledge check",
    icon: ClipboardCheck,
  },
] as const;

export function OrientationLanding({ previewMode = false }: { previewMode?: boolean }) {
  return (
    <div className="p-8">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <BookOpenCheck aria-hidden="true" className="h-7 w-7" />
          <h1 className="text-3xl font-bold">New Tutor Orientation</h1>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          {previewMode
            ? "Preview the orientation experience available to tutors."
            : "Complete each module before your first tutoring session."}
        </p>
      </header>

      <section aria-labelledby="orientation-modules-heading">
        <h2 className="mb-4 text-xl font-semibold" id="orientation-modules-heading">
          Orientation Modules
        </h2>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((module, index) => {
            const Icon = module.icon;

            return (
              <Card className="flex min-h-64 flex-col" key={module.key}>
                <CardHeader>
                  <div className="mb-4 flex items-center justify-between">
                    <Icon aria-hidden="true" className="h-6 w-6" />
                    <span className="text-sm text-muted-foreground">Module {index + 1}</span>
                  </div>
                  <CardTitle>{module.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm leading-6 text-muted-foreground">{module.description}</p>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={module.href}>{module.action}</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
