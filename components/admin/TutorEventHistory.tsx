"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Constants } from "@/types/database.types";
import type { TutorEventHistory as TutorEventHistoryData } from "@/lib/actions/event/server.actions";

const EVENT_TYPES = Constants.public.Enums.event_type;
const ALL_TYPES = "all";

// Event dates are saved from a date picker as bare yyyy-MM-dd, which Postgres stores as UTC
// midnight; keep the UTC calendar day so they don't shift a day back in US timezones.
const toDay = (iso: string) => iso.slice(0, 10);
const formatDay = (day: string) => (day ? format(parseISO(day), "MMM d, yyyy") : "—");
const formatTimestamp = (iso: string) => (iso ? format(parseISO(iso), "MMM d, yyyy") : "—");
const formatHours = (hours: number) => Number(hours.toFixed(2)).toString();

export default function TutorEventHistory({ tutor, events }: TutorEventHistoryData) {
  const [type, setType] = useState<string>(ALL_TYPES);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      if (type !== ALL_TYPES && event.type !== type) return false;
      const day = toDay(event.date);
      if (from && (!day || day < from)) return false;
      if (to && (!day || day > to)) return false;
      if (query && !event.summary.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [events, type, from, to, search]);

  const hoursByType = useMemo(() => {
    const totals = Object.fromEntries(EVENT_TYPES.map((t) => [t, 0])) as Record<string, number>;
    for (const event of filtered) totals[event.type] = (totals[event.type] ?? 0) + event.hours;
    return totals;
  }, [filtered]);

  const totalHours = filtered.reduce((sum, event) => sum + event.hours, 0);
  const isFiltered = type !== ALL_TYPES || from || to || search;

  const clearFilters = () => {
    setType(ALL_TYPES);
    setFrom("");
    setTo("");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/hours-manager"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Hours Manager
        </Link>
        <h1 className="text-3xl font-bold mt-2">
          {tutor.firstName} {tutor.lastName}
        </h1>
        <p className="text-gray-600">{tutor.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isFiltered ? "Filtered Event Hours" : "All-Time Event Hours"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[#1e40af]">{formatHours(totalHours)}</div>
              <div className="text-sm text-gray-600">Total Hours</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1e40af]">{filtered.length}</div>
              <div className="text-sm text-gray-600">Events</div>
            </div>
            {EVENT_TYPES.map((t) => (
              <div key={t}>
                <div className="text-2xl font-bold text-[#1e40af]">
                  {formatHours(hoursByType[t] ?? 0)}
                </div>
                <div className="text-sm text-gray-600">{t}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="text-sm text-gray-600">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All types</SelectItem>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-600">From</label>
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">To</label>
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="text-sm text-gray-600">Summary</label>
              <Input
                placeholder="Search summaries"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isFiltered && (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-gray-600">
              {events.length === 0
                ? "This tutor has no events yet."
                : "No events match these filters."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Logged On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDay(toDay(event.date))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {event.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{event.summary || "—"}</TableCell>
                    <TableCell className="text-right">{formatHours(event.hours)}</TableCell>
                    <TableCell className="whitespace-nowrap text-gray-600">
                      {formatTimestamp(event.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatHours(totalHours)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
