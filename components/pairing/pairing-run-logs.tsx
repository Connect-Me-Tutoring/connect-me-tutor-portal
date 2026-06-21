"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PairingMatchPreview, PairingWorkflowPreviewPayload } from "@/types/pairing";
import { filterPairingPreviewLogsForKeys } from "@/lib/pairing/filterPreviewLogs";
import { normalizePairingWorkflowPreviewPayload } from "@/lib/pairing/normalizePreviewPayload";
import { to12Hour } from "@/lib/utils";
import { Waypoints } from "lucide-react";
import { PairingCommitteeGraphDialog } from "./pairing-committee-graph";

type StoredPairingRun = {
  runId: string;
  createdAt: string;
  preview: PairingWorkflowPreviewPayload;
  appliedAt?: string;
};

const PREVIEW_RUN_STORAGE_PREFIX = "pairing-preview-run:";

function previewKey(p: PairingMatchPreview): string {
  return `${p.pairing_request_id}:${p.match_profile_id}`;
}

export function PairingRunLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");

  const [run, setRun] = useState<StoredPairingRun | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showNoOverlapOnly, setShowNoOverlapOnly] = useState(false);
  const [graphScope, setGraphScope] = useState<
    "closed" | "selected" | "complete"
  >("closed");

  useEffect(() => {
    if (!runId || typeof window === "undefined") {
      setRun(null);
      setSelectedKeys(new Set());
      return;
    }

    const raw = window.sessionStorage.getItem(
      `${PREVIEW_RUN_STORAGE_PREFIX}${runId}`,
    );
    if (!raw) {
      setRun(null);
      setSelectedKeys(new Set());
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredPairingRun;
      const preview = normalizePairingWorkflowPreviewPayload(parsed.preview);
      setRun({ ...parsed, preview });
      if (preview.matchPreviews.length > 0) {
        setSelectedKeys(
          new Set(preview.matchPreviews.map((p) => previewKey(p))),
        );
      } else {
        setSelectedKeys(new Set());
      }
    } catch {
      setRun(null);
      setSelectedKeys(new Set());
    }
  }, [runId]);

  const createdAtText = useMemo(() => {
    if (!run?.createdAt) return "";
    return new Date(run.createdAt).toLocaleString();
  }, [run?.createdAt]);

  const isLegacyPreview = !run?.preview.matchPreviews?.length;
  const hasOverlapData = Boolean(run?.preview.matchPreviews?.length);

  const graphPreviewsForDialog = useMemo((): PairingMatchPreview[] => {
    if (!run) return [];
    if (run.preview.matchPreviews.length > 0) return run.preview.matchPreviews;
    return run.preview.matchesToInsert.map((m, i) => ({
      pairing_request_id: `legacy-${i}`,
      match_profile_id: m.tutor_id,
      student_id: m.student_id,
      tutor_id: m.tutor_id,
      similarity: m.similarity,
      student_name: `Student ${m.student_id.slice(0, 8)}…`,
      tutor_name: `Tutor ${m.tutor_id.slice(0, 8)}…`,
      overlapping_subjects: [],
      overlapping_slots: [],
    }));
  }, [run]);

  const canShowGraph = Boolean(
    run &&
      (run.preview.matchPreviews.length > 0 ||
        run.preview.matchesToInsert.length > 0),
  );

  const graphPreviewsSelected = useMemo(() => {
    if (!run?.preview.matchPreviews?.length) return [];
    return run.preview.matchPreviews.filter((p) =>
      selectedKeys.has(previewKey(p)),
    );
  }, [run, selectedKeys]);

  const canShowSelectedGraph =
    hasOverlapData && graphPreviewsSelected.length > 0;

  const visiblePreviews = useMemo(() => {
    const list = run?.preview.matchPreviews ?? [];
    if (!showNoOverlapOnly) return list;
    return list.filter(
      (p) =>
        p.overlapping_subjects.length === 0 && p.overlapping_slots.length === 0,
    );
  }, [run?.preview.matchPreviews, showNoOverlapOnly]);

  const toggleKey = useCallback((key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const p of visiblePreviews) {
        next.add(previewKey(p));
      }
      return next;
    });
  }, [visiblePreviews]);

  const clearAll = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const handleApplyRun = async () => {
    if (!run) return;

    if (!isLegacyPreview && selectedKeys.size === 0) {
      toast.error("Select at least one proposed match to apply");
      return;
    }

    setIsApplying(true);

    let matchesToInsert = run.preview.matchesToInsert;
    let logs = run.preview.logs;

    if (!isLegacyPreview) {
      const previews = run.preview.matchPreviews.filter((p) =>
        selectedKeys.has(previewKey(p)),
      );
      matchesToInsert = previews.map((p) => ({
        student_id: p.student_id,
        tutor_id: p.tutor_id,
        similarity: p.similarity,
      }));
      logs = filterPairingPreviewLogsForKeys(run.preview.logs, selectedKeys);
    }

    const promise = axios.post("/api/pairing?debug=1", {
      mode: "apply-preview",
      preview: {
        matchesToInsert,
        logs,
      },
    });

    toast.promise(promise, {
      success: "Applied this run's saved queue changes",
      error: "Failed to apply this run",
      loading: "Applying saved run...",
    });

    try {
      await promise;
      if (typeof window !== "undefined") {
        const nextRun: StoredPairingRun = {
          ...run,
          appliedAt: new Date().toISOString(),
        };
        window.sessionStorage.setItem(
          `${PREVIEW_RUN_STORAGE_PREFIX}${run.runId}`,
          JSON.stringify(nextRun),
        );
        setRun(nextRun);
      }
      router.refresh();
    } finally {
      setIsApplying(false);
    }
  };

  if (!runId || !run) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pairing Run Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No saved preview run found for this page.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/pairing-que")}
          >
            Back to Pairing Queue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PairingCommitteeGraphDialog
        open={graphScope !== "closed"}
        onOpenChange={(o) => {
          if (!o) setGraphScope("closed");
        }}
        mode="preview"
        previews={
          graphScope === "selected"
            ? graphPreviewsSelected
            : graphScope === "complete"
              ? graphPreviewsForDialog
              : []
        }
        title={
          graphScope === "selected"
            ? "Selected for apply"
            : graphScope === "complete"
              ? "All proposed matches"
              : undefined
        }
        description={
          graphScope === "selected"
            ? "Only checked rows will be applied. Arrows: student → tutor."
            : graphScope === "complete"
              ? "Every pairing in this preview run. Compare with your selection before applying."
              : undefined
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pairing Run Logs</CardTitle>
          <div className="flex flex-wrap gap-2">
            {hasOverlapData && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setGraphScope("selected")}
                  disabled={!canShowSelectedGraph}
                  title={
                    !canShowSelectedGraph
                      ? "Select at least one row in the overlap table"
                      : undefined
                  }
                >
                  <Waypoints className="h-4 w-4" />
                  Selected graph
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setGraphScope("complete")}
                  disabled={!canShowGraph}
                >
                  <Waypoints className="h-4 w-4" />
                  All proposed
                </Button>
              </>
            )}
            {!hasOverlapData && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setGraphScope("complete")}
                disabled={!canShowGraph}
              >
                <Waypoints className="h-4 w-4" />
                View graph
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/pairing-que/logs")}
            >
              View Global Logs
            </Button>
            <Button
              onClick={handleApplyRun}
              disabled={
                isApplying ||
                Boolean(run.appliedAt) ||
                (!isLegacyPreview && selectedKeys.size === 0)
              }
            >
              {run.appliedAt
                ? "Already Applied"
                : isLegacyPreview
                  ? "Apply This Run"
                  : `Apply selected (${selectedKeys.size})`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Run ID: <span className="font-mono">{run.runId}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Created: {createdAtText}
          </div>
          {run.appliedAt && (
            <div className="text-sm text-green-700">
              Applied at {new Date(run.appliedAt).toLocaleString()}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              Proposed matches: {run.preview.summary.matchesToInsert}
            </Badge>
            <Badge variant="outline">
              Run logs: {run.preview.summary.logsToInsert}
            </Badge>
            {hasOverlapData && (
              <Badge variant="secondary">
                Selected to apply: {selectedKeys.size}
              </Badge>
            )}
          </div>
          {isLegacyPreview && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
              This preview was saved before overlap metadata existed. Apply will
              insert all proposed matches. Run a new preview for overlap review
              and selective apply.
            </p>
          )}
        </CardContent>
      </Card>

      {hasOverlapData && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Review overlap before apply</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setGraphScope("selected")}
                disabled={!canShowSelectedGraph}
                title={
                  !canShowSelectedGraph
                    ? "Select at least one row in the table below"
                    : undefined
                }
              >
                <Waypoints className="h-4 w-4 shrink-0" />
                Selected graph
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setGraphScope("complete")}
                disabled={!canShowGraph}
              >
                <Waypoints className="h-4 w-4 shrink-0" />
                All proposed
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
                Select all (visible)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                Clear all
              </Button>
              <Button
                type="button"
                variant={showNoOverlapOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowNoOverlapOnly((v) => !v)}
              >
                {showNoOverlapOnly ? "Show all" : "Show no-overlap only"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Student</TableHead>
                    <TableHead>Tutor</TableHead>
                    <TableHead>Similarity</TableHead>
                    <TableHead>Subject overlap</TableHead>
                    <TableHead>Time overlap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePreviews.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No proposed matches in this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visiblePreviews.map((p) => {
                      const key = previewKey(p);
                      const checked = selectedKeys.has(key);
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                toggleKey(key, v === true)
                              }
                              aria-label={`Select match ${p.student_name} / ${p.tutor_name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {p.student_name}
                          </TableCell>
                          <TableCell className="font-medium">
                            {p.tutor_name}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {typeof p.similarity === "number"
                              ? p.similarity.toFixed(2)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.overlapping_subjects.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  None
                                </span>
                              ) : (
                                p.overlapping_subjects.map((s) => (
                                  <Badge key={s} variant="secondary" className="text-xs">
                                    {s}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 max-w-sm">
                              {p.overlapping_slots.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  None
                                </span>
                              ) : (
                                p.overlapping_slots.map((slot, i) => (
                                  <Badge
                                    key={`${slot.day}-${slot.startTime}-${i}`}
                                    variant="outline"
                                    className="text-xs w-fit"
                                  >
                                    {slot.day}: {to12Hour(slot.startTime)} –{" "}
                                    {to12Hour(slot.endTime)}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Logs for this run only ({run.preview.logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.preview.logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No logs captured in this run.
                    </TableCell>
                  </TableRow>
                ) : (
                  run.preview.logs.map((log, index) => (
                    <TableRow key={`${log.type}-${index}`}>
                      <TableCell className="font-mono text-xs">
                        {index + 1}
                      </TableCell>
                      <TableCell>{log.type}</TableCell>
                      <TableCell>
                        <Badge variant={log.error ? "destructive" : "outline"}>
                          {log.error ? "error" : "ok"}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.message}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
