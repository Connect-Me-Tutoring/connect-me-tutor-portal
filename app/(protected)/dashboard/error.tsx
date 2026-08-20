"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("dashboardMisc.error");

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold">{t("heading")}</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {error.message || t("defaultMessage")}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => reset()}>
          {t("tryAgain")}
        </Button>
        <Button type="button" onClick={() => router.push("/")}>
          {t("goHome")}
        </Button>
      </div>
    </div>
  );
}
