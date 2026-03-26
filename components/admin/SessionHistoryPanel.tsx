"use client";

import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Session } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scrollarea";
import { Loader2, CalendarDays, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionTimespan } from "@/lib/utils";

interface SessionHistoryPanelProps {
  sessions: Session[] | null;
  loading: boolean;
  title: string;
  subtitle?: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  Complete: {
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
  },
  Cancelled: {
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: <XCircle className="h-4 w-4 text-red-600" />,
  },
  Active: {
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: <Clock className="h-4 w-4 text-blue-600" />,
  },
  Rescheduled: {
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: <CalendarDays className="h-4 w-4 text-amber-600" />,
  },
};

const getStatusStyle = (status: string) => {
  return statusConfig[status] || statusConfig["Active"];
};

export default function SessionHistoryPanel({
  sessions,
  loading,
  title,
  subtitle,
}: SessionHistoryPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500">Loading session history...</p>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CalendarDays className="h-8 w-8 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No sessions found</p>
      </div>
    );
  }

  const completedCount = sessions.filter((s) => s.status === "Complete").length;
  const cancelledCount = sessions.filter((s) => s.status === "Cancelled").length;
  const activeCount = sessions.filter((s) => s.status === "Active").length;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 rounded-lg bg-green-50 border border-green-200 p-3 text-center">
          <p className="text-xl font-bold text-green-700">{completedCount}</p>
          <p className="text-xs text-green-600">Completed</p>
        </div>

        <div className="flex-1 rounded-lg bg-red-50 border border-red-200 p-3 text-center">
          <p className="text-xl font-bold text-red-700">{cancelledCount}</p>
          <p className="text-xs text-red-600">Cancelled</p>
        </div>

        <div className="flex-1 rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
          <p className="text-xl font-bold text-blue-700">{activeCount}</p>
          <p className="text-xs text-blue-600">Upcoming</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-2">
        {sessions.length} total session{sessions.length !== 1 ? "s" : ""}
      </p>

      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="space-y-2 pb-4">
          {sessions.map((session) => {
            const style = getStatusStyle(session.status);

            let formattedDate = "";
            let timespan = "";
            try {
              const zoned = toZonedTime(parseISO(session.date), "America/New_York");
              formattedDate = format(zoned, "MMM d, yyyy");
              timespan = getSessionTimespan(session.date, session.duration);
            } catch {
              formattedDate = "Invalid date";
            }

            return (
              <div
                key={session.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  style.bg,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {style.icon}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {formattedDate}
                      </p>
                      <p className="text-xs text-gray-500">{timespan}</p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={cn("text-[10px] shrink-0", style.color)}
                  >
                    {session.status}
                  </Badge>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-gray-600">
                  <div>
                    <span className="text-gray-400">Tutor: </span>
                    {session.tutor?.firstName} {session.tutor?.lastName}
                  </div>
                  <div>
                    <span className="text-gray-400">Student: </span>
                    {session.student?.firstName} {session.student?.lastName}
                  </div>
                </div>

                {session.summary && (
                  <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">
                    {session.summary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
