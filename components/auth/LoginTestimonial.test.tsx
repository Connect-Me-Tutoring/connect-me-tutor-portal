import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginTestimonial } from "./LoginTestimonial";

describe("LoginTestimonial", () => {
  it("renders the quote and attribution with testimonial semantics", () => {
    const markup = renderToStaticMarkup(
      <LoginTestimonial quote={{ text: "A meaningful experience.", author: "Tutor T." }} />,
    );

    expect(markup).toContain("<figure");
    expect(markup).toContain("<blockquote>");
    expect(markup).toContain("A meaningful experience.");
    expect(markup).toContain("Tutor T.");
  });
});
