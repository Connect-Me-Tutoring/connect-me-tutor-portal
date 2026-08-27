/**
 * The data sources the analysis service knows about.
 *
 * Mirrors `dataPortalWebsite/frontend/src/lib/data-analysis/sources.ts` — the
 * ids are part of the wire contract with the analysis service and must match
 * its `SourceId` enum exactly. Keep the two files in step.
 */

export type AnalysisSource = {
  id: string;
  label: string;
  description: string;
};

export const analysisSources: AnalysisSource[] = [
  {
    id: "Profiles",
    label: "Profiles",
    description: "Tutor, student, and account profile records.",
  },
  {
    id: "Sessions",
    label: "Sessions",
    description: "Scheduled and completed tutoring session records.",
  },
  {
    id: "Pairings",
    label: "Pairings",
    description: "Tutor and student matching relationships.",
  },
  {
    id: "Enrollments",
    label: "Enrollments",
    description: "Program and cohort enrollment records.",
  },
  {
    id: "Meetings",
    label: "Meetings",
    description: "Meeting records reserved for future analyses.",
  },
];
