"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn, formatDateAdmin } from "@/lib/utils";
import { updateTicketStatus } from "@/lib/actions/ticket/server.actions";
import {
  ONGOING_TICKET_STATUSES,
  TICKET_CATEGORY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_URGENCY_LABELS,
  type Ticket,
  type TicketStatus,
  type TicketUrgency,
} from "@/constants/tickets";

type StatusFilter = "ongoing" | "all" | TicketStatus;

const URGENCY_STYLES: Record<TicketUrgency, string> = {
  high: "bg-red-100 text-red-800 hover:bg-red-100",
  medium: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  low: "bg-slate-100 text-slate-700 hover:bg-slate-100",
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  in_progress: "bg-violet-100 text-violet-800 hover:bg-violet-100",
  resolved: "bg-green-100 text-green-800 hover:bg-green-100",
  closed: "bg-slate-100 text-slate-600 hover:bg-slate-100",
};

const URGENCY_RANK: Record<TicketUrgency, number> = { high: 0, medium: 1, low: 2 };

function submitterName(ticket: Ticket) {
  if (!ticket.submitter) return "Unknown user";
  return `${ticket.submitter.firstName} ${ticket.submitter.lastName}`.trim();
}

export default function TicketList({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ongoing");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const visibleTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets
      .filter((ticket) => {
        if (statusFilter === "ongoing") return ONGOING_TICKET_STATUSES.includes(ticket.status);
        if (statusFilter === "all") return true;
        return ticket.status === statusFilter;
      })
      .filter((ticket) => {
        if (!query) return true;
        return [ticket.subject, ticket.description, submitterName(ticket), ticket.contactEmail]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        // Ongoing work is triaged by urgency first; everything else stays newest first.
        if (statusFilter === "ongoing" && a.urgency !== b.urgency) {
          return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [tickets, statusFilter, search]);

  const ongoingCount = tickets.filter((t) => ONGOING_TICKET_STATUSES.includes(t.status)).length;
  const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;

  const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
    const previous = tickets;
    setUpdatingId(ticketId);
    setTickets((current) => current.map((t) => (t.id === ticketId ? { ...t, status } : t)));
    try {
      await updateTicketStatus(ticketId, status);
      toast.success(`Ticket marked ${TICKET_STATUS_LABELS[status].toLowerCase()}`);
    } catch (error) {
      console.error("Failed to update ticket status:", error);
      setTickets(previous);
      toast.error("Failed to update ticket status");
    } finally {
      setUpdatingId(null);
    }
  };

  const statusSelect = (ticket: Ticket) => (
    <Select
      value={ticket.status}
      onValueChange={(value) => handleStatusChange(ticket.id, value as TicketStatus)}
      disabled={updatingId === ticket.id}
    >
      <SelectTrigger className="h-8 w-[140px]" onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TICKET_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {TICKET_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {ongoingCount} ongoing {ongoingCount === 1 ? "ticket" : "tickets"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Search subject, description, or submitter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-72"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              {TICKET_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {TICKET_STATUS_LABELS[status]}
                </SelectItem>
              ))}
              <SelectItem value="all">All tickets</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submitted</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No tickets match these filters.
                </TableCell>
              </TableRow>
            ) : (
              visibleTickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(ticket.id)}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateAdmin(ticket.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate font-medium">
                    {ticket.subject}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {submitterName(ticket)}
                    {ticket.submitter?.role && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({ticket.submitter.role})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {TICKET_CATEGORY_LABELS[ticket.category]}
                  </TableCell>
                  <TableCell>
                    <Badge className={URGENCY_STYLES[ticket.urgency]}>
                      {TICKET_URGENCY_LABELS[ticket.urgency].label}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>{statusSelect(ticket)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{selectedTicket.subject}</DialogTitle>
                <DialogDescription>
                  Submitted {formatDateAdmin(selectedTicket.createdAt)} · Ref{" "}
                  {selectedTicket.id.slice(0, 8)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge className={URGENCY_STYLES[selectedTicket.urgency]}>
                  {TICKET_URGENCY_LABELS[selectedTicket.urgency].label} urgency
                </Badge>
                <Badge className={STATUS_STYLES[selectedTicket.status]}>
                  {TICKET_STATUS_LABELS[selectedTicket.status]}
                </Badge>
              </div>

              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Submitter</dt>
                <dd>
                  {submitterName(selectedTicket)}
                  {selectedTicket.submitter?.role && ` (${selectedTicket.submitter.role})`}
                </dd>
                <dt className="text-muted-foreground">Contact</dt>
                <dd>
                  {selectedTicket.contactEmail ? (
                    <a
                      href={`mailto:${selectedTicket.contactEmail}`}
                      className="text-blue-600 underline"
                    >
                      {selectedTicket.contactEmail}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt className="text-muted-foreground">Category</dt>
                <dd>{TICKET_CATEGORY_LABELS[selectedTicket.category]}</dd>
                <dt className="text-muted-foreground">Page</dt>
                <dd className="break-all">{selectedTicket.pageUrl || "—"}</dd>
              </dl>

              <div>
                <p className="mb-1 text-sm text-muted-foreground">Description</p>
                <p
                  className={cn(
                    "whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm",
                    "break-words",
                  )}
                >
                  {selectedTicket.description}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Status</span>
                {statusSelect(selectedTicket)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
