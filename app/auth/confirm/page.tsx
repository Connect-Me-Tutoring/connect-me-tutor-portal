import type { Metadata } from "next";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Logo from "@/components/ui/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseEmailLinkType, safeNextPath } from "@/lib/auth/email-link";
import { ContinueForm } from "./continue-form";

export const metadata: Metadata = {
  title: "Continue to Connect Me",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const COPY: Partial<Record<EmailOtpType, { title: string; description: string }>> = {
  invite: {
    title: "Welcome to Connect Me",
    description: "Continue to set your password and finish setting up your account.",
  },
  email_change: {
    title: "Confirm your new email",
    description: "Continue to confirm the change to your login email.",
  },
  recovery: {
    title: "Reset your password",
    description: "Continue to choose a new password.",
  },
};

const DEFAULT_COPY = {
  title: "Continue to Connect Me",
  description: "Continue to finish signing in.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Landing page for every email link. Opening it changes nothing: the token is only
// spent when the person presses Continue (a POST to /auth/confirm/verify), so mail
// scanners that open links ahead of the person no longer expire them.
export default async function ConfirmEmailLinkPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : null;
  const type = parseEmailLinkType(params.type);
  if (!tokenHash || !type) redirect("/auth/auth-code-error");

  const next = safeNextPath(params.next);
  const copy = COPY[type] ?? DEFAULT_COPY;

  return (
    <>
      <section className="flex flex-row">
        <div className="absolute left-4 top-4 sm:left-8 sm:top-8">
          <Logo />
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <ContinueForm tokenHash={tokenHash} type={type} next={next} />
          </CardContent>
          <CardFooter>
            <p className="text-center text-xs text-muted-foreground">
              This extra step stops school and work email filters from using up your link before you
              get to it.
            </p>
          </CardFooter>
        </Card>
      </section>
    </>
  );
}
