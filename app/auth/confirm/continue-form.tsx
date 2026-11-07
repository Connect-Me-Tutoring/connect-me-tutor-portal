"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ContinueFormProps {
  tokenHash: string;
  type: string;
  next: string;
}

// A plain form so it still works without JavaScript. With JavaScript, a second
// submit is blocked: the token is single-use, so a double click would send a
// second request that fails and leaves the person on the "link expired" page.
export function ContinueForm({ tokenHash, type, next }: ContinueFormProps) {
  const submitted = useRef(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      method="post"
      action="/auth/confirm/verify"
      onSubmit={(event) => {
        if (submitted.current) {
          event.preventDefault();
          return;
        }
        submitted.current = true;
        setPending(true);
      }}
    >
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />
      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-connect-me-blue-3 text-white hover:bg-connect-me-blue-4"
      >
        {pending ? "Continuing..." : "Continue"}
      </Button>
    </form>
  );
}
