"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { respondToConsentRequest } from "./actions";

export function ConsentButtons({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const respond = (decision: "approve" | "decline") =>
    startTransition(async () => {
      setError(null);
      try {
        await respondToConsentRequest(token, decision);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Button disabled={pending} onClick={() => respond("approve")}>
          I give permission
        </Button>
        <Button disabled={pending} variant="outline" onClick={() => respond("decline")}>
          Decline
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
