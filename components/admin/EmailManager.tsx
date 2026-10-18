"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast, { Toaster } from "react-hot-toast";
import {
  getEmailLogContent,
  getEmailLogs,
  type EmailLogRow,
} from "@/lib/actions/email/server.actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { format, parseISO } from "date-fns";
import { Loader2, RefreshCw, Search, Mail, ChevronLeft, ChevronRight } from "lucide-react";

const SEARCH_DEBOUNCE_MS = 300;

const EmailManager = () => {
  const [emails, setEmails] = useState<EmailLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const latestRequestIdRef = useRef(0);

  const [previewEmail, setPreviewEmail] = useState<EmailLogRow | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadEmails = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    try {
      const { rows, total } = await getEmailLogs({
        page: currentPage,
        pageSize,
        search: searchTerm,
      });
      if (requestId !== latestRequestIdRef.current) return;
      setEmails(rows);
      setTotal(total);
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) return;
      console.error("Error fetching email logs:", error);
      toast.error("Failed to load email logs");
    } finally {
      if (requestId === latestRequestIdRef.current) setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const openPreview = async (email: EmailLogRow) => {
    setPreviewEmail(email);
    setPreviewHtml(null);
    setPreviewLoading(true);
    try {
      setPreviewHtml(await getEmailLogContent(email.id));
    } catch (error) {
      console.error("Error fetching email content:", error);
      toast.error("Failed to load email content");
    } finally {
      setPreviewLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d, yyyy h:mm a");
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Toaster />
      <main className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Mail className="h-8 w-8 text-connect-me-blue-5" />
              Email Manager
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Emails the portal sent successfully through Resend. Failed sends and CC recipients
              aren&apos;t logged.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadEmails}
              disabled={loading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Logs
            </Button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search recipient or subject..."
              value={searchInput}
              maxLength={200}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 self-end sm:self-auto">
            <span>Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Email Logs Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-connect-me-blue-5 mb-2" />
              <p className="text-sm">Loading email logs...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">No email logs found</p>
              <p className="text-xs text-gray-500 mt-1">
                {searchTerm
                  ? "Try searching for a different keyword."
                  : "There are no entries in the emails table."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[180px]">Created At</TableHead>
                  <TableHead className="w-[260px]">Recipient Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[110px] text-right">Content</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow key={email.id} className="hover:bg-gray-50/60 transition-colors">
                    <TableCell className="text-xs font-mono text-gray-600 whitespace-nowrap">
                      {formatDate(email.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 truncate max-w-[260px]">
                      {email.recipient_email}
                    </TableCell>
                    <TableCell className="text-gray-700 max-w-md truncate">
                      {email.subject || <span className="text-gray-400 italic">No subject</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openPreview(email)}>
                        Preview
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Footer */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50/50 text-sm text-gray-500">
              <div>
                Showing {Math.min((currentPage - 1) * pageSize + 1, total)} to{" "}
                {Math.min(currentPage * pageSize, total)} of {total} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={previewEmail !== null} onOpenChange={(open) => !open && setPreviewEmail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="truncate">{previewEmail?.subject || "No subject"}</DialogTitle>
            <DialogDescription>
              To {previewEmail?.recipient_email}
              {previewEmail && ` · ${formatDate(previewEmail.created_at)}`}
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex h-[60vh] items-center justify-center text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin text-connect-me-blue-5" />
            </div>
          ) : previewHtml ? (
            // Stored emails can include text users wrote (e.g. chat previews), so they are
            // rendered in a fully sandboxed frame: no scripts, no same-origin access.
            <iframe
              title="Email content preview"
              sandbox=""
              srcDoc={previewHtml}
              className="h-[60vh] w-full rounded border bg-white"
            />
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">No content</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailManager;
