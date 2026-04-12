import { Suspense } from "react";

import { ProfilePreview } from "@/components/profile/profile-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { PairingInterface } from "@/components/pairing/pairing-interface";

export default async function PairingPage() {
  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pairing Dashboard</h1>
        <p className="text-muted-foreground">
          Find your perfect learning match or help others by sharing your
          knowledge.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Pairing queue and matches</h2>
              <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
                <PairingInterface />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
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
