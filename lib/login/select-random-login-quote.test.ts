import { describe, expect, it } from "vitest";
import { LOGIN_QUOTES } from "@/constants/login-quotes";
import { selectRandomLoginQuote } from "./select-random-login-quote";

describe("login testimonials", () => {
  it("includes every requested tutor attribution", () => {
    expect(LOGIN_QUOTES.map(({ author }) => author)).toEqual([
      "Olivia M.",
      "Shahzoda J.",
      "Elizabeth A.",
      "Chinmayi Y.",
      "Sharara A.",
    ]);
  });

  it.each([
    [0, 0],
    [0.4, 2],
    [1 - Number.EPSILON, LOGIN_QUOTES.length - 1],
  ])("maps random value %s to quote index %s", (randomValue, quoteIndex) => {
    expect(selectRandomLoginQuote(() => randomValue)).toBe(LOGIN_QUOTES[quoteIndex]);
  });
});
