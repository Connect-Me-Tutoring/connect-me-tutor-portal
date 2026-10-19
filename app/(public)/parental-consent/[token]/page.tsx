import type { Metadata } from "next";
import Link from "next/link";
import { getConsentRequestSummary } from "@/lib/consent/parental-consent.server";
import { ConsentButtons } from "./consent-buttons";

export const metadata: Metadata = {
  title: "Parental Permission | Connect Me",
  robots: { index: false },
};

// When this wording changes materially, bump CONSENT_TEXT_VERSION in lib/consent/types.ts.
export default async function ParentalConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await getConsentRequestSummary(token);

  if (!request) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-bold">Link not found</h1>
        <p className="mt-2">This permission link is not valid. Please contact us for a new one.</p>
      </main>
    );
  }

  const done: Record<string, string> = {
    approved: `Thank you. Permission was given for ${request.studentFirstName}. We've emailed ${request.studentFirstName} a link to set up their account.`,
    declined: `You declined. No account was created for ${request.studentFirstName} and the information entered has been deleted.`,
    expired: "This link has expired. Please contact us and we'll send a new one.",
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-12 space-y-6">
      <h1 className="text-2xl font-bold">Parent/guardian permission</h1>

      {request.status !== "pending" ? (
        <p>{done[request.status]}</p>
      ) : (
        <>
          <p>
            {request.parentName ? `${request.parentName}, ` : ""}
            {request.studentFirstName} has been signed up for free tutoring with Connect Me.
            Because they are under 13, we need your permission before creating their account.
          </p>
          <section className="space-y-2">
            <h2 className="font-semibold">What we collect</h2>
            <p>
              Your child&apos;s name, email, age, grade, and subjects of interest; your contact
              details; their tutoring schedule, session notes, and messages with their tutor; and
              basic usage data. We use it only to provide tutoring, never for advertising, and we
              never sell it.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Your rights</h2>
            <p>
              You can review, correct, or delete your child&apos;s information, or stop further
              collection, at any time by emailing info@connectmego.org. See our{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
          <ConsentButtons token={token} />
        </>
      )}
    </main>
  );
}
