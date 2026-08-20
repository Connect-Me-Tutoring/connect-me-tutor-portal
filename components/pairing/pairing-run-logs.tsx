"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { MobileCard } from "@/components/ui/mobile-card";

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
  const t = useTranslations("pairing.runLogs");
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");

  const [run, setRun] = useState<StoredPairingRun | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showNoOverlapOnly, setShowNoOverlapOnly] = useState(false);
  const [graphScope, setGraphScope] = useState<"closed" | "selected" | "complete">("closed");

  useEffect(() => {
    if (!runId || typeof window === "undefined") {
      setRun(null);
      setSelectedKeys(new Set());
      return;
    }

    const raw = window.sessionStorage.getItem(`${PREVIEW_RUN_STORAGE_PREFIX}${runId}`);
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
        setSelectedKeys(new Set(preview.matchPreviews.map((p) => previewKey(p))));
      } else {
        setSelectedKeys(new Set());
      }
    } catch {
      setRun(null);
      setSelectedKeys(new Set());
    }
  }, [runId]);

  const runCreatedAt = run?.createdAt;
  const createdAtText = useMemo(() => {
    if (!runCreatedAt) return "";
    return new Date(runCreatedAt).toLocaleString();
  }, [runCreatedAt]);

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
    run && (run.preview.matchPreviews.length > 0 || run.preview.matchesToInsert.length > 0),
  );

  const graphPreviewsSelected = useMemo(() => {
    if (!run?.preview.matchPreviews?.length) return [];
    return run.preview.matchPreviews.filter((p) => selectedKeys.has(previewKey(p)));
  }, [run, selectedKeys]);

  const canShowSelectedGraph = hasOverlapData && graphPreviewsSelected.length > 0;

  const visiblePreviews = useMemo(() => {
    const list = run?.preview.matchPreviews ?? [];
    if (!showNoOverlapOnly) return list;
    return list.filter(
      (p) => p.overlapping_subjects.length === 0 && p.overlapping_slots.length === 0,
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
      toast.error(t("toasts.selectAtLeastOne"));
      return;
    }

    setIsApplying(true);

    let matchesToInsert = run.preview.matchesToInsert;
    let logs = run.preview.logs;

    if (!isLegacyPreview) {
      const previews = run.preview.matchPreviews.filter((p) => selectedKeys.has(previewKey(p)));
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
      success: t("toasts.applySuccess"),
      error: t("toasts.applyError"),
      loading: t("toasts.applying"),
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
          <CardTitle>{t("cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("noSavedRun")}</p>
          <Button variant="outline" onClick={() => router.push("/dashboard/pairing-que")}>
            {t("backToQueue")}
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
            ? t("graphDialog.selectedTitle")
            : graphScope === "complete"
              ? t("graphDialog.completeTitle")
              : undefined
        }
        description={
          graphScope === "selected"
            ? t("graphDialog.selectedDescription")
            : graphScope === "complete"
              ? t("graphDialog.completeDescription")
              : undefined
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("cardTitle")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {hasOverlapData && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setGraphScope("selected")}
                  disabled={!canShowSelectedGraph}
                  title={!canShowSelectedGraph ? t("actions.selectRowHint") : undefined}
                >
                  <Waypoints className="h-4 w-4" />
                  {t("actions.selectedGraph")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setGraphScope("complete")}
                  disabled={!canShowGraph}
                >
                  <Waypoints className="h-4 w-4" />
                  {t("actions.allProposed")}
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
                {t("actions.viewGraph")}
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/dashboard/pairing-que/logs")}>
              {t("actions.viewGlobalLogs")}
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
                ? t("actions.alreadyApplied")
                : isLegacyPreview
                  ? t("actions.applyThisRun")
                  : t("actions.applySelected", { count: selectedKeys.size })}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {t("runIdLabel")} <span className="font-mono">{run.runId}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {t("createdLabel")} {createdAtText}
          </div>
          {run.appliedAt && (
            <div className="text-sm text-green-700">
              {t("appliedAt", { date: new Date(run.appliedAt).toLocaleString() })}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {t("badges.proposedMatches", { count: run.preview.summary.matchesToInsert })}
            </Badge>
            <Badge variant="outline">
              {t("badges.runLogs", { count: run.preview.summary.logsToInsert })}
            </Badge>
            {hasOverlapData && (
              <Badge variant="secondary">
                {t("badges.selectedToApply", { count: selectedKeys.size })}
              </Badge>
            )}
          </div>
          {isLegacyPreview && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
              {t("legacyPreviewWarning")}
            </p>
          )}
        </CardContent>
      </Card>

      {hasOverlapData && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>{t("overlapReview.cardTitle")}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setGraphScope("selected")}
                disabled={!canShowSelectedGraph}
                title={!canShowSelectedGraph ? t("overlapReview.selectRowHint") : undefined}
              >
                <Waypoints className="h-4 w-4 shrink-0" />
                {t("actions.selectedGraph")}
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
                {t("actions.allProposed")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
                {t("overlapReview.selectAllVisible")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                {t("overlapReview.clearAll")}
              </Button>
              <Button
                type="button"
                variant={showNoOverlapOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowNoOverlapOnly((v) => !v)}
              >
                {showNoOverlapOnly
                  ? t("overlapReview.showAll")
                  : t("overlapReview.showNoOverlapOnly")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>{t("overlapReview.student")}</TableHead>
                    <TableHead>{t("overlapReview.tutor")}</TableHead>
                    <TableHead>{t("overlapReview.similarity")}</TableHead>
                    <TableHead>{t("overlapReview.subjectOverlap")}</TableHead>
                    <TableHead>{t("overlapReview.timeOverlap")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePreviews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t("overlapReview.noMatchesInFilter")}
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
                              onCheckedChange={(v) => toggleKey(key, v === true)}
                              aria-label={t("overlapReview.selectMatchAriaLabel", {
                                student: p.student_name,
                                tutor: p.tutor_name,
                              })}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{p.student_name}</TableCell>
                          <TableCell className="font-medium">{p.tutor_name}</TableCell>
                          <TableCell className="tabular-nums">
                            {typeof p.similarity === "number" ? p.similarity.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.overlapping_subjects.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  {t("overlapReview.none")}
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
                                  {t("overlapReview.none")}
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

            <div className="md:hidden space-y-4">
              {visiblePreviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("overlapReview.noMatchesInFilter")}
                </div>
              ) : (
                visiblePreviews.map((p) => {
                  const key = previewKey(p);
                  const checked = selectedKeys.has(key);
                  return (
                    <MobileCard key={key}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleKey(key, v === true)}
                          aria-label={t("overlapReview.selectMatchAriaLabel", {
                            student: p.student_name,
                            tutor: p.tutor_name,
                          })}
                        />
                        <div className="text-sm">
                          <div className="font-medium">{p.student_name}</div>
                          <div className="text-muted-foreground">
                            {t("overlapReview.withTutor", { tutorName: p.tutor_name })}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm">
                        {t("overlapReview.similarityValue", {
                          value: typeof p.similarity === "number" ? p.similarity.toFixed(2) : "—",
                        })}
                      </div>
                      <div className="text-sm">
                        <div className="font-medium mb-1">{t("overlapReview.subjectOverlap")}</div>
                        <div className="flex flex-wrap gap-1">
                          {p.overlapping_subjects.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("overlapReview.none")}
                            </span>
                          ) : (
                            p.overlapping_subjects.map((s) => (
                              <Badge key={s} variant="secondary" className="text-xs">
                                {s}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium mb-1">{t("overlapReview.timeOverlap")}</div>
                        <div className="flex flex-col gap-1">
                          {p.overlapping_slots.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("overlapReview.none")}
                            </span>
                          ) : (
                            p.overlapping_slots.map((slot, i) => (
                              <Badge
                                key={`${slot.day}-${slot.startTime}-${i}`}
                                variant="outline"
                                className="text-xs w-fit"
                              >
                                {slot.day}: {to12Hour(slot.startTime)} – {to12Hour(slot.endTime)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    </MobileCard>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {t("runLogsTable.cardTitle", { count: run.preview.logs.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("runLogsTable.step")}</TableHead>
                  <TableHead>{t("runLogsTable.type")}</TableHead>
                  <TableHead>{t("runLogsTable.status")}</TableHead>
                  <TableHead>{t("runLogsTable.message")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.preview.logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {t("runLogsTable.noLogsCaptured")}
                    </TableCell>
                  </TableRow>
                ) : (
                  run.preview.logs.map((log, index) => (
                    <TableRow key={`${log.type}-${index}`}>
                      <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                      <TableCell>{log.type}</TableCell>
                      <TableCell>
                        <Badge variant={log.error ? "destructive" : "outline"}>
                          {log.error ? t("runLogsTable.statusError") : t("runLogsTable.statusOk")}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.message}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-4">
            {run.preview.logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("runLogsTable.noLogsCaptured")}
              </div>
            ) : (
              run.preview.logs.map((log, index) => (
                <MobileCard key={`${log.type}-${index}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-sm font-mono text-muted-foreground">
                      {t("runLogsTable.stepLabel", { number: index + 1 })}
                    </div>
                    <Badge variant={log.error ? "destructive" : "outline"}>
                      {log.error ? t("runLogsTable.statusError") : t("runLogsTable.statusOk")}
                    </Badge>
                  </div>
                  <div className="text-sm">{log.type}</div>
                  <div className="text-sm">{log.message}</div>
                </MobileCard>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
