"use client";
import React, { useState, useEffect, useCallback, use, Suspense } from "react";
// import StudentCalendar from "../StudentCalendar";
import { Input } from "@/components/ui/input";
import ActiveSessionsTable from "./components/ActiveSessionsTable";
import CurrentSessionsTable from "./components/CurrentSessionsTable";
import CompletedSessionsTable from "./components/CompletedSessionsTable";
import {
  createClientComponentClient,
  User,
} from "@supabase/auth-helpers-nextjs";
import { getProfile } from "@/lib/actions/user.actions";
import { updateSession, getMeetings } from "@/lib/actions/admin.actions";
import {
  getTutorSessions,
  recordSessionExitForm,
} from "@/lib/actions/tutor.actions";
import { getAllSessions } from "@/lib/actions/session.actions";
import { rescheduleSession } from "@/lib/actions/session.server.actions";
import { Session, Profile, Meeting } from "@/types";
import toast from "react-hot-toast";
import {
  parseISO,
  addHours,
  areIntervalsOverlapping,
  isValid,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
} from "date-fns";
import { SelectSeparator } from "@radix-ui/react-select";
import { Description } from "@radix-ui/react-dialog";
import { getStudentSessions } from "@/lib/actions/student.actions";
import { useProfile } from "@/contexts/profileContext";
import SkeletonTable, { Skeleton } from "../ui/skeleton";
import { useDashboardContext } from "@/contexts/dashboardContext";

const StudentDashboard = () => {
  const SC = useDashboardContext();

  const getUserData = useCallback(async () => {
    try {
      SC.setLoading(true);
      SC.setError(null);
      if (!SC.profile) return;
    } catch (error) {
      console.error("Error fetching user data:", error);
      SC.setError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      SC.setLoading(false);
    }
  }, []);

  const fetchAllSessionsFromSchedule = async () => {
    try {
      const data = await getAllSessions(undefined, undefined, "date", false);
      if (!data) throw new Error("Unable to retrieve all sessions");
      SC.setAllSessions(data);
    } catch (error) {
      console.error("Failed to fetch all sessions", error);
      throw error;
    }
  };

  const fetchDaySessionsFromSchedule = (session: Session) => {
    if (SC.selectedSessionDate) {
      try {
        const startDateSearch = addHours(
          parseISO(SC.selectedSessionDate),
          -12,
        ).toISOString();

        const endDateSearch = addHours(
          parseISO(SC.selectedSessionDate),
          12,
        ).toISOString();
        getAllSessions(startDateSearch, endDateSearch)
          .then((data) => {
            SC.setAllSessions(data);
          })
          .catch((error) => {
            console.error("Failed to fetch sessions for day");
          });
      } catch (error) {
        console.error("Failed to fetch sessions for day");
        throw error;
      }
    }
  };

  useEffect(() => {
    const filtered = SC.sessions.filter(
      (session) =>
        session.student?.firstName
          .toLowerCase()
          .includes(SC.filterValueActiveSessions.toLowerCase()) ||
        session.student?.lastName
          .toLowerCase()
          .includes(SC.filterValueActiveSessions.toLowerCase()),
    );
    SC.setFilteredSessions(filtered);
    SC.setCurrentPage(1);
  }, [SC.filterValueActiveSessions, SC.sessions]);

  useEffect(() => {
    const filtered = SC.pastSessions.filter(
      (session) =>
        session.student?.firstName
          .toLowerCase()
          .includes(SC.filterValuePastSessions.toLowerCase()) ||
        session.student?.lastName
          .toLowerCase()
          .includes(SC.filterValuePastSessions.toLowerCase()),
    );
    SC.setFilteredPastSessions(filtered);
    SC.setCurrentPage(1);
  }, [SC.filterValuePastSessions, SC.sessions]);

  const totalPages = Math.ceil(SC.filteredSessions.length / SC.rowsPerPage);

  const handlePageChange = (newPage: number) => {
    SC.setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (value: string) => {
    SC.setRowsPerPage(parseInt(value));
    SC.setCurrentPage(1);
  };

  const handleReschedule = async (
    sessionId: string,
    newDate: string,
    meetingId: string,
  ) => {
    try {
      if (!SC.profile || !SC.profile.id) {
        console.error("No profile found cannot reschedule");
        return;
      }

      const updatedSession = await rescheduleSession(
        sessionId,
        newDate,
        meetingId,
      );

      if (updatedSession) {
        SC.setCurrentSessions(
          SC.currentSessions.map((e: Session) =>
            e.id === updatedSession.id ? updatedSession : e,
          ),
        );
        SC.setSessions(
          SC.sessions.map((e: Session) =>
            e.id === updatedSession.id ? updatedSession : e,
          ),
        );
      }
      getUserData();
      SC.setSelectedSession(null);
      SC.setIsDialogOpen(false);
      toast.success("Session updated successfully");
    } catch (error) {
      console.error("Error requesting session reschedule:", error);
      toast.error("Failed to reschedule session");
    }
  };

  const handleStatusChange = async (updatedSession: Session) => {
    try {
      await updateSession(updatedSession);
      SC.setCurrentSessions(
        SC.currentSessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e,
        ),
      );
      SC.setSessions(
        SC.sessions.map((e: Session) =>
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
    updatedSession: Session,
    notes: string,
    isQuestionOrConcern: boolean,
    isFirstSession: boolean,
  ) => {
    try {
      await recordSessionExitForm(updatedSession.id, notes);
      updatedSession.status = "Complete";
      updatedSession.isQuestionOrConcern = isQuestionOrConcern;
      updatedSession.isFirstSession = isFirstSession;
      await updateSession(updatedSession);
      SC.setCurrentSessions(
        SC.currentSessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e,
        ),
      );
      SC.setSessions(
        SC.sessions.map((e: Session) =>
          e.id === updatedSession.id ? updatedSession : e,
        ),
      );
      toast.success("Session Marked Complete");
      SC.setIsSessionExitFormOpen(false);
      SC.setNotes("");
      SC.setNextClassConfirmed(false);

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
              tutorFirstName: updatedSession.tutor?.firstName,
              tutorLastName: updatedSession.tutor?.lastName,
              studentFirstName: updatedSession.student?.firstName,
              studentLastName: updatedSession.student?.lastName,
              formContent: notes,
              tutorEmail: updatedSession.tutor?.email,
              studentEmail: updatedSession.student?.email,
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

  const paginatedSessions = SC.filteredSessions.slice(
    (SC.currentPage - 1) * SC.rowsPerPage,
    SC.currentPage * SC.rowsPerPage,
  );

  const paginatedPastSessions = SC.filteredPastSessions.slice(
    (SC.currentPage - 1) * SC.rowsPerPage,
    SC.currentPage * SC.rowsPerPage,
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

    if (SC.selectedSession) {
      SC.setSelectedSession((prevState) =>
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
            <Suspense fallback={<SkeletonTable />}>
              <CurrentSessionsTable />
            </Suspense>
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
                  value={SC.filterValueActiveSessions}
                  onChange={(e) =>
                    SC.setFilterValueActiveSessions(e.target.value)
                  }
                />
              </div>
            </div>
            <Suspense fallback={<SkeletonTable />}>
              <ActiveSessionsTable
                paginatedSessions={paginatedSessions}
                filteredSessions={SC.filteredSessions}
                totalPages={totalPages}
                handleStatusChange={handleStatusChange}
                handleReschedule={handleReschedule}
                handleSessionComplete={handleSessionComplete}
                handlePageChange={handlePageChange}
                handleRowsPerPageChange={handleRowsPerPageChange}
                handleInputChange={handleInputChange}
              />
            </Suspense>
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
                  value={SC.filterValuePastSessions}
                  onChange={(e) =>
                    SC.setFilterValuePastSessions(e.target.value)
                  }
                />
              </div>
            </div>

            <Suspense fallback={<SkeletonTable />}>
              {" "}
              <CompletedSessionsTable
                paginatedSessions={paginatedPastSessions}
                // filteredSessions={SC.filteredPastSessions}
                // currentPage={currentPage}
                totalPages={totalPages}
                // rowsPerPage={rowsPerPage.toString()}
                // selectedSession={selectedSession}
                // setSelectedSession={setSelectedSession}
                handlePageChange={handlePageChange}
                handleRowsPerPageChange={handleRowsPerPageChange}
              />
            </Suspense>
          </div>

          {/* <div className="w-80">
            {/* <TutorCalendar sessions={sessions} /> */}
          {/* </div>  */}
        </div>
      </div>
    </>
  );
};

export default StudentDashboard;
