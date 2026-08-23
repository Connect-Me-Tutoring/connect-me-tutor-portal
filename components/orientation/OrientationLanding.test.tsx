import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrientationLanding } from "@/components/orientation/OrientationLanding";

describe("OrientationLanding", () => {
  it("renders all orientation modules when the quiz is enabled", () => {
    const markup = renderToStaticMarkup(<OrientationLanding quizEnabled />);

    expect(markup).toContain("Orientation slideshow");
    expect(markup).toContain("Portal walkthrough");
    expect(markup).toContain("Knowledge check");
    expect(markup).toContain('href="/orientation/slideshow"');
    expect(markup).toContain('href="/orientation/walkthrough"');
    expect(markup).toContain('href="/orientation/quiz"');
    expect(markup).not.toContain("Coming soon");
    expect(markup).not.toContain("completed");
    expect(markup).not.toContain("does not save any changes");
  });

  it("hides the knowledge check when the quiz is disabled", () => {
    const markup = renderToStaticMarkup(<OrientationLanding quizEnabled={false} />);

    expect(markup).toContain("Orientation slideshow");
    expect(markup).toContain("Portal walkthrough");
    expect(markup).not.toContain("Knowledge check");
    expect(markup).not.toContain('href="/orientation/quiz"');
  });
});
