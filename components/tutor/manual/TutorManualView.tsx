import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tutorManualSectionIds, type TutorManualSection } from "@/constants/tutor-manual";

import ManualMarkdown from "./ManualMarkdown";

/** The read-only manual: a contents list (sticky on desktop) and one card per section. */
export default function TutorManualView({ sections }: { sections: TutorManualSection[] }) {
  const ids = tutorManualSectionIds(sections);

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Manual contents" className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-connect-me-gray-1">
          Contents
        </p>
        <ol className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {sections.map((section, index) => (
            <li key={ids[index]}>
              <a
                href={`#${ids[index]}`}
                className="block rounded-md border border-border px-2.5 py-1 text-sm text-connect-me-gray-2 hover:bg-connect-me-blue-1/30 hover:text-connect-me-blue-4 lg:border-0"
              >
                <span className="mr-1 text-connect-me-gray-1">{index + 1}.</span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="min-w-0 space-y-6">
        {sections.map((section, index) => (
          <Card key={ids[index]} id={ids[index]} className="scroll-mt-6">
            <CardHeader>
              <CardTitle className="text-2xl text-connect-me-blue-4">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ManualMarkdown>{section.body}</ManualMarkdown>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
