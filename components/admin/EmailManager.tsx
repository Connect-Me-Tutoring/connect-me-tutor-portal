"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import toast, { Toaster } from "react-hot-toast";
import { Client } from "@upstash/qstash";
import { fetchScheduledMessages } from "@/lib/actions/email.server.actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Mock data for email logs with temp datetime
const mockEmails = [
  {
    id: "1",
    sendDate: new Date().toISOString(),
    recipient: "student@example.com",
    subject: "Session Reminder",
    content: "Don't forget your session tomorrow at 3 PM.",
    status: "Sent",
  },
  {
    id: "2",
    sendDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    recipient: "tutor@example.com",
    subject: "New Enrollment",
    content: "You have a new student enrolled in your Math class.",
    status: "Scheduled",
  },
  {
    id: "3",
    sendDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    recipient: "admin@example.com",
    subject: "Weekly Report",
    content: "Here is the weekly summary of sessions.",
    status: "UnScheduled",
  },
  {
    id: "3",
    sendDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    recipient: "admin@example.com",
    subject: "Weekly Report",
    content:
      "This content aims to go out of bounds to test if the bounds can truncate or not.",
    status: "UnScheduled",
  },
];

const EmailManager = () => {
  const [emails] = useState(mockEmails);

  const sendEmail = async () => {
    try {
      const now = new Date();
      const response = await fetch(
        "/api/admin/email/before-sessions/schedule-reminders-weekly",
      );
      if (!response.ok) throw new Error(response.statusText);
    } catch (error) {
      console.error(error);
    }
  };

  const listScheduledMessages = async () => {
    try {
      const data = await fetchScheduledMessages();
    } catch (error) {
      console.error("Error listing messages:", error);
      toast.error("Failed to fetch schedules");
    }
  };

  return (
    <>
      <Toaster />

      <main className="p-8">
        <h1 className="text-3xl font-bold mb-6">Email Manager</h1>

        <div className="flex gap-4 mb-6">
          <Button onClick={() => sendEmail()}>Send Email</Button>
          <Button onClick={() => listScheduledMessages()}>
            Show schedules
          </Button>
        </div>

        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Send Date</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>
                    {new Date(email.sendDate).toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {email.recipient}
                  </TableCell>
                  <TableCell>{email.subject}</TableCell>
                  <TableCell className="max-w-xs">
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="truncate cursor-pointer hover:underline">
                          {email.content}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-4">
                        <p className="text-sm">{email.content}</p>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>{email.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </>
  );
};

export default EmailManager;
