import type { LoginQuote } from "@/types/login-quote";

export const LOGIN_QUOTES = [
  {
    text: "Connect me has helped me explore new math topics and learn critical problem solving skills. It makes learning so much fun",
    author: "Olivia M.",
  },
  {
    text: "I gained a lot of great experience while tutoring at Connect me",
    author: "Shahzoda J.",
  },
  {
    text: "Connect Me has provided me the experience of a lifetime, and I am beyond grateful for all of the opportunities that I have received due to this organization.",
    author: "Elizabeth A.",
  },
  {
    text: "Connect me tutoring is a great opportunity to meet and help new people",
    author: "Chinmayi Y.",
  },
  {
    text: "My experience on Connect Me has been an amazing opportunity for me to grow my leadership skills and teamwork capabilities.",
    author: "Sharara A.",
  },
] as const satisfies readonly LoginQuote[];
