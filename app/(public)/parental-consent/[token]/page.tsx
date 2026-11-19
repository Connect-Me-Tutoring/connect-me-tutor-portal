import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Parental Permission | Connect Me",
  robots: { index: false },
};

// Landing page for links emailed by the retired parent-approval flow (last links
// expire 2026-10-27). Consent is now collected at intake, so there is nothing to do.
export default function ParentalConsentPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12 space-y-4">
      <h1 className="text-2xl font-bold">No action needed</h1>
      <p>
        Thank you. We already have your permission on file from when your child signed up, so this
        link is no longer needed. Your child&apos;s account has been set up and they will get an
        email to finish signing in.
      </p>
      <p>
        Questions, or want to review or delete your child&apos;s information? Email
        info@connectmego.org. See our{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
