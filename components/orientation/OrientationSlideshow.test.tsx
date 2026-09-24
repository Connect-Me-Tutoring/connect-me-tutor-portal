import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ORIENTATION_SLIDES } from "@/constants/orientation-slides";
import { ORIENTATION_SLIDE_TRANSCRIPTS } from "@/constants/orientation-slide-transcripts";
import {
  canAdvanceOrientationSlide,
  getOrientationSlideRetrySource,
  OrientationSlideshow,
} from "./OrientationSlideshow";

describe("OrientationSlideshow", () => {
  it("uses the 21 protected orientation slides", () => {
    expect(ORIENTATION_SLIDES).toHaveLength(21);
    expect(ORIENTATION_SLIDE_TRANSCRIPTS).toHaveLength(ORIENTATION_SLIDES.length);
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
    expect(markup).toContain('alt=""');
    expect(markup).toContain("1 / 21");
    expect(markup).toContain("Slide 1 transcript");
    expect(markup).toContain("Our mission is to give back");
    expect(markup).not.toContain("docs.google.com");
  });

  it("provides keyboard-accessible links from slide transcripts", () => {
    expect(ORIENTATION_SLIDE_TRANSCRIPTS[4].links).toEqual([
      expect.objectContaining({
        href: expect.stringContaining("drive.google.com"),
        label: "Open the Mentorship Program Graphic",
      }),
    ]);
    expect(ORIENTATION_SLIDE_TRANSCRIPTS[6].links?.[0].href).toBe("https://connectmego.app/");
    expect(ORIENTATION_SLIDE_TRANSCRIPTS[10].links?.[0].href).toContain("docs.google.com");
  });

  it("provides restart and optional fullscreen controls", () => {
    const markup = renderToStaticMarkup(<OrientationSlideshow />);

    expect(markup).toContain('aria-label="Restart orientation"');
    expect(markup).toContain('aria-label="Enter fullscreen"');
  });

  it("only uses the invisible advance target before the final slide", () => {
    expect(canAdvanceOrientationSlide(0)).toBe(true);
    expect(canAdvanceOrientationSlide(ORIENTATION_SLIDES.length - 2)).toBe(true);
    expect(canAdvanceOrientationSlide(ORIENTATION_SLIDES.length - 1)).toBe(false);
  });

  it("creates a cache-busting URL when a failed slide is retried", () => {
    expect(getOrientationSlideRetrySource("/slide.webp", 0)).toBe("/slide.webp");
    expect(getOrientationSlideRetrySource("/slide.webp", 2)).toBe("/slide.webp?retry=2");
    expect(getOrientationSlideRetrySource("/slide.webp?v=3", 2)).toBe("/slide.webp?v=3&retry=2");
  });
});
