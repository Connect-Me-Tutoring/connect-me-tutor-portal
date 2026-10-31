import { CircleAlert, CircleCheckBig, CircleX, Clock, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Session } from "@/types";

type Status = Session["status"];

const STATUS_STYLES: Partial<
  Record<Status, { label: string; className: string; icon: typeof Clock }>
> = {
  Active: {
    label: "Active",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Clock,
  },
  Complete: {
    label: "Complete",
    className: "bg-green-100 text-green-800 border-green-200",
    icon: CircleCheckBig,
  },
  Cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 border-red-200",
    icon: CircleX,
  },
  "Student Did Not Attend": {
    label: "No-show",
    className: "bg-orange-100 text-orange-800 border-orange-200",
    icon: UserX,
  },
  Unconfirmed: {
    label: "Unconfirmed",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: CircleAlert,
  },
};

/** Renders nothing for statuses without a badge treatment (e.g. Rescheduled). */
export function SessionStatusBadge({ status, className }: { status: Status; className?: string }) {
  const style = STATUS_STYLES[status];
  if (!style) return null;

  const Icon = style.icon;

  return (
    // outline: no hover tint, since the badge isn't clickable. Padding, inherited text size
    // and normal weight keep the original pill size instead of Badge's smaller text-xs/semibold default.
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-3 py-1 text-[length:inherit] font-normal",
        style.className,
        className,
      )}
    >
      <Icon size={14} />
      {style.label}
    </Badge>
  );
}
