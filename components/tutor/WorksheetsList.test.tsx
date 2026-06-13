import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockList = vi.fn();
const mockDownload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockUpload = vi.fn();
const mockFrom = vi.fn();

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    storage: {
      from: mockFrom,
    },
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: toastSuccess,
    error: toastError,
  },
}));

const { default: WorksheetsList } = await import("./WorksheetsList");

describe("WorksheetsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      list: mockList,
      download: mockDownload,
      getPublicUrl: mockGetPublicUrl,
      upload: mockUpload,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it("copies worksheet link when share is clicked", async () => {
    mockList.mockResolvedValue({
      data: [{ name: "math-sheet.pdf" }],
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/math-sheet.pdf" },
    });

    render(<WorksheetsList />);

    await screen.findByText("math-sheet.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://example.com/math-sheet.pdf",
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("Worksheet link copied!");
  });

  it("uploads a selected worksheet", async () => {
    mockList
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ name: "Worksheet-1.pdf" }], error: null });
    mockUpload.mockResolvedValue({ error: null });

    render(<WorksheetsList />);

    const uploadInput = screen.getByLabelText("Upload worksheet");
    const file = new File(["worksheet"], "Worksheet 1.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(uploadInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Post Worksheet" }));

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
    });

    const [uploadedPath, uploadedFile, uploadedOptions] = mockUpload.mock.calls[0];
    expect(uploadedPath).toMatch(/Worksheet-1\.pdf$/);
    expect(uploadedFile).toBe(file);
    expect(uploadedOptions).toEqual({ upsert: false });
    expect(toastSuccess).toHaveBeenCalledWith("Worksheet posted");
  });
});
