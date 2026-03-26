"use client";

import React, { useState, useMemo } from "react";
import { format, parseISO, isPast, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Session } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scrollarea";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionTimespan } from "@/lib/utils";

interface SessionHistoryPanelProps {
  sessions: Session[] | null;
  loading: boolean;
  title: string;
  subtitle?: string;
}

const INITIAL_SHOW = 5;
const LOAD_MORE_COUNT = 10;
const TZ = "America/New_York";

type ResolvedStatus = "Complete" | "Cancelled" | "Rescheduled" | "Uncompleted" | "Upcoming";

function resolveStatus(session: Session): ResolvedStatus {
  if (session.status === "Complete") return "Complete";
  if (session.status === "Cancelled") return "Cancelled";
  if (session.status === "Rescheduled") return "Rescheduled";

  try {
    const zonedDate = toZonedTime(parseISO(session.date), TZ);
    const now = toZonedTime(new Date(), TZ);
    return startOfDay(zonedDate) < startOfDay(now) ? "Uncompleted" : "Upcoming";
  } catch {
    return "Upcoming";
  }
}

const statusStyles: Record<ResolvedStatus, { card: string; badge: string; badgeText: string }> = {
  Complete: {
    card: "border-l-green-500 bg-green-50/40",
    badge: "bg-green-100 text-green-700 border-green-200",
    badgeText: "completed",
  },
  Cancelled: {
    card: "border-l-red-400 bg-red-50/40",
    badge: "bg-red-100 text-red-700 border-red-200",
    badgeText: "cancelled",
  },
  Rescheduled: {
    card: "border-l-amber-400 bg-amber-50/40",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    badgeText: "rescheduled",
  },
  Uncompleted: {
    card: "border-l-orange-400 bg-orange-50/40",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    badgeText: "uncompleted",
  },
  Upcoming: {
    card: "border-l-blue-400 bg-blue-50/40",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    badgeText: "upcoming",
  },
};

export default function SessionHistoryPanel({
  sessions,
  loading,
  title,
  subtitle,
}: SessionHistoryPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_SHOW);

  const counts = useMemo(() => {
    if (!sessions) return { completed: 0, cancelled: 0, uncompleted: 0, upcoming: 0, total: 0 };
    let completed = 0, cancelled = 0, uncompleted = 0, upcoming = 0;
    for (const s of sessions) {
      const rs = resolveStatus(s);
      if (rs === "Complete") completed++;
      else if (rs === "Cancelled") cancelled++;
      else if (rs === "Uncompleted") uncompleted++;
      else if (rs === "Upcoming") upcoming++;
    }
    return { completed, cancelled, uncompleted, upcoming, total: sessions.length };
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400 mb-3" />
        <p className="text-sm text-gray-400">loading...</p>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CalendarDays className="h-6 w-6 text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">no sessions found</p>
      </div>
    );
  }

  const displayedSessions = showAll
    ? sessions.slice(0, visibleCount)
    : sessions.slice(0, INITIAL_SHOW);

  const hasMore = showAll
    ? visibleCount < counts.total
    : INITIAL_SHOW < counts.total;

  const handleShowFullHistory = () => {
    setShowAll(true);
    setVisibleCount(Math.max(INITIAL_SHOW, LOAD_MORE_COUNT));
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, counts.total));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-base font-medium tracking-tight text-gray-800">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 py-2 border-b border-gray-100 text-[12px] font-mono">
        <span><span className="text-green-600 font-medium">{counts.completed}</span> <span className="text-gray-400">completed</span></span>
        <span className="text-gray-200">·</span>
        <span><span className="text-red-500 font-medium">{counts.cancelled}</span> <span className="text-gray-400">cancelled</span></span>
        <span className="text-gray-200">·</span>
        <span><span className="text-orange-500 font-medium">{counts.uncompleted}</span> <span className="text-gray-400">uncompleted</span></span>
        <span className="text-gray-200">·</span>
        <span><span className="text-blue-500 font-medium">{counts.upcoming}</span> <span className="text-gray-400">upcoming</span></span>
      </div>

      <div className="text-[11px] text-gray-400 mb-2">
        showing {displayedSessions.length} of {counts.total}
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="space-y-1.5 pb-4">
          {displayedSessions.map((session) => {
            const resolved = resolveStatus(session);
            const style = statusStyles[resolved];

            let formattedDate = "";
            let timespan = "";
            try {
              const zoned = toZonedTime(parseISO(session.date), TZ);
              formattedDate = format(zoned, "MMM d, yyyy");
              timespan = getSessionTimespan(session.date, session.duration);
            } catch {
              formattedDate = "Invalid date";
            }

            return (
              <div
                key={session.id}
                className={cn(
                  "rounded-md border border-gray-100 border-l-[3px] px-3 py-2.5 transition-colors",
                  style.card,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-800 truncate">
                    {session.tutor?.firstName} {session.tutor?.lastName}
                    <span className="text-gray-300 mx-1.5">/</span>
                    {session.student?.firstName} {session.student?.lastName}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] font-normal shrink-0 py-0 px-1.5", style.badge)}
                  >
                    {style.badgeText}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                  <span className="tabular-nums">{formattedDate}</span>
                  <span className="text-gray-300">·</span>
                  <span>{timespan}</span>
                </div>

                {session.summary && (
                  <p className="text-[11px] text-gray-400 mt-1 truncate">
                    {session.summary}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!showAll && hasMore && (
          <div className="pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShowFullHistory}
              className="w-full text-xs text-gray-500 hover:text-gray-700"
            >
              view full history ({counts.total} sessions)
            </Button>
          </div>
        )}

        {showAll && hasMore && (
          <div className="pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              className="w-full text-xs text-gray-500 hover:text-gray-700 gap-1"
            >
              <ChevronDown className="h-3 w-3" />
              load more
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
