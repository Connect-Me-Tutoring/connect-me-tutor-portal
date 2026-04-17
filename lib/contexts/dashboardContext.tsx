"use client";

import { Meeting, Profile, Session } from "@/types";
import {
  Dispatch,
  SetStateAction,
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
  use,
} from "react";

export interface DashboardContextValue {
  currentSessions: Session[];
  pastSessions: Session[];
  sessions: Session[];
  filteredSessions: Session[];
  filteredPastSessions: Session[];
  meetings: Meeting[];
  allSessions: Session[];
  profile: Profile | null;
  loading: boolean;
  error: string | null;

  currentPage: number;
  rowsPerPage: number;
  filterValueActiveSessions: string;
  filterValuePastSessions: string;

  selectedSession: Session | null;
  selectedSessionDate: string | null;
  isDialogOpen: boolean;
  isSessionExitFormOpen: boolean;
  notes: string;
  nextClassConfirmed: boolean;

  setCurrentSessions: Dispatch<SetStateAction<Session[]>>;
  setPastSessions: Dispatch<SetStateAction<Session[]>>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  setFilteredSessions: Dispatch<SetStateAction<Session[]>>;
  setFilteredPastSessions: Dispatch<SetStateAction<Session[]>>;
  setMeetings: Dispatch<SetStateAction<Meeting[]>>;
  setAllSessions: Dispatch<SetStateAction<Session[]>>;
  setProfile: Dispatch<SetStateAction<Profile | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setRowsPerPage: Dispatch<SetStateAction<number>>;
  setFilterValueActiveSessions: Dispatch<SetStateAction<string>>;
  setFilterValuePastSessions: Dispatch<SetStateAction<string>>;
  setSelectedSession: Dispatch<SetStateAction<Session | null>>;
  setSelectedSessionDate: Dispatch<SetStateAction<string | null>>;
  setIsDialogOpen: Dispatch<SetStateAction<boolean>>;
  setIsSessionExitFormOpen: Dispatch<SetStateAction<boolean>>;
  setNotes: Dispatch<SetStateAction<string>>;
  setNextClassConfirmed: Dispatch<SetStateAction<boolean>>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

interface DashboardContextProviderParams {
  children: ReactNode;
  initialProfile: Profile;
  params?: {
    initialCurrentSessions: Session[];
    initialPastSessions: Session[];
    initialActiveSessions: Session[];
    initialMeetings: Meeting[];
  };
  promises?: {
    currentSessionsPromise: Promise<Session[]>;
    pastSessionsPromise: Promise<Session[]>;
    activeSessionsPromise: Promise<Session[]>;
    meetingsPromise: Promise<Meeting[] | null>;
  };
}

export function DashboardContextProvider({
  children,
  initialProfile,
  params,
  promises,
}: DashboardContextProviderParams) {
  const initialCurrentSessions = params
    ? params.initialCurrentSessions
    : promises
      ? use(promises.currentSessionsPromise)
      : [];
  const initialPastSessions = params
    ? params.initialPastSessions
    : promises
      ? use(promises.pastSessionsPromise)
      : [];
  const initialActiveSessions = params
    ? params.initialActiveSessions
    : promises
      ? use(promises.activeSessionsPromise)
      : [];
  const initialMeetings = params
    ? params.initialMeetings
    : promises
      ? use(promises.meetingsPromise)
      : [];

  const [currentSessions, setCurrentSessions] = useState<Session[]>(
    initialCurrentSessions,
  );
  const [pastSessions, setPastSessions] =
    useState<Session[]>(initialPastSessions);
  const [sessions, setSessions] = useState<Session[]>(initialActiveSessions);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>(
    initialActiveSessions,
  );
  const [filteredPastSessions, setFilteredPastSessions] =
    useState<Session[]>(initialPastSessions);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings || []);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [filterValueActiveSessions, setFilterValueActiveSessions] =
    useState<string>("");
  const [filterValuePastSessions, setFilterValuePastSessions] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(
    null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSessionExitFormOpen, setIsSessionExitFormOpen] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [nextClassConfirmed, setNextClassConfirmed] = useState<boolean>(false);

  const contextValue: DashboardContextValue = {
    currentSessions,
    pastSessions,
    sessions,
    filteredSessions,
    filteredPastSessions,
    meetings,
    allSessions,
    profile,
    loading,
    error,

    // --- Pagination & Filters ---
    currentPage,
    rowsPerPage,
    filterValueActiveSessions,
    filterValuePastSessions,

    // --- UI/Form State ---
    selectedSession,
    selectedSessionDate,
    isDialogOpen,
    isSessionExitFormOpen,
    notes,
    nextClassConfirmed,

    // --- Setters ---
    setCurrentSessions,
    setPastSessions,
    setSessions,
    setFilteredSessions,
    setFilteredPastSessions,
    setMeetings,
    setAllSessions,
    setProfile,
    setLoading,
    setError,
    setCurrentPage,
    setRowsPerPage,
    setFilterValueActiveSessions,
    setFilterValuePastSessions,
    setSelectedSession,
    setSelectedSessionDate,
    setIsDialogOpen,
    setIsSessionExitFormOpen,
    setNotes,
    setNextClassConfirmed,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (context === null)
    throw new Error("useContext must be used within DashboardContextProvider");
  return context;
}
