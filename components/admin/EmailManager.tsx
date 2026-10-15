"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast, { Toaster } from "react-hot-toast";
import { getEmailLogs } from "@/lib/actions/email/server.actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { Loader2, RefreshCw, Search, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { Database } from "@/types/database.types";

type EmailRow = Omit<Database["public"]["Tables"]["emails"]["Row"], "id">;

const EmailManager = () => {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const data = await getEmailLogs();
      setEmails(data);
    } catch (error) {
      console.error("Error fetching email logs:", error);
      toast.error("Failed to load email logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const filteredEmails = useMemo(() => {
    if (!searchTerm.trim()) return emails;
    const term = searchTerm.toLowerCase();
    return emails.filter(
      (email) =>
        email.recipient_email?.toLowerCase().includes(term) ||
        email.subject?.toLowerCase().includes(term) ||
        email.content?.toLowerCase().includes(term),
    );
  }, [emails, searchTerm]);

  const totalPages = Math.ceil(filteredEmails.length / pageSize) || 1;
  const paginatedEmails = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmails.slice(start, start + pageSize);
  }, [filteredEmails, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

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
              View and manage log records from the emails table.
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
              placeholder="Search recipient, subject, content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 self-end sm:self-auto">
            <span>Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => setPageSize(Number(val))}
            >
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
          ) : paginatedEmails.length === 0 ? (
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
                  <TableHead className="w-[220px]">Recipient Email</TableHead>
                  <TableHead className="w-[250px]">Subject</TableHead>
                  <TableHead>Content</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmails.map((email, idx) => (
                  <TableRow key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <TableCell className="text-xs font-mono text-gray-600 whitespace-nowrap">
                      {formatDate(email.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 truncate max-w-[220px]">
                      {email.recipient_email}
                    </TableCell>
                    <TableCell className="text-gray-700 max-w-[250px] truncate">
                      {email.subject || <span className="text-gray-400 italic">No subject</span>}
                    </TableCell>
                    <TableCell className="max-w-md">
                      {email.content ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="truncate cursor-pointer text-gray-600 hover:text-connect-me-blue-5 hover:underline text-sm">
                              {email.content}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 max-h-80 overflow-y-auto p-4 shadow-md">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Email Content Preview
                              </p>
                              <div className="text-sm whitespace-pre-wrap text-gray-800 border-t pt-2">
                                {email.content}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-gray-400 italic text-xs">No content</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Footer */}
          {!loading && filteredEmails.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50/50 text-sm text-gray-500">
              <div>
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredEmails.length)} to{" "}
                {Math.min(currentPage * pageSize, filteredEmails.length)} of {filteredEmails.length} entries
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
    </>
  );
};

export default EmailManager;
