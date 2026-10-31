// @vitest-environment jsdom
import React, { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile, Session } from "@/types";
import { DashboardContextProvider, useDashboardContext } from "@/lib/contexts/dashboardContext";
import { SessionExitFormTrigger } from "../components/SessionExitForm";
import TutorDashboard from "./TutorDashboard";

const { submitSessionExitForm, sendFeedback, toastSuccess, toastError, undoSessionExitForm } =
  vi.hoisted(() => ({
    submitSessionExitForm: vi.fn(),
    undoSessionExitForm: vi.fn(),
    sendFeedback: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }));
vi.mock("@/lib/actions/session/server.actions", () => ({
  updateSession: vi.fn(),
  rescheduleSession: vi.fn(),
  cancelSession: vi.fn(),
}));
// The real submit flow (lib/session-exit-form) runs; only the server action is mocked.
vi.mock("@/lib/actions/tutor/actions", () => ({
  undoCancelSession: vi.fn(),
  undoSessionExitForm,
  submitSessionExitForm,
}));
vi.mock("@/lib/actions/enrollment/server.actions", () => ({
  getTutorEnrollmentsMissingSEF: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/actions/session/client.actions", () => ({
  sendStudentSEFFeedbackEmail: sendFeedback,
  getSessionTimePassed: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/actions/email/server.actions", () => ({
  sendSessionRescheduleEmail: vi.fn(),
  updateScheduledEmailBeforeSessions: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ default: { success: toastSuccess, error: toastError } }));
vi.mock("../components/CancellationForm", () => ({ default: () => null }));
// Keep the actual form, trigger, Radix dialog, and context. Represent the four table
// placements without rendering unrelated rescheduling/cancellation controls.
vi.mock("../components/CurrentSessionsTable", () => ({
  default: function CurrentSessionsTable() {
    const tc = useDashboardContext();
    return tc.currentSessions.map((s) => (
      <React.Fragment key={s.id}>
        <SessionExitFormTrigger currSession={s} />
        <SessionExitFormTrigger currSession={s} />
      </React.Fragment>
    ));
  },
}));
vi.mock("../components/ActiveSessionsTable", () => ({
  default: function ActiveSessionsTable() {
    const tc = useDashboardContext();
    return tc.sessions.map((s) => (
      <React.Fragment key={s.id}>
        <SessionExitFormTrigger currSession={s} />
        <SessionExitFormTrigger currSession={s} />
      </React.Fragment>
    ));
  },
}));
vi.mock("../components/CompletedSessionsTable", () => ({
  default: function CompletedSessionsTable({ handleUndoSessionExitForm }: any) {
    const tc = useDashboardContext();
    return (
      <div data-testid="past-sessions">
        {tc.pastSessions.map((s) => (
          <div key={s.id}>
            {s.status}: {s.session_exit_form}
            <button onClick={() => handleUndoSessionExitForm(s.id)}>Undo SEF</button>
          </div>
        ))}
      </div>
    );
  },
}));
// A native select avoids testing Radix's pointer/geometry implementation in jsdom.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, ...props }: any) => (
    <select aria-label="Issue Category" onChange={(e) => onValueChange(e.target.value)} {...props}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

const originalSession: Session = {
  id: "session-1",
  enrollmentId: null,
  createdAt: "2020-01-01T00:00:00Z",
  date: "2020-01-01T12:00:00Z",
  duration: 60,
  status: "Unconfirmed",
  session_exit_form: "",
  summary: "",
  tutor: null,
  student: null,
  isQuestionOrConcern: false,
  isFirstSession: false,
  isStandalone: false,
};
let context: ReturnType<typeof useDashboardContext>;
function ObserveContext() {
  const tc = useDashboardContext();
  useEffect(() => {
    context = tc;
  }, [tc]);
  return null;
}
// Mirrors the dashboard page: only Active sessions are active; everything else is past
function setup(session = { ...originalSession }) {
  const isActive = session.status === "Active";
  render(
    <DashboardContextProvider
      initialProfile={{ id: "tutor-1" } as Profile}
      params={{
        initialCurrentSessions: [session],
        initialActiveSessions: isActive ? [session] : [],
        initialPastSessions: isActive ? [] : [session],
        initialMeetings: [],
      }}
    >
      <ObserveContext />
      <TutorDashboard />
    </DashboardContextProvider>,
  );
  return session;
}
/** What the server action returns once the conditional write has completed the session. */
const savedResult = ({ sessionId, notes, isQuestionOrConcern, isFirstSession }: any) => ({
  ok: true,
  session: {
    ...originalSession,
    id: sessionId,
    status: "Complete",
    session_exit_form: notes,
    isQuestionOrConcern,
    isFirstSession,
  },
});
function openAndFill() {
  fireEvent.click(screen.getAllByRole("button", { name: "Submit overdue SEF" })[0]);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "We covered fractions." } });
  fireEvent.click(screen.getByRole("checkbox", { name: /My student knows/ }));
}
beforeEach(() => {
  vi.clearAllMocks();
  sendFeedback.mockResolvedValue(undefined);
  submitSessionExitForm.mockImplementation(async (input: any) => savedResult(input));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SEF submission", () => {
  it("opens one dialog across all four table triggers and submits an overdue session", async () => {
    const source = setup();
    openAndFill();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Session Marked Complete"));
    expect(source.status).toBe("Unconfirmed");
    expect(source.session_exit_form).toBe("");
    expect(context.sessions).toEqual([]);
    expect(context.currentSessions[0].status).toBe("Complete");
    expect(screen.getByTestId("past-sessions").textContent).toContain(
      "Complete: We covered fractions.",
    );
    // The Unconfirmed entry is replaced in place, not duplicated
    expect(context.pastSessions).toHaveLength(1);
    expect(context.notes).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns a completed session to the active list when its SEF is undone", async () => {
    undoSessionExitForm.mockResolvedValue({ ...originalSession, status: "Active" });
    setup();
    openAndFill();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(context.pastSessions).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Undo SEF" }));
    await waitFor(() => expect(context.sessions[0]?.status).toBe("Active"));
    expect(context.pastSessions).toEqual([]);
    expect(context.currentSessions[0].status).toBe("Active");
  });

  it("keeps notes and confirmation on save failure, then allows a successful retry", async () => {
    submitSessionExitForm.mockResolvedValueOnce({ ok: false, reason: "error" });
    const source = setup();
    openAndFill();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "We covered fractions.",
    );
    expect(
      screen.getByRole("checkbox", { name: /My student knows/ }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(source.status).toBe("Unconfirmed");
    expect(context.pastSessions).toEqual([source]);
    expect(context.sessions).toEqual([]);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(sendFeedback).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledOnce());
    expect(submitSessionExitForm).toHaveBeenCalledTimes(2);
  });

  it("blocks repeated submits and dismissal while a save is pending", async () => {
    let resolveSave!: (result: unknown) => void;
    submitSessionExitForm.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    setup();
    openAndFill();
    const submit = screen.getByRole("button", { name: "Submit" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(submitSessionExitForm).toHaveBeenCalledOnce());
    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
    await act(async () =>
      resolveSave(
        savedResult({
          sessionId: originalSession.id,
          notes: "We covered fractions.",
          isQuestionOrConcern: false,
          isFirstSession: false,
        }),
      ),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledOnce());
  });

  it("shows server refusals without clearing the form", async () => {
    submitSessionExitForm
      .mockResolvedValueOnce({ ok: false, reason: "not_active" })
      .mockRejectedValueOnce(new Error("network down"));
    setup();
    openAndFill();
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByRole("alert");
      expect(context.notes).toBe("We covered fractions.");
      expect(toastSuccess).not.toHaveBeenCalled();
    }
  });

  it("saves nothing when the concern can't be sent, keeps the fields, then saves on retry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: "delivery failed" }),
    } as Response);
    setup();
    openAndFill();
    fireEvent.click(screen.getByRole("checkbox", { name: "I have a question or a concern" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "technical" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect((await screen.findByRole("alert")).textContent).toContain("question or concern");
    expect(submitSessionExitForm).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("checkbox", { name: "I have a question or a concern" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("technical");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledOnce());
    expect(context.pastSessions[0].isQuestionOrConcern).toBe(true);
  });

  it.each(["Complete", "Cancelled", "Student Did Not Attend"] as const)(
    "does not allow a new SEF for %s sessions",
    (status) => {
      setup({ ...originalSession, status });
      expect(
        screen
          .getAllByRole("button")
          .filter((b) =>
            b.textContent?.includes(status === "Complete" ? "SEF Submitted" : "Submit overdue SEF"),
          )
          .every((b) => (b as HTMLButtonElement).disabled),
      ).toBe(true);
    },
  );

  it("does not submit a cancelled session opened through another dashboard action", async () => {
    const session = setup({ ...originalSession, status: "Cancelled" });
    await act(async () => {
      context.setSelectedSession(session);
      context.setIsSessionExitFormOpen(true);
      context.setNotes("We covered fractions.");
      context.setNextClassConfirmed(true);
    });
    expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(submitSessionExitForm).not.toHaveBeenCalled();
  });

  it("does not allow a future session or whitespace-only notes", () => {
    setup({ ...originalSession, date: "2100-01-01T12:00:00Z", status: "Active" });
    expect(
      screen
        .getAllByRole("button")
        .filter((b) => b.textContent?.includes("SEF Due"))
        .every((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);
    cleanup();
    setup();
    openAndFill();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
