"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Users, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import {
  createPairingRequest,
  getProfilePairingQueueState,
  getMyPairingRequest,
  removePairingRequest,
  setExcludeRejectedTutorsPreference,
  updatePairingRequest,
  type MyPairingRequest,
} from "@/lib/actions/pairing/client.actions";
import toast from "react-hot-toast";

export type PairingRequest = {
  id: string;
  to: string;
  type: "student" | "tutor";
  userId: string;
  profile: unknown;
  status: "pending" | "accepted" | "rejected";
  priority: number;
  createdAt: Date;
};

interface PairingRequestCardProps {
  userId: string;
  profileId: string;
  role: string;
}

export function PairingRequestCard({ userId, profileId, role }: PairingRequestCardProps) {
  const t = useTranslations("pairing.requestCard");
  const [notes, setNotes] = useState("");
  const [excludeRejectedTutors, setExcludeRejectedTutors] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [myRequest, setMyRequest] = useState<MyPairingRequest | null>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(true);
  const [isInQueue, setIsInQueue] = useState(false);

  const isStudent = role?.toLowerCase() === "student";
  const isDraftRequest = myRequest?.status === "draft";
  const isArchivedRequest = !!myRequest && myRequest.inQueue === false && !isDraftRequest;

  const refetch = useCallback(async () => {
    const [req, queueState] = await Promise.all([
      getMyPairingRequest(profileId),
      getProfilePairingQueueState(profileId),
    ]);

    setMyRequest(req ?? null);
    setIsInQueue(queueState);
    if (req) {
      setNotes(req.notes ?? "");
      setExcludeRejectedTutors(req.excludeRejectedTutors ?? true);
    }
  }, [profileId]);

  useEffect(() => {
    refetch().finally(() => setIsLoadingRequest(false));
  }, [refetch]);

  const joinQueue = async () => {
    setIsSubmitting(true);
    try {
      const promise = createPairingRequest(userId, notes, excludeRejectedTutors);
      toast.promise(promise, {
        success: t("toasts.joinSuccess"),
        loading: t("toasts.joining"),
        error: t("toasts.joinError"),
      });
      await promise;
      setNotes("");
      await refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!myRequest) return;
    setIsLeaving(true);
    try {
      const promise = removePairingRequest(myRequest.id);
      toast.promise(promise, {
        success: t("toasts.leaveSuccess"),
        loading: t("toasts.leaving"),
        error: t("toasts.leaveError"),
      });
      await promise;
      await refetch();
    } finally {
      setIsLeaving(false);
    }
  };

  const handleRejoinQueue = async () => {
    if (!myRequest) return;
    setIsSubmitting(true);
    try {
      const promise = createPairingRequest(userId, myRequest.notes ?? "", excludeRejectedTutors);
      toast.promise(promise, {
        success: t("toasts.rejoinSuccess"),
        loading: t("toasts.rejoining"),
        error: (e: Error) => e.message || t("toasts.rejoinError"),
      });
      await promise;
      await refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQueueSwitch = async (checked: boolean) => {
    if (isLoadingRequest) return;
    if (checked === isInQueue) return;

    const previousIsInQueue = isInQueue;
    const previousRequest = myRequest;

    setIsInQueue(checked);
    if (myRequest) {
      setMyRequest({
        ...myRequest,
        inQueue: checked,
      });
    }

    try {
      if (checked) {
        if (myRequest?.inQueue) return;
        if (myRequest && myRequest.inQueue === false) {
          await handleRejoinQueue();
          return;
        }
        if (!myRequest) {
          await joinQueue();
        }
      } else if (myRequest?.inQueue) {
        await handleLeaveQueue();
      }
    } catch (error) {
      setIsInQueue(previousIsInQueue);
      setMyRequest(previousRequest);
      throw error;
    }
  };

  const handleToggleExcludeRejected = async (checked: boolean) => {
    const previousValue = excludeRejectedTutors;
    setExcludeRejectedTutors(checked);
    if (myRequest) {
      setMyRequest({
        ...myRequest,
        excludeRejectedTutors: checked,
      });
    }

    const promise = myRequest
      ? updatePairingRequest(myRequest.id, {
          exclude_rejected_tutors: checked,
        })
      : setExcludeRejectedTutorsPreference(userId, checked);

    toast.promise(promise, {
      loading: t("toasts.preferenceUpdating"),
      success: t("toasts.preferenceUpdated"),
      error: t("toasts.preferenceError"),
    });

    try {
      await promise;
      await refetch();
    } catch (error) {
      setExcludeRejectedTutors(previousValue);
      if (myRequest) {
        setMyRequest({
          ...myRequest,
          excludeRejectedTutors: previousValue,
        });
      }
      throw error;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "accepted":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoadingRequest) {
    return (
      <Card className="w-full mx-auto border-0 shadow-none">
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        </CardContent>
      </Card>
    );
  }

  const queueSwitch = (
    <div className="rounded-xl bg-muted/50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 min-w-0">
        <Label htmlFor="pairing-queue-switch" className="text-base font-semibold">
          {t("queueSwitch.label")}
        </Label>
        <p className="text-sm text-muted-foreground">
          {isInQueue
            ? t("queueSwitch.onDescription")
            : isArchivedRequest
              ? t("queueSwitch.archivedDescription")
              : t("queueSwitch.offDescription")}
        </p>
      </div>
      <Switch
        id="pairing-queue-switch"
        checked={isInQueue}
        onCheckedChange={handleQueueSwitch}
        disabled={isLoadingRequest || isSubmitting || isLeaving}
        className="shrink-0 data-[state=checked]:bg-primary"
      />
    </div>
  );

  if (isArchivedRequest) {
    return (
      <Card className="w-full mx-auto border-0 shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">{t("archived.title")}</CardTitle>
          </div>
          <CardDescription className="text-base leading-relaxed">
            {t("archived.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {queueSwitch}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {t("archived.badge")}
            </Badge>
            <Badge variant="outline">
              {t("archived.priorityBadge", { priority: myRequest.priority })}
            </Badge>
          </div>
          {myRequest.notes ? (
            <div className="rounded-md bg-muted/30 p-3 text-sm">
              <span className="font-medium text-muted-foreground">
                {t("archived.savedNotesLabel")}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{myRequest.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (myRequest && !isDraftRequest) {
    return (
      <Card className="w-full mx-auto border-0 shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">{t("active.title")}</CardTitle>
          </div>
          <CardDescription className="text-base leading-relaxed">
            {t("active.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {queueSwitch}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`${getStatusColor(myRequest.status)} flex items-center gap-1`}>
              {getStatusIcon(myRequest.status)}
              {t(`status.${myRequest.status}`)}
            </Badge>
            <Badge variant="outline">
              {t("active.priorityBadge", { priority: myRequest.priority })}
            </Badge>
          </div>

          {isStudent && (
            <div className="flex items-center justify-between rounded-lg p-4">
              <div className="space-y-0.5">
                <Label htmlFor="block-rejected" className="text-base">
                  {t("blockRejected.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("blockRejected.description")}
                </p>
              </div>
              <Switch
                id="block-rejected"
                checked={excludeRejectedTutors}
                onCheckedChange={handleToggleExcludeRejected}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full mx-auto border-0 shadow-none">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl">{t("newRequest.title")}</CardTitle>
        </div>
        <CardDescription className="text-base leading-relaxed">
          {t("newRequest.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {queueSwitch}
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            {t("newRequest.howItWorksHeading")}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                1
              </Badge>
              <span>
                {t.rich("newRequest.step1", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                2
              </Badge>
              <span>{t("newRequest.step2")}</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                3
              </Badge>
              <span>{t("newRequest.step3")}</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                4
              </Badge>
              <span>{t("newRequest.step4")}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-base font-medium">
              {t("newRequest.notesLabel")}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {t("newRequest.optional")}
              </span>
            </Label>
            <Textarea
              id="notes"
              placeholder={t("newRequest.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px] resize-none"
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">
              {t("newRequest.charCount", { count: notes.length })}
            </div>
          </div>

          {isStudent && (
            <div className="flex items-center justify-between rounded-lg p-4">
              <div className="space-y-0.5">
                <Label htmlFor="block-rejected-form" className="text-base">
                  {t("blockRejected.label")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("blockRejected.description")}
                </p>
              </div>
              <Switch
                id="block-rejected-form"
                checked={excludeRejectedTutors}
                onCheckedChange={setExcludeRejectedTutors}
              />
            </div>
          )}
        </div>

        <div className="pt-4">
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">
            {t("newRequest.statusExamplesHeading")}
          </h4>
          <div className="flex flex-wrap gap-2">
            <Badge className={`${getStatusColor("pending")} flex items-center gap-1`}>
              {getStatusIcon("pending")}
              {t("newRequest.pendingReview")}
            </Badge>
            <Badge className={`${getStatusColor("accepted")} flex items-center gap-1`}>
              {getStatusIcon("accepted")}
              {t("newRequest.matchFound")}
            </Badge>
            <Badge className={`${getStatusColor("rejected")} flex items-center gap-1`}>
              {getStatusIcon("rejected")}
              {t("newRequest.noMatchAvailable")}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
