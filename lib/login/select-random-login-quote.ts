import { LOGIN_QUOTES } from "@/constants/login-quotes";
import type { LoginQuote } from "@/types/login-quote";

type RandomSource = () => number;

export function selectRandomLoginQuote(random: RandomSource = Math.random): LoginQuote {
  const quoteIndex = Math.floor(random() * LOGIN_QUOTES.length);

  return LOGIN_QUOTES[quoteIndex];
}
