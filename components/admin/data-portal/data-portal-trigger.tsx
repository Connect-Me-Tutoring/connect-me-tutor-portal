"use client";

import { useState } from "react";
import { Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DataPortalWorkspace, type WorkspaceMessage } from "./data-portal-workspace";

/**
 * Sidebar entry for the data portal: a click opens the analysis workspace in
 * a side panel instead of navigating away.
 *
 * Rendering this inside the admin-only nav block is presentation, not
 * enforcement — /api/admin/data-portal re-checks the caller's session and
 * active-profile role on every request, so the panel without the role is just
 * a panel that answers 403.
 *
 * Conversation state lives here rather than in the workspace so an accidental
 * close (Escape, a click on the overlay) does not erase the session; the
 * panel reopens where the analyst left off.
 */
export function DataPortalTrigger({ isOpen }: { isOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [dateRange, setDateRange] = useState("last-90-days");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start",
                open
                  ? "bg-blue-400/10 text-blue-500"
                  : "text-primary-dark hover:bg-muted hover:text-foreground",
                !isOpen && "justify-center px-2",
              )}
            >
              <Database className="h-5 w-5" />
              {isOpen && <span className="ml-3">Data Portal</span>}
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        {!isOpen && (
          <TooltipContent side="right">
            <p>Data Portal</p>
          </TooltipContent>
        )}
      </Tooltip>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>Data Portal</SheetTitle>
          <SheetDescription>
            Read-only analyses over Connect Me&apos;s operational data.
          </SheetDescription>
        </SheetHeader>
        <DataPortalWorkspace
          messages={messages}
          onMessagesChange={setMessages}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </SheetContent>
    </Sheet>
  );
}
