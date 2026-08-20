import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { ProfilePreview } from "@/components/profile/profile-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { PairingInterface } from "@/components/pairing/pairing-interface";

export default async function PairingPage() {
  const t = await getTranslations("pairing.page");

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="rounded-lg bg-card text-card-foreground">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">{t("queueHeading")}</h2>
              <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
                <PairingInterface />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-card text-card-foreground">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{t("profileHeading")}</h2>
              <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
                <ProfilePreview />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
