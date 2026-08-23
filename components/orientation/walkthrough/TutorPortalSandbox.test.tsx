import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TutorPortalSandbox } from "./TutorPortalSandbox";

describe("TutorPortalSandbox", () => {
  it("renders an isolated tutor practice environment with mock data", () => {
    const markup = renderToStaticMarkup(<TutorPortalSandbox />);

    expect(markup).toContain("Exit walkthrough");
    expect(markup).toContain("Taylor Morgan");
    expect(markup).toContain("Jordan Lee");
    expect(markup).toContain('data-tour="practice-sidebar"');
    expect(markup).toContain('data-tour="session-actions"');
    expect(markup).toContain("Session Exit Form");
    expect(markup).not.toContain("bg-connect-me-blue-5");
    expect(markup).toContain('href="/orientation"');
    expect(markup).not.toContain("supabase");
    expect(markup).not.toContain("/api/");
  });
});
