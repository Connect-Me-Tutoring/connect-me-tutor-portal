import type { LoginQuote } from "@/types/login-quote";

interface LoginTestimonialProps {
  quote: LoginQuote;
}

export function LoginTestimonial({ quote }: LoginTestimonialProps) {
  return (
    <figure className="w-full max-w-xl space-y-3 p-8 text-lg leading-relaxed text-slate-900">
      <blockquote>
        <p>&ldquo;{quote.text}&rdquo;</p>
      </blockquote>
      <figcaption className="font-medium">&mdash; {quote.author}</figcaption>
    </figure>
  );
}
