"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "../ui/button";
import axios from "axios";
import toast from "react-hot-toast";
import { deleteAllPairingRequests, resetPairingQueues } from "@/lib/actions/pairing/server.actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import type { PairingWorkflowPreviewPayload } from "@/types/pairing";
import { normalizePairingWorkflowPreviewPayload } from "@/lib/pairing/normalizePreviewPayload";

type StoredPairingRun = {
  runId: string;
  createdAt: string;
  preview: PairingWorkflowPreviewPayload;
  appliedAt?: string;
};

const PREVIEW_RUN_STORAGE_PREFIX = "pairing-preview-run:";

export function TestingPairingControls() {
  const t = useTranslations("pairing.testControls");
  const router = useRouter();
  const [previewResult, setPreviewResult] = useState<PairingWorkflowPreviewPayload | null>(null);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);

  const createRunId = () => {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `pairing-run-${Date.now()}`;
  };

  const savePreviewRun = (run: StoredPairingRun) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(`${PREVIEW_RUN_STORAGE_PREFIX}${run.runId}`, JSON.stringify(run));
  };

  const handleOpenLatestRunLogs = () => {
    if (!latestRunId) {
      toast.error(t("toasts.runPreviewFirst"));
      return;
    }
    router.push(`/dashboard/pairing-que/logs?runId=${latestRunId}`);
  };

  const handlePreviewQueues = async () => {
    const promise = axios.post("/api/pairing?dryRun=1&debug=1");
    toast.promise(promise, {
      success: t("toasts.previewReady"),
      error: t("toasts.previewError"),
      loading: t("toasts.previewLoading"),
    });

    const response = await promise;
    const raw = response.data?.result;
    if (!raw) {
      throw new Error("Missing preview result from API");
    }
    const result = normalizePairingWorkflowPreviewPayload(raw);

    setPreviewResult(result);
    const runId = createRunId();
    setLatestRunId(runId);
    savePreviewRun({
      runId,
      createdAt: new Date().toISOString(),
      preview: result,
    });
    router.push(`/dashboard/pairing-que/logs?runId=${runId}`);
  };

  const handleApplySavedPreview = async () => {
    if (!previewResult) {
      toast.error(t("toasts.runPreviewBeforeApply"));
      return;
    }

    const promise = axios.post("/api/pairing?debug=1", {
      mode: "apply-preview",
      preview: {
        matchesToInsert: previewResult.matchesToInsert,
        logs: previewResult.logs,
      },
    });

    toast.promise(promise, {
      success: t("toasts.applySuccess"),
      error: t("toasts.applyError"),
      loading: t("toasts.applyLoading"),
    });

    await promise;
    setPreviewResult(null);
    router.refresh();
  };

  const handleResolveQueues = () => {
    const promise = axios.post("/api/pairing");
    toast.promise(promise, {
      success: t("toasts.resolveSuccess"),
      error: t("toasts.resolveError"),
      loading: t("toasts.resolveLoading"),
    });
  };

  const handleClearQueues = () => {
    toast.promise(resetPairingQueues(), {
      success: t("toasts.resetQueueSuccess"),
      error: t("toasts.resetQueueError"),
      loading: t("toasts.resetQueueLoading"),
    });
  };

  const handleResetPairings = () => {
    toast.promise(deleteAllPairingRequests(), {
      success: t("toasts.clearQueueSuccess"),
      error: t("toasts.clearQueueError"),
      loading: t("toasts.clearQueueLoading"),
    });
  };

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
      <h3 className="text-sm font-medium text-gray-700 mb-3">{t("heading")}</h3>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePreviewQueues} variant="outline" size="sm">
          {t("previewQueueOutput")}
        </Button>
        <Button
          onClick={handleApplySavedPreview}
          variant="outline"
          size="sm"
          disabled={!previewResult}
        >
          {t("applySavedPreview")}
        </Button>
        <Button
          onClick={handleOpenLatestRunLogs}
          variant="outline"
          size="sm"
          disabled={!latestRunId}
        >
          {t("openLatestRunLogs")}
        </Button>
        <Button onClick={handleResolveQueues} variant="outline" size="sm">
          {t("resolveQueueImmediate")}
        </Button>
        <Button onClick={handleClearQueues} variant="outline" size="sm">
          {t("clearQueue")}
        </Button>
        <Button
          onClick={() => router.push("/dashboard/pairing-que/logs")}
          variant="outline"
          size="sm"
        >
          {t("logs")}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              {t("resetAllPairingMatches")}
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("resetDialog.title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("resetDialog.description")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">{t("resetDialog.back")}</Button>
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleResetPairings}>
                {t("resetDialog.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {previewResult && (
        <div className="mt-4 rounded-md border bg-white p-3">
          <div className="mb-2 text-sm text-gray-700">
            {t("previewSummary", {
              matchCount: previewResult.summary.matchesToInsert,
              logCount: previewResult.summary.logsToInsert,
            })}
          </div>
          <div className="max-h-56 overflow-y-auto rounded border bg-gray-50 p-2 text-xs text-gray-700">
            {previewResult.logs.length === 0 ? (
              <p>{t("noPreviewLogs")}</p>
            ) : (
              previewResult.logs.map((log, index) => (
                <p key={`${log.type}-${index}`} className="mb-1 last:mb-0">
                  {t("logEntry", {
                    status: log.error ? t("statusError") : t("statusOk"),
                    type: log.type,
                    message: log.message,
                  })}
                </p>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
