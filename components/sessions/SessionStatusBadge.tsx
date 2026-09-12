import { CircleAlert, CircleCheckBig, CircleX, Clock } from "lucide-react";
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
    <span
      className={cn(
        "px-3 py-1 inline-flex items-center rounded-full border",
        style.className,
        className,
      )}
    >
      <Icon size={14} className="mr-1" />
      {style.label}
    </span>
  );
}
