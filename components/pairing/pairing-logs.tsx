"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import axios from "axios";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Users, AlertCircle, Calendar, XCircle, CheckCircle, Waypoints } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { getPairingLogs } from "@/lib/actions/pairing/client.actions";
import type { PairingMatchPreview, PairingWorkflowPreviewPayload } from "@/types/pairing";
import { normalizePairingWorkflowPreviewPayload } from "@/lib/pairing/normalizePreviewPayload";
import type { PairingLogSchemaType } from "@/lib/pairing/types";
import { filterPairingPreviewLogsForKeys } from "@/lib/pairing/filterPreviewLogs";
import {
  mapPreviewPairingLog,
  pairingLogMatchesUserType,
  type PairingDisplayLog,
} from "@/lib/pairing/mapDisplayLogs";
import { to12Hour } from "@/lib/utils";
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

export type PairingLog = PairingDisplayLog;

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "matched":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "accepted":
    case "confirmed":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "declined":
    case "rejected":
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "completed":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
};

const getTypeIcon = (type: PairingLog["type"]) => {
  switch (type) {
    case "pairing-match":
      return <Users className="h-4 w-4" />;
    case "pairing-match-accepted":
      return <CheckCircle className="h-4 w-4" />;
    case "pairing-match-rejected":
      return <XCircle className="h-4 w-4" />;
    case "pairing-selection-failed":
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const today = new Date();
const tomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
export function PairingLogsTable() {
  const t = useTranslations("pairing.logs");
  const searchParams = useSearchParams();
  const previewRunId = searchParams.get("runId");
  const [logs, setLogs] = useState<PairingLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUserType, setFilterUserType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [dateFrom, setDateFrom] = useState<string>(formatDate(oneWeekAgo));
  const [dateTo, setDateTo] = useState<string>(formatDate(tomorrow));
  const [previewRun, setPreviewRun] = useState<StoredPairingRun | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [graphScope, setGraphScope] = useState<"closed" | "selected" | "complete">("closed");

  const hasOverlapPreviews = Boolean(previewRun?.preview.matchPreviews?.length);
  const isLegacyPreview = previewRun && !hasOverlapPreviews;

  useEffect(() => {
    if (!previewRun?.preview.matchPreviews?.length) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(previewRun.preview.matchPreviews.map((p) => previewKey(p))));
  }, [previewRun?.runId, previewRun?.createdAt]);

  const togglePreviewKey = useCallback((key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const selectAllPreviews = useCallback(() => {
    if (!previewRun?.preview.matchPreviews?.length) return;
    setSelectedKeys(new Set(previewRun.preview.matchPreviews.map((p) => previewKey(p))));
  }, [previewRun]);

  const clearPreviewSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const completeGraphPreviews = useMemo((): PairingMatchPreview[] => {
    if (!previewRun) return [];
    if (previewRun.preview.matchPreviews.length > 0) {
      return previewRun.preview.matchPreviews;
    }
    return previewRun.preview.matchesToInsert.map((m, i) => ({
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
  }, [previewRun]);

  const selectedGraphPreviews = useMemo(() => {
    if (!previewRun?.preview.matchPreviews?.length) return [];
    return previewRun.preview.matchPreviews.filter((p) => selectedKeys.has(previewKey(p)));
  }, [previewRun, selectedKeys]);

  const canShowCompleteGraph = completeGraphPreviews.length > 0;
  const canShowSelectedGraph = hasOverlapPreviews && selectedGraphPreviews.length > 0;

  const previewActionLabel = previewRun?.appliedAt
    ? t("previewActions.queueAlreadySaved")
    : isApplying
      ? t("previewActions.saving")
      : hasOverlapPreviews
        ? t("previewActions.saveSelected", { count: selectedKeys.size })
        : t("previewActions.saveQueue");

  // Load data on component mount and when date filters change
  useEffect(() => {
    if (previewRunId) {
      if (typeof window === "undefined") return;
      setLoading(true);
      setError(null);
      try {
        const raw = window.sessionStorage.getItem(`${PREVIEW_RUN_STORAGE_PREFIX}${previewRunId}`);
        if (!raw) {
          setPreviewRun(null);
          setError(t("errors.noPreviewRunForId"));
          setLogs([]);
        } else {
          const parsed = JSON.parse(raw) as StoredPairingRun;
          const normalized: StoredPairingRun = {
            ...parsed,
            preview: normalizePairingWorkflowPreviewPayload(parsed.preview),
          };
          setPreviewRun(normalized);
          setLogs(
            normalized.preview.logs.map((log, index) =>
              mapPreviewPairingLog(
                log as PairingLogSchemaType,
                `${normalized.runId}-${index}`,
                normalized.createdAt,
              ),
            ),
          );
        }
      } catch (err) {
        console.error("Error loading pairing preview logs:", err);
        setPreviewRun(null);
        setError(t("errors.loadSavedPreviewFailed"));
        setLogs([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setPreviewRun(null);
    const loadLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPairingLogs(dateFrom || "", dateTo || "");

        setLogs(data ?? []);
      } catch (err) {
        console.error("Error loading pairing logs:", err);
        setError(t("errors.loadLogsFailed"));
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [dateFrom, dateTo, previewRunId, t]);

  // Filter logs based on current filter settings
  const filteredLogs = logs.filter((log) => {
    if (filterType !== "all" && log.type !== filterType) return false;
    if (!pairingLogMatchesUserType(log, filterUserType)) return false;
    if (filterStatus !== "all" && log.status.toLowerCase() !== filterStatus.toLowerCase())
      return false;

    return true;
  });

  // Calculate statistics from actual data
  const stats = {
    total: logs.length,
    matches: logs.filter((l) => l.type === "pairing-match").length,
    accepted: logs.filter((l) => l.type === "pairing-match-accepted").length,
    rejected: logs.filter((l) => l.type === "pairing-match-rejected").length,
    failed: logs.filter((l) => l.type === "pairing-selection-failed").length,
  };

  // Get unique status values from actual data for filter options
  const uniqueStatuses = Array.from(new Set(logs.map((log) => log.status.toLowerCase())));

  const handleRefresh = async () => {
    if (previewRunId) {
      if (typeof window === "undefined") return;
      const raw = window.sessionStorage.getItem(`${PREVIEW_RUN_STORAGE_PREFIX}${previewRunId}`);
      if (!raw) {
        setError(t("errors.noPreviewRunForId"));
        setLogs([]);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as StoredPairingRun;
        const normalized: StoredPairingRun = {
          ...parsed,
          preview: normalizePairingWorkflowPreviewPayload(parsed.preview),
        };
        setPreviewRun(normalized);
        setError(null);
        setLogs(
          normalized.preview.logs.map((log, index) =>
            mapPreviewPairingLog(
              log as PairingLogSchemaType,
              `${normalized.runId}-${index}`,
              normalized.createdAt,
            ),
          ),
        );
      } catch {
        setError(t("errors.reloadSavedPreviewFailed"));
        setLogs([]);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getPairingLogs(dateFrom, dateTo);
      setLogs(data);
    } catch (err) {
      console.error("Error refreshing pairing logs:", err);
      setError(t("errors.refreshLogsFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreviewRun = async () => {
    if (!previewRun) {
      toast.error(t("toasts.noPreviewLoaded"));
      return;
    }

    if (hasOverlapPreviews && selectedKeys.size === 0) {
      toast.error(t("toasts.selectAtLeastOne"));
      return;
    }

    let matchesToInsert = previewRun.preview.matchesToInsert;
    let logs = previewRun.preview.logs;

    if (hasOverlapPreviews) {
      const previews = previewRun.preview.matchPreviews.filter((p) =>
        selectedKeys.has(previewKey(p)),
      );
      matchesToInsert = previews.map((p) => ({
        student_id: p.student_id,
        tutor_id: p.tutor_id,
        similarity: p.similarity,
      }));
      logs = filterPairingPreviewLogsForKeys(previewRun.preview.logs, selectedKeys);
    }

    setIsApplying(true);
    const promise = axios.post("/api/pairing?debug=1", {
      mode: "apply-preview",
      preview: {
        matchesToInsert,
        logs,
      },
    });

    toast.promise(promise, {
      success: t("toasts.saveSuccess"),
      error: t("toasts.saveError"),
      loading: t("toasts.saving"),
    });

    try {
      await promise;
      if (typeof window !== "undefined") {
        const nextRun: StoredPairingRun = {
          ...previewRun,
          appliedAt: new Date().toISOString(),
        };
        window.sessionStorage.setItem(
          `${PREVIEW_RUN_STORAGE_PREFIX}${nextRun.runId}`,
          JSON.stringify(nextRun),
        );
        setPreviewRun(nextRun);
      }
    } finally {
      setIsApplying(false);
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">{t("loading")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PairingCommitteeGraphDialog
        open={graphScope !== "closed"}
        onOpenChange={(o) => {
          if (!o) setGraphScope("closed");
        }}
        mode="preview"
        previews={
          graphScope === "selected"
            ? selectedGraphPreviews
            : graphScope === "complete"
              ? completeGraphPreviews
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

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                {t("retry")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {previewRun && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {t("previewActions.cardTitle", { runId: previewRun.runId.slice(0, 8) })}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {canShowCompleteGraph && hasOverlapPreviews && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setGraphScope("selected")}
                    disabled={!canShowSelectedGraph}
                    title={!canShowSelectedGraph ? t("previewActions.selectRowHint") : undefined}
                  >
                    <Waypoints className="h-4 w-4 shrink-0" />
                    {t("previewActions.selectedGraph")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setGraphScope("complete")}
                  >
                    <Waypoints className="h-4 w-4 shrink-0" />
                    {t("previewActions.allProposed")}
                  </Button>
                </>
              )}
              {canShowCompleteGraph && !hasOverlapPreviews && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setGraphScope("complete")}
                >
                  <Waypoints className="h-4 w-4 shrink-0" />
                  {t("previewActions.viewProposedGraph")}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleApplyPreviewRun}
                disabled={
                  isApplying ||
                  Boolean(previewRun.appliedAt) ||
                  (hasOverlapPreviews && selectedKeys.size === 0)
                }
              >
                {previewActionLabel}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                {loading ? t("previewActions.refreshing") : t("previewActions.reloadPreview")}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {previewRun && isLegacyPreview && !previewRun.appliedAt && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 text-sm text-amber-900">
            {t("legacyPreviewWarning")}
          </CardContent>
        </Card>
      )}

      {previewRun && hasOverlapPreviews && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{t("overlapBeforeSave.cardTitle")}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllPreviews}
                disabled={Boolean(previewRun.appliedAt)}
              >
                {t("overlapBeforeSave.selectAll")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearPreviewSelection}
                disabled={Boolean(previewRun.appliedAt)}
              >
                {t("overlapBeforeSave.clearAll")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>{t("overlapBeforeSave.student")}</TableHead>
                    <TableHead>{t("overlapBeforeSave.tutor")}</TableHead>
                    <TableHead>{t("overlapBeforeSave.subjects")}</TableHead>
                    <TableHead>{t("overlapBeforeSave.times")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRun.preview.matchPreviews.map((p) => {
                    const key = previewKey(p);
                    return (
                      <TableRow key={key}>
                        <TableCell>
                          <Checkbox
                            checked={selectedKeys.has(key)}
                            disabled={Boolean(previewRun.appliedAt)}
                            onCheckedChange={(v) => togglePreviewKey(key, v === true)}
                            aria-label={t("overlapBeforeSave.selectRowAriaLabel", {
                              name: p.student_name,
                            })}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{p.student_name}</TableCell>
                        <TableCell className="font-medium text-sm">{p.tutor_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {p.overlapping_subjects.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("overlapBeforeSave.none")}
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
                          <div className="flex flex-col gap-1 max-w-[220px]">
                            {p.overlapping_slots.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("overlapBeforeSave.none")}
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden space-y-4">
              {previewRun.preview.matchPreviews.map((p) => {
                const key = previewKey(p);
                return (
                  <MobileCard key={key}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedKeys.has(key)}
                        disabled={Boolean(previewRun.appliedAt)}
                        onCheckedChange={(v) => togglePreviewKey(key, v === true)}
                        aria-label={t("overlapBeforeSave.selectRowAriaLabel", {
                          name: p.student_name,
                        })}
                      />
                      <div className="text-sm">
                        <div className="font-medium">{p.student_name}</div>
                        <div className="text-muted-foreground">
                          {t("overlapBeforeSave.withTutor", { tutorName: p.tutor_name })}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium mb-1">{t("overlapBeforeSave.subjects")}</div>
                      <div className="flex flex-wrap gap-1">
                        {p.overlapping_subjects.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {t("overlapBeforeSave.none")}
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
                      <div className="font-medium mb-1">{t("overlapBeforeSave.times")}</div>
                      <div className="flex flex-col gap-1">
                        {p.overlapping_slots.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {t("overlapBeforeSave.none")}
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
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!previewRun && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("stats.totalEvents")}</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("stats.matchesCreated")}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.matches}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("stats.accepted")}</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.accepted}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("stats.rejected")}</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.rejected}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("stats.failed")}</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.failed}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("filters.cardTitle")}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                  {loading ? t("filters.refreshing") : t("filters.refresh")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("filters.dateFrom")}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="pl-10 w-[180px]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("filters.dateTo")}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="pl-10 w-[180px]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("filters.eventType")}</label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allTypes")}</SelectItem>
                      <SelectItem value="pairing-match">{t("filters.pairingMatch")}</SelectItem>
                      <SelectItem value="pairing-match-accepted">
                        {t("filters.matchAccepted")}
                      </SelectItem>
                      <SelectItem value="pairing-match-rejected">
                        {t("filters.matchRejected")}
                      </SelectItem>
                      <SelectItem value="pairing-selection-failed">
                        {t("filters.selectionFailed")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("filters.userType")}</label>
                  <Select value={filterUserType} onValueChange={setFilterUserType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allUsers")}</SelectItem>
                      <SelectItem value="student">{t("filters.students")}</SelectItem>
                      <SelectItem value="tutor">{t("filters.tutors")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("filters.status")}</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                      {uniqueStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFilterType("all");
                      setFilterUserType("all");
                      setFilterStatus("all");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    {t("filters.clearFilters")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t("table.cardTitle", { count: filteredLogs.length })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.timestamp")}</TableHead>
                      <TableHead>{t("table.type")}</TableHead>
                      <TableHead>{t("table.user")}</TableHead>
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead>{t("table.message")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                          {t("table.loading")}
                        </TableCell>
                      </TableRow>
                    ) : filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {logs.length === 0
                            ? t("table.noLogsFound")
                            : t("table.noLogsMatchFilters")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(log.type)}
                              <span className="capitalize">{log.type.replace(/-/g, " ")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.profile && (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {log.profile.firstName} {log.profile.lastName}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {log.profile.role}
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(log.status)}>{log.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate" title={log.message}>
                              {log.message}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                    {t("table.loading")}
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {logs.length === 0 ? t("table.noLogsFound") : t("table.noLogsMatchFilters")}
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <MobileCard key={log.id}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          {getTypeIcon(log.type)}
                          <span className="capitalize">{log.type.replace(/-/g, " ")}</span>
                        </div>
                        <Badge className={getStatusColor(log.status)}>{log.status}</Badge>
                      </div>
                      <div className="text-sm font-mono text-muted-foreground">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                      </div>
                      {log.profile && (
                        <div className="text-sm">
                          <span className="font-medium">
                            {log.profile.firstName} {log.profile.lastName}
                          </span>{" "}
                          <Badge variant="outline" className="text-xs">
                            {log.profile.role}
                          </Badge>
                        </div>
                      )}
                      <div className="text-sm">{log.message}</div>
                    </MobileCard>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
