"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, ExternalLink, Calendar, BookOpen, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfilePairingMetadata } from "@/types/profile";
import { fetchProfileData } from "@/lib/utils/profile-utils";
import { useFetchProfile } from "@/hooks/auth";

export function ProfilePreview() {
  const t = useTranslations("profileSessions");
  const { profile, loading } = useFetchProfile();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // await loadProfile()
    setRefreshing(false);
  };

  const openProfileEditor = () => {
    window.open("/dashboard/profile", "_blank");
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground mb-4">{t("profilePreview.notFound")}</p>
        <Button onClick={openProfileEditor}>{t("profilePreview.createProfile")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">{t("profilePreview.heading")}</h3>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          {t("profilePreview.refresh")}
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t("profilePreview.availability.label")}</p>
            {profile.availability && profile.availability.length > 0 ? (
              <div className="grid gap-1 mt-1">
                {profile.availability.map((slot, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    {t(`days.${slot.day}`)}: {slot.startTime} - {slot.endTime}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("profilePreview.availability.empty")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <BookOpen className="h-4 w-4 mt-1 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t("profilePreview.subjects.label")}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {profile.subjects_of_interest && profile.subjects_of_interest.length > 0 ? (
                profile.subjects_of_interest.map((subject, i) => (
                  <Badge key={i} variant="secondary">
                    {subject}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t("profilePreview.subjects.empty")}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Languages className="h-4 w-4 mt-1 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t("profilePreview.languages.label")}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {profile.languages_spoken && profile.languages_spoken.length > 0 ? (
                profile.languages_spoken.map((language, i) => (
                  <Badge key={i} variant="outline">
                    {language}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("profilePreview.languages.empty")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <Button
        variant="link"
        className="p-0 h-auto w-full justify-start text-primary"
        onClick={openProfileEditor}
      >
        {t("profilePreview.editLink")}
        <ExternalLink className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4 mt-1" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4 mt-1" />
          <div className="flex-1">
            <Skeleton className="h-4 w-20 mb-2" />
            <div className="flex gap-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-14" />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4 mt-1" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-2" />
            <div className="flex gap-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <Skeleton className="h-4 w-32" />
    </div>
  );
}
