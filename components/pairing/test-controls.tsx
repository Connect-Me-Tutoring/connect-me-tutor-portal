"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import axios from "axios";
import toast from "react-hot-toast";
import { deleteAllPairingRequests, resetPairingQueues } from "@/lib/actions/pairing.server.actions";
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
      toast.error("Run a preview first");
      return;
    }
    router.push(`/dashboard/pairing-que/logs?runId=${latestRunId}`);
  };

  const handlePreviewQueues = async () => {
    const promise = axios.post("/api/pairing?dryRun=1&debug=1");
    toast.promise(promise, {
      success: "Preview ready. Review logs before applying.",
      error: "Failed to run pairing preview",
      loading: "Building pairing preview...",
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
      toast.error("Run a preview before applying queue changes");
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
      success: "Applied saved queue changes",
      error: "Failed to apply saved queue changes",
      loading: "Applying saved queue changes...",
    });

    await promise;
    setPreviewResult(null);
    router.refresh();
  };

  const handleResolveQueues = () => {
    const promise = axios.post("/api/pairing");
    toast.promise(promise, {
      success: "Successfully ran pairing process",
      error: "Failed to run pairing process",
      loading: "Pairing...",
    });
  };

  const handleClearQueues = () => {
    toast.promise(resetPairingQueues(), {
      success: "Successfully Reset Queue",
      error: "Failed to Reset Queue",
      loading: "Resetting Queue",
    });
  };

  const handleResetPairings = () => {
    toast.promise(deleteAllPairingRequests(), {
      success: "Successfully Cleared Queue",
      error: "Failed to clear queue",
      loading: "Clearing...",
    });
  };

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Testing Controls</h3>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePreviewQueues} variant="outline" size="sm">
          Preview Queue Output
        </Button>
        <Button
          onClick={handleApplySavedPreview}
          variant="outline"
          size="sm"
          disabled={!previewResult}
        >
          Apply Saved Preview
        </Button>
        <Button
          onClick={handleOpenLatestRunLogs}
          variant="outline"
          size="sm"
          disabled={!latestRunId}
        >
          Open Latest Run Logs
        </Button>
        <Button onClick={handleResolveQueues} variant="outline" size="sm">
          {" Resolve Queue (Immediate)"}
        </Button>
        <Button onClick={handleClearQueues} variant="outline" size="sm">
          {" Clear Queue"}
        </Button>
        <Button
          onClick={() => router.push("/dashboard/pairing-que/logs")}
          variant="outline"
          size="sm"
        >
          Logs
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Reset all pairing matches
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset All Pairing Matches</AlertDialogTitle>
              <AlertDialogDescription>
                Remove tutors and students from pairing queue
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">Back</Button>
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleResetPairings}>
                Reset all pairing matches
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {previewResult && (
        <div className="mt-4 rounded-md border bg-white p-3">
          <div className="mb-2 text-sm text-gray-700">
            Preview generated with {previewResult.summary.matchesToInsert} proposed match
            {previewResult.summary.matchesToInsert === 1 ? "" : "es"} and{" "}
            {previewResult.summary.logsToInsert} log
            {previewResult.summary.logsToInsert === 1 ? "" : "s"}.
          </div>
          <div className="max-h-56 overflow-y-auto rounded border bg-gray-50 p-2 text-xs text-gray-700">
            {previewResult.logs.length === 0 ? (
              <p>No preview logs were returned.</p>
            ) : (
              previewResult.logs.map((log, index) => (
                <p key={`${log.type}-${index}`} className="mb-1 last:mb-0">
                  {log.error ? "ERROR" : "OK"} - [{log.type}] {log.message}
                </p>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
