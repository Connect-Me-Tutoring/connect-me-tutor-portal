import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Card styling for the mobile (md:hidden) row-as-card layout, shared across list views. */
export function MobileCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-white rounded-xl shadow p-4 space-y-3 border", className)} {...props} />
  );
}
