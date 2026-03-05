"use client";
import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import TutorCalendar from "../TutorCalendar";
import { Input } from "@/components/ui/input";
import SessionsTable from "../components/ActiveSessionsTable";
import ActiveSessionsTable from "../components/ActiveSessionsTable";
import CurrentSessionsTable from "../components/CurrentSessionsTable";
import CompletedSessionsTable from "../components/CompletedSessionsTable";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getProfile } from "@/lib/actions/user.actions";
import {
  updateSession,
} from "@/lib/actions/admin.actions";
import {
  recordSessionExitForm,
  undoCancelSession,
} from "@/lib/actions/tutor.actions";
import {
  rescheduleSession
} from "@/lib/actions/session.server.actions"
import { Session, Profile, Meeting } from "@/types";
import toast from "react-hot-toast";
import { useDashboardContext } from "@/contexts/dashboardContext";


const TutorDashboard = () => {
  const router = useRouter();
  const TC = useDashboardContext()

  useEffect(() => {
    const filtered = TC.sessions.filter(
      (session) =>
        session.student?.firstName
          .toLowerCase()
          .includes(TC.filterValueActiveSessions.toLowerCase()) ||
        session.student?.lastName
          .toLowerCase()
          .includes(TC.filterValueActiveSessions.toLowerCase())
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
          .includes(TC.filterValuePastSessions.toLowerCase())
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
    meetingId: string
  ) => {
    try {
      if (!TC.profile || !TC.profile.id) {
        console.error("No profile found cannot reschedule");
        return;
      }

      const updatedSession = await rescheduleSession(
        sessionId,
        newDate,
        meetingId
      );

      if (updatedSession) {
        TC.setCurrentSessions(
          TC.currentSessions.map((e: Session) =>
            e.id === updatedSession.id ? updatedSession : e
          )
        );
        TC.setSessions(
          TC.sessions.map((e: Session) =>
            e.id === updatedSession.id ? updatedSession : e
          )
        );
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
          e.id === updatedSession.id ? updatedSession : e
        )
      );
      TC.setSessions(
        TC.sessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e
        )
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
    isFirstSession: boolean
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
          e.id === updatedSession.id ? updatedSession : e
        )
      );
      TC.setSessions(
        TC.sessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e
        )
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
          }
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

  // why: restore cancelled session to active status and update UI state
  const handleUndoCancel = async (sessionId: string) => {
    try {
      await undoCancelSession(sessionId, "Active");
      TC.setCurrentSessions(
        TC.currentSessions.map((s) =>
          s.id === sessionId ? { ...s, status: "Active" } : s
        )
      );
      TC.setPastSessions(
        TC.pastSessions.filter((s) => s.id !== sessionId)
      );
      TC.setFilteredPastSessions(
        TC.filteredPastSessions.filter((s) => s.id !== sessionId)
      );
      toast.success("Session cancellation undone");
    } catch (error) {
      console.error("Failed to undo session cancellation", error);
      toast.error("Failed to undo session cancellation");
    }
  };

  const paginatedSessions = TC.filteredSessions.slice(
    (TC.currentPage - 1) * TC.rowsPerPage,
    TC.currentPage * TC.rowsPerPage
  );

  const paginatedPastSessions = TC.filteredPastSessions.slice(
    (TC.currentPage - 1) * TC.rowsPerPage,
    TC.currentPage * TC.rowsPerPage
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
        handleNestedChange({ ...prevState }, name, value)
      );
    }
  };

  return (
    <>
      <div className="p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">This Week</h1>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-grow bg-white rounded-lg shadow p-4 md:p-6 overflow-x-auto">
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
      <div className="p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Active Sessions</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-grow bg-white rounded-lg shadow p-4 md:p-6 overflow-x-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 sm:gap-0">
              <div className="flex w-full sm:w-auto space-x-2">
                <Input
                  type="text"
                  placeholder="Filter sessions..."
                  className="w-full sm:w-64"
                  value={TC.filterValueActiveSessions}
                  onChange={(e) => TC.setFilterValueActiveSessions(e.target.value)}
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
      <div className="p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Past Sessions</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-grow bg-white rounded-lg shadow p-4 md:p-6 overflow-x-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 sm:gap-0">
              <div className="flex w-full sm:w-auto space-x-2">
                <Input
                  type="text"
                  placeholder="Filter sessions..."
                  className="w-full sm:w-64"
                  value={TC.filterValuePastSessions}
                  onChange={(e) => TC.setFilterValuePastSessions(e.target.value)}
                />
              </div>
            </div>

            <CompletedSessionsTable
              paginatedSessions={paginatedPastSessions}
              // filteredSessions={filteredPastSessions}
              // currentPage={currentPage}
              totalPages={totalPages}
              // rowsPerPage={rowsPerPage.toString()}
              // selectedSession={selectedSession}
              // setSelectedSession={setSelectedSession}
              handlePageChange={handlePageChange}
              handleRowsPerPageChange={handleRowsPerPageChange}
            />
          </div>

          {/* <div className="w-80">
            {/* <TutorCalendar sessions={sessions} /> */}
          {/* </div>  */}
        </div>
      </div>
    </>
  );
};

export default TutorDashboard;