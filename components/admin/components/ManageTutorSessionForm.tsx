"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTutorSessions } from "@/lib/actions/tutor/actions";
import { updateSessionsStatus } from "@/lib/actions/session/server.actions";
import { Profile, Session } from "@/types";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";

export default function ManageTutorSessions({ tutors }: { tutors: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [selectedTutorId, setSelectedTutorId] = useState<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchSessions = async (tutorId: string) => {
    setLoading(true);
    try {
      const data = await getTutorSessions(tutorId);
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedTutorId("");
      setSessions([]);
      setSelectedIds([]);
    }
  }, [open]);

  useEffect(() => {
    if (selectedTutorId) {
      fetchSessions(selectedTutorId);
      setSelectedIds([]);
    } else {
      setSessions([]);
      setSelectedIds([]);
    }
  }, [selectedTutorId]);

  const toggleSession = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id],
    );
  };

  const handleUpdate = async (status: "Cancelled" | "Complete") => {
    if (selectedIds.length === 0 || !selectedTutorId) return;
    setLoading(true);
    try {
      await updateSessionsStatus(selectedIds, status);
      toast.success(`Marked ${selectedIds.length} session(s) as ${status}`);
      setSelectedIds([]);
      await fetchSessions(selectedTutorId);
    } catch (error) {
      toast.error(`Failed to update sessions`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-connect-me-blue-5">Manage Sessions</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Tutor Sessions</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Combobox
            list={tutors.map((tutor) => ({
              value: tutor.id,
              label: `${tutor.firstName} ${tutor.lastName} - ${tutor.email}`,
            }))}
            category="tutor"
            onValueChange={(value) => setSelectedTutorId(value)}
          />
        </div>

        {selectedTutorId && (
          <>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={sessions.length > 0 && selectedIds.length === sessions.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds(sessions.map((s) => s.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          No sessions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(session.id)}
                              onCheckedChange={() => toggleSession(session.id)}
                            />
                          </TableCell>
                          <TableCell>
                            {format(parseISO(session.date), "MMM d, yyyy h:mm a")}
                          </TableCell>
                          <TableCell>
                            {session.student?.firstName} {session.student?.lastName}
                          </TableCell>
                          <TableCell>{session.status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-500">{selectedIds.length} selected</div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleUpdate("Cancelled")}
                  disabled={selectedIds.length === 0 || loading}
                >
                  Mark Cancelled
                </Button>
                <Button
                  onClick={() => handleUpdate("Complete")}
                  disabled={selectedIds.length === 0 || loading}
                  className="bg-connect-me-blue-2"
                >
                  Mark Complete
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
