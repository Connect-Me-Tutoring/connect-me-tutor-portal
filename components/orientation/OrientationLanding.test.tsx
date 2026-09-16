import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrientationLanding } from "@/components/orientation/OrientationLanding";

describe("OrientationLanding", () => {
  it("renders all orientation modules", () => {
    const markup = renderToStaticMarkup(<OrientationLanding />);

    expect(markup).toContain("Orientation slideshow");
    expect(markup).toContain("Portal walkthrough");
    expect(markup).toContain("Experienced Tutor Examples");
    expect(markup).toContain("Knowledge check");
    expect(markup).toContain('href="/orientation/slideshow"');
    expect(markup).toContain('href="/orientation/walkthrough"');
    expect(markup).toContain('href="/orientation/experienced-tutor"');
    expect(markup).toContain('href="/orientation/quiz"');
    expect(markup).not.toContain("Coming soon");
    expect(markup).not.toContain("completed");
    expect(markup).not.toContain("does not save any changes");
  });

  it("labels the admin experience as a preview", () => {
    const markup = renderToStaticMarkup(<OrientationLanding previewMode />);

    expect(markup).toContain("Preview the orientation experience available to tutors.");
    expect(markup).not.toContain("before your first tutoring session");
  });
});
