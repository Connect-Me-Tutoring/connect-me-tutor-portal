"use client";

import { useState, useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { EnrollmentActivitySessionRow } from "@/lib/actions/session/server.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Users,
  Calendar,
  Download,
  UserCheck,
  UserX,
  RefreshCw,
  AlertCircle,
  Info,
  Layers,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getParticipationData } from "@/lib/actions/session/server.actions";
import ExcelJS from "exceljs";

interface ParticipantEvent {
  id: string;
  participantId: string;
  name: string;
  email: string;
  action: "joined" | "left";
  timestamp: Date;
  inferred?: boolean;
  joinedBeforeScheduledStart?: boolean;
}

interface ParticipantSummary {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  totalDuration: number; // in minutes
  joinCount: number;
  currentlyInMeeting: boolean;
  firstJoined: Date;
  lastActivity: Date;
  hadInferredJoin?: boolean;
  joinedBeforeScheduledStart?: boolean;
}

function MeetingParticipationInner() {
  const t = useTranslations("profileSessions.participation");
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionID as string;
  const enrollmentIdParam = searchParams.get("enrollmentId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingData, setMeetingData] = useState<{
    sessionId: string;
    enrollmentId: string | null;
    meetingId: string;
    meetingTitle: string;
    startTime: Date;
    endTime: Date | null;
    totalDuration: number;
  } | null>(null);
  const [events, setEvents] = useState<ParticipantEvent[]>([]);
  const [participantSummaries, setParticipantSummaries] = useState<ParticipantSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [enrollmentBreakdown, setEnrollmentBreakdown] = useState<{
    enrollment: {
      id: string;
      summary: string;
      frequency: string;
      studentName: string;
      tutorName: string;
    };
    sessions: EnrollmentActivitySessionRow[];
  } | null>(null);
  const [enrollmentQueryMismatch, setEnrollmentQueryMismatch] = useState(false);

  const fetchParticipationData = async () => {
    try {
      setError(null);
      if (refreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await getParticipationData(sessionId, enrollmentIdParam);

      if (!data) {
        throw new Error(t("errors.sessionNotFound"));
      }

      setEnrollmentBreakdown(data.enrollmentBreakdown ?? null);
      setEnrollmentQueryMismatch(!!data.enrollmentQueryMismatch);

      // Transform session data
      setMeetingData({
        sessionId: data.session.id,
        enrollmentId: data.session.enrollmentId,
        meetingId: data.session.meetingId || "N/A",
        meetingTitle: data.session.meetingTitle || t("defaultMeetingTitle"),
        startTime: new Date(data.session.startTime),
        endTime: data.session.endTime ? new Date(data.session.endTime) : null,
        totalDuration: data.session.totalDuration || 0,
      });

      // Transform events
      const transformedEvents: ParticipantEvent[] = data.events.map((event) => ({
        id: event.id,
        participantId: event.participantId,
        name: event.name,
        email: event.email,
        action: event.action,
        timestamp: new Date(event.timestamp),
        inferred: event.inferred,
        joinedBeforeScheduledStart: event.joinedBeforeScheduledStart,
      }));
      setEvents(transformedEvents);

      // Transform participant summaries
      const transformedSummaries: ParticipantSummary[] = data.participantSummaries.map(
        (summary) => ({
          id: summary.id,
          name: summary.name,
          email: summary.email,
          totalDuration: summary.totalDuration,
          joinCount: summary.joinCount,
          currentlyInMeeting: summary.currentlyInMeeting,
          firstJoined: new Date(summary.firstJoined),
          lastActivity: new Date(summary.lastActivity),
          hadInferredJoin: summary.hadInferredJoin,
          joinedBeforeScheduledStart: summary.joinedBeforeScheduledStart,
        }),
      );
      setParticipantSummaries(transformedSummaries);
    } catch (err) {
      console.error("Error fetching participation data:", err);
      setError(err instanceof Error ? err.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchParticipationData();
    }
  }, [sessionId, enrollmentIdParam]);

  const handleRefresh = () => {
    fetchParticipationData();
  };

  // const handleExport = () => {
  //   console.log("Handle Export")
  // }

  const handleExport = async () => {
    if (!meetingData) return;

    // console.log("participantSummaries", participantSummaries);
    // Calculate average duration
    const calculatedAvgDuration =
      participantSummaries.length > 0
        ? Math.round(
            participantSummaries.reduce((acc, p) => acc + p.totalDuration, 0) /
              participantSummaries.length,
          )
        : 0;

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Meeting Information
    const meetingSheet = workbook.addWorksheet("Meeting Info");
    const meetingInfo = [
      ["Meeting Title", meetingData.meetingTitle],
      ["Meeting ID", meetingData.meetingId],
      ["Start Time", meetingData.startTime.toLocaleString()],
      ["End Time", meetingData.endTime?.toLocaleString() || "Ongoing"],
      ["Total Duration (minutes)", meetingData.totalDuration],
      ["Total Duration (formatted)", formatDuration(meetingData.totalDuration)],
      ["Total Participants", participantSummaries.length],
      ["Currently Active", participantSummaries.filter((p) => p.currentlyInMeeting).length],
      ["Average Duration (minutes)", calculatedAvgDuration],
      ["Average Duration (formatted)", formatDuration(calculatedAvgDuration)],
    ];
    meetingSheet.addRows(meetingInfo);

    // Optional: Style the meeting info sheet
    meetingSheet.getColumn(1).width = 30;
    meetingSheet.getColumn(2).width = 40;
    meetingSheet.getColumn(1).font = { bold: true };

    // Sheet 2: Participant Summary
    const participantSheet = workbook.addWorksheet("Participants");
    const participantData = participantSummaries.map((p) => ({
      Name: p.name,
      Email: p.email,
      "Total Duration (minutes)": p.totalDuration,
      "Total Duration (formatted)": formatDuration(p.totalDuration),
      "Join Count": p.joinCount,
      Status: p.currentlyInMeeting ? "Active" : "Left",
      "First Joined": p.firstJoined.toLocaleString(),
      "Last Activity": p.lastActivity.toLocaleString(),
    }));

    // Add headers
    participantSheet.columns = [
      { header: "Name", key: "Name", width: 20 },
      { header: "Email", key: "Email", width: 30 },
      {
        header: "Total Duration (minutes)",
        key: "Total Duration (minutes)",
        width: 25,
      },
      {
        header: "Total Duration (formatted)",
        key: "Total Duration (formatted)",
        width: 25,
      },
      { header: "Join Count", key: "Join Count", width: 15 },
      { header: "Status", key: "Status", width: 15 },
      { header: "First Joined", key: "First Joined", width: 20 },
      { header: "Last Activity", key: "Last Activity", width: 20 },
    ];

    // Add data rows
    participantSheet.addRows(participantData);

    // Style header row
    participantSheet.getRow(1).font = { bold: true };
    participantSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Sheet 3: Activity Timeline
    const activitySheet = workbook.addWorksheet("Activity Log");
    const activityData = events.map((event) => ({
      Timestamp: event.timestamp.toLocaleString(),
      Time: formatTime(event.timestamp),
      Name: event.name,
      Email: event.email,
      Action: event.action === "joined" ? "Joined" : "Left",
    }));

    // Add headers
    activitySheet.columns = [
      { header: "Timestamp", key: "Timestamp", width: 20 },
      { header: "Time", key: "Time", width: 15 },
      { header: "Name", key: "Name", width: 20 },
      { header: "Email", key: "Email", width: 30 },
      { header: "Action", key: "Action", width: 15 },
    ];

    // Add data rows
    activitySheet.addRows(activityData);

    // Style header row
    activitySheet.getRow(1).font = { bold: true };
    activitySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Generate filename with meeting title and date
    const dateStr = meetingData.startTime.toISOString().split("T")[0];
    const filename = `Participation_Report_${meetingData.meetingTitle.replace(/[^a-z0-9]/gi, "_")}_${dateStr}.xlsx`;

    // Write and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
    //   // Create workbook
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading && !meetingData) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !meetingData) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <div>
                <h3 className="font-semibold">{t("errorCard.title")}</h3>
                <p className="text-sm text-muted-foreground">
                  {error || t("errors.loadFailed")}
                </p>
              </div>
            </div>
            <Button onClick={handleRefresh} variant="outline" className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("errorCard.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avgDuration =
    participantSummaries.length > 0
      ? Math.round(
          participantSummaries.reduce((acc, p) => acc + p.totalDuration, 0) /
            participantSummaries.length,
        )
      : 0;

  const showNormalizationCallout =
    participantSummaries.some((p) => p.hadInferredJoin || p.joinedBeforeScheduledStart) ||
    events.some((e) => e.inferred || e.joinedBeforeScheduledStart);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Meeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{meetingData.meetingTitle}</h1>
          <p className="text-muted-foreground mt-1">
            {t("header.meetingId", { id: meetingData.meetingId })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {t("header.refresh")}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExport}
            disabled={!meetingData || events.length === 0}
          >
            <Download className="w-4 h-4" />
            {t("header.exportReport")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {meetingData.enrollmentId ? (
          <>
            <Button variant="link" className="h-auto p-0 gap-1" asChild>
              <Link href={`/dashboard/enrollments/${meetingData.enrollmentId}/activity`}>
                <Layers className="h-4 w-4 shrink-0" />
                {t("enrollment.activityLink")}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </Link>
            </Button>
            {!enrollmentIdParam && (
              <Button variant="link" className="h-auto p-0 text-muted-foreground" asChild>
                <Link
                  href={`/dashboard/session/${meetingData.sessionId}/participation?enrollmentId=${meetingData.enrollmentId}`}
                >
                  {t("enrollment.showSessionList")}
                </Link>
              </Button>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">{t("enrollment.notLinked")}</span>
        )}
      </div>

      {enrollmentQueryMismatch && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("enrollmentMismatch.title")}</AlertTitle>
          <AlertDescription>
            {t.rich("enrollmentMismatch.description", {
              code: (chunks) => <code className="text-xs">{chunks}</code>,
            })}
          </AlertDescription>
        </Alert>
      )}

      {enrollmentBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>{t("enrollmentContext.title")}</CardTitle>
            <CardDescription>
              {enrollmentBreakdown.enrollment.studentName} ↔{" "}
              {enrollmentBreakdown.enrollment.tutorName} · {t("enrollmentContext.frequency")}{" "}
              <Badge variant="secondary" className="font-normal">
                {enrollmentBreakdown.enrollment.frequency}
              </Badge>
              {enrollmentBreakdown.enrollment.summary ? (
                <span className="block mt-2 text-muted-foreground">
                  {enrollmentBreakdown.enrollment.summary}
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t("enrollmentContext.description")}
            </p>
            <div className="rounded-md border max-h-72 overflow-y-auto divide-y">
              {enrollmentBreakdown.sessions.map((s) => {
                const isCurrent = s.id === meetingData.sessionId;
                return (
                  <div
                    key={s.id}
                    className={`flex flex-wrap items-center justify-between gap-2 p-3 text-sm ${
                      isCurrent ? "bg-muted/60" : ""
                    }`}
                  >
                    <div>
                      <div className="font-medium">
                        {s.date
                          ? new Date(s.date).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                        {isCurrent && (
                          <Badge className="ml-2 align-middle">
                            {t("enrollmentContext.thisSession")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground text-xs mt-0.5">
                        {s.meetingTitle} · {s.status || "—"} ·{" "}
                        {t("enrollmentContext.zoomEvents", { count: s.zoomEventCount })}
                      </div>
                    </div>
                    {!isCurrent ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/dashboard/session/${s.id}/participation?enrollmentId=${enrollmentBreakdown.enrollment.id}`}
                        >
                          {t("enrollmentContext.open")}
                        </Link>
                      </Button>
                    ) : (
                      <Badge variant="outline">{t("enrollmentContext.viewing")}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {showNormalizationCallout && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t("normalization.title")}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {t("normalization.description")}
          </AlertDescription>
        </Alert>
      )}

      {/* Meeting Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">{t("stats.duration")}</div>
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatDuration(meetingData.totalDuration)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">{t("stats.totalParticipants")}</div>
            </div>
            <div className="text-2xl font-bold mt-1">{participantSummaries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">{t("stats.currentlyActive")}</div>
            </div>
            <div className="text-2xl font-bold mt-1">
              {participantSummaries.filter((p) => p.currentlyInMeeting).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">{t("stats.avgDuration")}</div>
            </div>
            <div className="text-2xl font-bold mt-1">{formatDuration(avgDuration)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Participant Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t("participantSummary.title")}</CardTitle>
            <CardDescription>{t("participantSummary.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {participantSummaries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t("participantSummary.empty")}
              </p>
            ) : (
              participantSummaries.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={participant.avatar || "/placeholder.svg"}
                        alt={participant.name}
                      />
                      <AvatarFallback>
                        {participant.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{participant.name}</div>
                      <div className="text-sm text-muted-foreground">{participant.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Badge variant={participant.currentlyInMeeting ? "default" : "secondary"}>
                        {participant.currentlyInMeeting ? t("status.active") : t("status.left")}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatDuration(participant.totalDuration)} •{" "}
                      {t("participantSummary.joinsCount", { count: participant.joinCount })}
                    </div>
                    {(participant.hadInferredJoin || participant.joinedBeforeScheduledStart) && (
                      <div className="flex flex-wrap gap-1 justify-end mt-2">
                        {participant.hadInferredJoin && (
                          <Badge variant="outline" className="text-xs font-normal">
                            {t("participantSummary.estimatedJoin")}
                          </Badge>
                        )}
                        {participant.joinedBeforeScheduledStart && (
                          <Badge variant="outline" className="text-xs font-normal">
                            {t("participantSummary.earlyJoin")}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>{t("activityTimeline.title")}</CardTitle>
            <CardDescription>{t("activityTimeline.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t("activityTimeline.empty")}
                </p>
              ) : (
                events.map((event, index) => (
                  <div key={event.id}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${event.action === "joined" ? "bg-green-500" : "bg-red-500"}`}
                      />
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {event.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{event.name}</span>
                          <Badge
                            variant={event.action === "joined" ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {event.action === "joined" ? (
                              <>
                                <UserCheck className="w-3 h-3 mr-1" /> {t("status.joined")}
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3 mr-1" /> {t("status.left")}
                              </>
                            )}
                          </Badge>
                          {event.inferred && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {t("activityTimeline.estimated")}
                            </Badge>
                          )}
                          {event.joinedBeforeScheduledStart && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {t("activityTimeline.beforeStart")}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {event.timestamp.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {meetingData &&
                            event.action === "joined" &&
                            event.timestamp < meetingData.startTime && (
                              <span className="block text-xs mt-0.5">
                                {t("activityTimeline.beforeScheduledStart", {
                                  time: formatTime(meetingData.startTime),
                                })}
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                    {index < events.length - 1 && <Separator className="ml-6 mt-3" />}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MeetingParticipation() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      }
    >
      <MeetingParticipationInner />
    </Suspense>
  );
}
