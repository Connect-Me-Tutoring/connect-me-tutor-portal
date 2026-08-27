import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ORIENTATION_SLIDES } from "@/constants/orientation-slides";
import { OrientationSlideshow } from "./OrientationSlideshow";

describe("OrientationSlideshow", () => {
  it("uses the 21 protected orientation slides", () => {
    expect(ORIENTATION_SLIDES).toHaveLength(21);
    expect(ORIENTATION_SLIDES[0]).toBe("/api/orientation/slides/slide-01.webp");
    expect(
      ORIENTATION_SLIDES.every((slide) =>
        /^\/api\/orientation\/slides\/slide-(0[1-9]|1\d|2[01])\.webp(?:\?v=\d+)?$/.test(slide),
      ),
    ).toBe(true);
  });

  it("renders the exact first slide as the primary portal component", () => {
    const markup = renderToStaticMarkup(<OrientationSlideshow />);

    expect(markup).toContain("/api/orientation/slides/slide-01.webp");
    expect(markup).toContain("Connect Me tutor orientation slide 1 of 21");
    expect(markup).toContain("1 / 21");
    expect(markup).not.toContain("docs.google.com");
  });

  it("provides restart and optional fullscreen controls", () => {
    const markup = renderToStaticMarkup(<OrientationSlideshow />);

    expect(markup).toContain('aria-label="Restart orientation"');
    expect(markup).toContain('aria-label="Enter fullscreen"');
  });
});
