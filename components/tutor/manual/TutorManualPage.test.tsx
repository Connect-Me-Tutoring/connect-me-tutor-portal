// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TutorManual } from "@/constants/tutor-manual";

const { saveTutorManual, toastSuccess, toastError } = vi.hoisted(() => ({
  saveTutorManual: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/lib/actions/tutor-manual/server.actions", () => ({ saveTutorManual }));
vi.mock("react-hot-toast", () => ({ default: { success: toastSuccess, error: toastError } }));

const { default: TutorManualPage } = await import("./TutorManualPage");

const manual: TutorManual = {
  sections: [
    {
      title: "Getting help",
      body: "Open [My Students](/dashboard/my-students) or the [form](https://example.com).\n\n> Serious incidents use the incident form.",
    },
    {
      title: "Quick reference",
      body: "| I want to | Go to |\n| --- | --- |\n| Join | Dashboard |",
    },
  ],
  updatedAt: "2026-11-02T15:00:00.000Z",
  updatedByName: "Ada Admin",
};

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
});
afterEach(cleanup);

describe("TutorManualPage", () => {
  it("shows tutors a read-only manual with contents, portal links, and tables", () => {
    render(<TutorManualPage initialManual={manual} canEdit={false} />);

    expect(screen.queryByRole("button", { name: /edit manual/i })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Manual contents" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Getting help/ }).getAttribute("href")).toBe(
      "#getting-help",
    );
    expect(screen.getByRole("link", { name: "My Students" }).getAttribute("href")).toBe(
      "/dashboard/my-students",
    );
    expect(screen.getByRole("link", { name: "form" }).getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("alert").textContent).toContain("Serious incidents");
    expect(screen.getByRole("table")).toBeTruthy();
    // Tutors see when it changed, not who changed it.
    expect(screen.getByText("Last updated November 2, 2026")).toBeTruthy();
  });

  it("lets admins edit, preview, and save a new version", async () => {
    const saved: TutorManual = {
      sections: [{ ...manual.sections[0], title: "Help!" }, manual.sections[1]],
      updatedAt: "2026-11-02T16:00:00.000Z",
      updatedByName: "Ada Admin",
    };
    saveTutorManual.mockResolvedValue(saved);
    render(<TutorManualPage initialManual={manual} canEdit />);

    expect(screen.getByText("Last updated November 2, 2026 by Ada Admin")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /edit manual/i }));

    const [firstTitle] = screen.getAllByLabelText("Title");
    fireEvent.change(firstTitle, { target: { value: "Help!" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save manual" }));
    });

    await waitFor(() => expect(saveTutorManual).toHaveBeenCalledWith(saved.sections));
    expect(toastSuccess).toHaveBeenCalled();
    // Back to the read-only view, showing the saved content.
    expect(screen.getByRole("heading", { name: "Help!" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save manual" })).toBeNull();
  });

  it("keeps the admin's edits on screen when a save fails", async () => {
    saveTutorManual.mockRejectedValue(new Error("nope"));
    render(<TutorManualPage initialManual={manual} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /edit manual/i }));

    fireEvent.change(screen.getAllByLabelText("Title")[0], { target: { value: "Draft" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save manual" }));
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect((screen.getAllByLabelText("Title")[0] as HTMLInputElement).value).toBe("Draft");
  });

  it("won't save a section without a title", async () => {
    render(<TutorManualPage initialManual={manual} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /edit manual/i }));

    fireEvent.change(screen.getAllByLabelText("Title")[0], { target: { value: "   " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save manual" }));
    });

    expect(await screen.findByText("Every section needs a title")).toBeTruthy();
    expect(saveTutorManual).not.toHaveBeenCalled();
  });
});
