"use client";
import React, { useState, useEffect, use } from "react";
import { Input } from "@/components/ui/input";
import ActiveSessionsTable from "../components/ActiveSessionsTable";
import CurrentSessionsTable from "../components/CurrentSessionsTable";
import CompletedSessionsTable from "../components/CompletedSessionsTable";
import { updateSession } from "@/lib/actions/admin.actions";
import { undoCancelSession } from "@/lib/actions/tutor.actions";
import { rescheduleSession } from "@/lib/actions/session.server.actions";
import { Session, Profile, Meeting } from "@/types";
import toast from "react-hot-toast";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";
import { undoSessionExitForm } from "@/lib/actions/tutor.actions";
import { getSessionTimePassed } from "@/lib/actions/session.actions";
import {
  sendSessionRescheduleEmail,
  updateScheduledEmailBeforeSessions,
} from "@/lib/actions/email.server.actions";
import { StudentAnnouncementsRoomId } from "@/constants/chat";
import { format } from "date-fns";

const TutorDashboard = () => {
  const TC = useDashboardContext();

  useEffect(() => {
    const filtered = TC.sessions.filter(
      (session) =>
        session.student?.firstName
          .toLowerCase()
          .includes(TC.filterValueActiveSessions.toLowerCase()) ||
        session.student?.lastName
          .toLowerCase()
          .includes(TC.filterValueActiveSessions.toLowerCase()),
    );
    TC.setFilteredSessions(filtered);
    TC.setCurrentPage(1);
  }, [TC.filterValueActiveSessions, TC.sessions]);

  useEffect(() => {
    const filtered = TC.pastSessions.filter(
      (session) =>
        session.student?.firstName
          .toLowerCase()
          .includes(TC.filterValuePastSessions.toLowerCase()) ||
        session.student?.lastName
          .toLowerCase()
          .includes(TC.filterValuePastSessions.toLowerCase()),
    );
    TC.setFilteredPastSessions(filtered);
    TC.setCurrentPage(1);
  }, [TC.filterValuePastSessions, TC.sessions, TC.pastSessions]);

  const totalPages = Math.ceil(TC.filteredSessions.length / TC.rowsPerPage);

  const handlePageChange = (newPage: number) => {
    TC.setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (value: string) => {
    TC.setRowsPerPage(parseInt(value));
    TC.setCurrentPage(1);
  };

  const handleReschedule = async (
    sessionId: string,
    newDate: string,
    meetingId: string,
  ) => {
    try {
      if (!TC.profile || !TC.profile.id) {
        console.error("No profile found cannot reschedule");
        return;
      }

      const updatedSession = await rescheduleSession(
        sessionId,
        newDate,
        meetingId,
      );
      console.log("Updated session:", updatedSession);

      if (updatedSession) {
        TC.setCurrentSessions(
          TC.currentSessions.map((e: Session) =>
            e.id === updatedSession.id ? updatedSession : e,
          ),
        );
        TC.setSessions(
          TC.sessions.map((e: Session) =>
            e.id === updatedSession.id ? updatedSession : e,
          ),
        );

        const formattedDate = format(new Date(newDate), "MMMM d, yyyy");
        const formattedTime = format(new Date(newDate), "h:mm a");

        if (updatedSession.student?.email) {
          await sendSessionRescheduleEmail(
            {
              studentName: `${updatedSession.student.firstName} ${updatedSession.student.lastName}`,
              tutorName: `${TC.profile.firstName} ${TC.profile.lastName}`,
              newDate: formattedDate,
              newTime: formattedTime,
              meetingLink: updatedSession.meeting?.link,
            },
            updatedSession.student.email,
          );
        }
      }
      TC.setSelectedSession(null);
      TC.setIsDialogOpen(false);
      toast.success("Session updated successfully");
    } catch (error) {
      console.error("Error requesting session reschedule:", error);
      toast.error("Failed to reschedule session");
    }
  };

  const handleStatusChange = async (updatedSession: Session) => {
    try {
      await updateSession(updatedSession);
      TC.setCurrentSessions(
        TC.currentSessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e,
        ),
      );
      TC.setSessions(
        TC.sessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e,
        ),
      );
      toast.success("Session updated successfully");
    } catch (error) {
      console.error("Failed to update session:", error);
      toast.error("Failed to update session");
    }
  };

  const handleSessionComplete = async (
    session: Session,
    notes: string,
    isQuestionOrConcern: boolean,
    isFirstSession: boolean,
  ) => {
    try {
      const updatedSession = session;
      updatedSession.session_exit_form = notes;
      updatedSession.status = "Complete";
      updatedSession.isQuestionOrConcern = isQuestionOrConcern;
      updatedSession.isFirstSession = isFirstSession;
      await updateSession(updatedSession);
      TC.setCurrentSessions(
        TC.currentSessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e,
        ),
      );
      TC.setSessions(
        TC.sessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e,
        ),
      );
      toast.success("Session Marked Complete");
      TC.setIsSessionExitFormOpen(false);
      TC.setNotes("");
      TC.setNextClassConfirmed(false);

      //API Call to update operation logs

      if (isQuestionOrConcern) {
        const response = await fetch(
          "/api/session-exit-form/questions-concerns",
          {
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              tutorFirstName: session.tutor?.firstName,
              tutorLastName: session.tutor?.lastName,
              studentFirstName: session.student?.firstName,
              studentLastName: session.student?.lastName,
              formContent: notes,
              tutorEmail: session.tutor?.email,
              studentEmail: session.student?.email,
            }),
          },
        );
        const data = await response.json();

        if (!data.success) {
          toast.error("Unable to record question or concern");
          throw new Error(data.error);
        }
      }
    } catch (error) {
      console.error("Failed to record Session Exit Form", error);
      toast.error("Failed to record Session Exit Form");
    }
  };

  const handleUndoSessionExitForm = async (sessionId: string) => {
    console.log("Undo clicked:", sessionId);
    try {
      const timePassed = await getSessionTimePassed(sessionId);
      if (timePassed > 1000 * 60 * 60 * 24 * 7) {
        const err = new Error("Undo Expired");
        throw new Error("Undo Expired");
      }
      const session = await undoSessionExitForm(sessionId);
      if (!session) return;

      TC.setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? session : s)),
      );

      TC.setPastSessions((prev) => prev.filter((s) => s.id !== sessionId));
      TC.setCurrentSessions((prev) => [
        session,
        ...prev.filter((s) => s.id !== sessionId),
      ]);

      toast.success("Session exit form undone");
    } catch (error) {
      const err = error as Error;
      console.error("Undo exit form failed:", err);
      if ((err.message = "Undo Expired")) {
        toast.error("Time To Undo Expired");
      } else {
        toast.error("Could not undo session exit form");
      }
    }
  };

  // why: restore cancelled session to active status and update UI state
  const handleUndoCancel = async (sessionId: string) => {
    try {
      await undoCancelSession(sessionId, "Active");
      TC.setCurrentSessions(
        TC.currentSessions.map((s) =>
          s.id === sessionId ? { ...s, status: "Active" } : s,
        ),
      );
      TC.setPastSessions(TC.pastSessions.filter((s) => s.id !== sessionId));
      TC.setFilteredPastSessions(
        TC.filteredPastSessions.filter((s) => s.id !== sessionId),
      );
      toast.success("Session cancellation undone");
    } catch (error) {
      console.error("Failed to undo session cancellation", error);
      toast.error("Failed to undo session cancellation");
    }
  };

  const paginatedSessions = TC.filteredSessions.slice(
    (TC.currentPage - 1) * TC.rowsPerPage,
    TC.currentPage * TC.rowsPerPage,
  );

  const paginatedPastSessions = TC.filteredPastSessions.slice(
    (TC.currentPage - 1) * TC.rowsPerPage,
    TC.currentPage * TC.rowsPerPage,
  );

  const handleInputChange = (e: {
    target: { name: string; value: string };
  }) => {
    const { name, value } = e.target;

    // Helper function to handle nested updates
    const handleNestedChange = (obj: any, key: string, value: any) => {
      const keys = key.split(".");
      let temp = obj;

      keys.forEach((k, index) => {
        if (index === keys.length - 1) {
          temp[k] = value;
        } else {
          temp[k] = temp[k] || {};
          temp = temp[k];
        }
      });

      return { ...obj };
    };

    if (TC.selectedSession) {
      TC.setSelectedSession((prevState) =>
        handleNestedChange({ ...prevState }, name, value),
      );
    }
  };

  return (
    <>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">This Week</h1>
        <div className="flex space-x-6">
          <div className="flex-grow bg-white rounded-lg shadow p-6">
            <CurrentSessionsTable
              meetings={TC.meetings}
              totalPages={totalPages}
              handleStatusChange={handleStatusChange}
              handleReschedule={handleReschedule}
              handleSessionComplete={handleSessionComplete}
              handleUndoCancel={handleUndoCancel}
              handlePageChange={handlePageChange}
              handleRowsPerPageChange={handleRowsPerPageChange}
              handleInputChange={handleInputChange}
            />
          </div>
        </div>
      </div>{" "}
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Active Sessions</h1>

        <div className="flex space-x-6">
          <div className="flex-grow bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex space-x-2">
                <Input
                  type="text"
                  placeholder="Filter sessions..."
                  className="w-64"
                  value={TC.filterValueActiveSessions}
                  onChange={(e) =>
                    TC.setFilterValueActiveSessions(e.target.value)
                  }
                />
              </div>
            </div>

            <ActiveSessionsTable
              paginatedSessions={paginatedSessions}
              meetings={TC.meetings}
              totalPages={totalPages}
              handleStatusChange={handleStatusChange}
              handleReschedule={handleReschedule}
              handleSessionComplete={handleSessionComplete}
              handlePageChange={handlePageChange}
              handleRowsPerPageChange={handleRowsPerPageChange}
              handleInputChange={handleInputChange}
            />
          </div>
        </div>
      </div>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Past Sessions</h1>

        <div className="flex space-x-6">
          <div className="flex-grow bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex space-x-2">
                <Input
                  type="text"
                  placeholder="Filter sessions..."
                  className="w-64"
                  value={TC.filterValuePastSessions}
                  onChange={(e) =>
                    TC.setFilterValuePastSessions(e.target.value)
                  }
                />
              </div>
            </div>

            <CompletedSessionsTable
              paginatedSessions={paginatedPastSessions}
              totalPages={totalPages}
              handlePageChange={handlePageChange}
              handleRowsPerPageChange={handleRowsPerPageChange}
              handleUndoSessionExitForm={handleUndoSessionExitForm}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default TutorDashboard;
