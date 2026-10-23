import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronRight,
  ClipboardX,
  GraduationCap,
  ListOrdered,
  Ticket,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateAdmin } from "@/lib/utils";
import { getAdminDashboardSummary } from "@/lib/actions/admin-dashboard/server.actions";
import {
  TICKET_STATUS_LABELS,
  TICKET_URGENCY_LABELS,
  type TicketStatus,
  type TicketUrgency,
} from "@/constants/tickets";

interface StatCard {
  title: string;
  value: number;
  description: string;
  href: string;
  icon: React.ReactNode;
  /** Highlight the card when there's something to act on. */
  needsAttention: boolean;
}

export default async function AdminHome() {
  const summary = await getAdminDashboardSummary();

  const cards: StatCard[] = [
    {
      title: "Ongoing tickets",
      value: summary.ongoingTickets,
      description:
        summary.highUrgencyTickets > 0
          ? `${summary.highUrgencyTickets} high urgency`
          : "Open or in progress",
      href: "/dashboard/tickets",
      icon: <Ticket className="h-5 w-5" />,
      needsAttention: summary.ongoingTickets > 0,
    },
    {
      title: "Pairing queue",
      value: summary.pairingQueue,
      description: "Requests waiting for a match",
      href: "/dashboard/pairing-que",
      icon: <ListOrdered className="h-5 w-5" />,
      needsAttention: summary.pairingQueue > 0,
    },
    {
      title: "Unlogged sessions",
      value: summary.unloggedSessionsLast7Days,
      description: "Unconfirmed in the last 7 days",
      href: "/dashboard/schedule",
      icon: <ClipboardX className="h-5 w-5" />,
      needsAttention: summary.unloggedSessionsLast7Days > 0,
    },
    ...(summary.tutorsOrientationIncomplete !== null
      ? [
          {
            title: "Orientation incomplete",
            value: summary.tutorsOrientationIncomplete,
            description: "Active tutors still in orientation",
            href: "/dashboard/all-tutors",
            icon: <GraduationCap className="h-5 w-5" />,
            needsAttention: summary.tutorsOrientationIncomplete > 0,
          },
        ]
      : []),
    {
      title: "Sessions this week",
      value: summary.sessionsThisWeek,
      description: "Scheduled, excluding cancelled",
      href: "/dashboard/schedule",
      icon: <CalendarCheck className="h-5 w-5" />,
      needsAttention: false,
    },
  ];

  return (
    <main className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-muted-foreground">What needs attention right now.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="group">
            <Card
              className={cn(
                "h-full transition-colors group-hover:border-blue-400",
                card.needsAttention && "border-amber-300",
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <span
                  className={cn("text-muted-foreground", card.needsAttention && "text-amber-600")}
                >
                  {card.icon}
                </span>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value.toLocaleString()}</div>
                <p className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                  {card.description}
                  <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Recent tickets</CardTitle>
          <Link href="/dashboard/tickets" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {summary.recentTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ongoing tickets.</p>
          ) : (
            <ul className="divide-y">
              {summary.recentTickets.map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateAdmin(ticket.createdAt)} ·{" "}
                      {TICKET_STATUS_LABELS[ticket.status as TicketStatus] ?? ticket.status}
                    </p>
                  </div>
                  {ticket.urgency === "high" ? (
                    <Badge className="shrink-0 bg-red-100 text-red-800 hover:bg-red-100">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {TICKET_URGENCY_LABELS.high.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      {TICKET_URGENCY_LABELS[ticket.urgency as TicketUrgency]?.label ??
                        ticket.urgency}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
