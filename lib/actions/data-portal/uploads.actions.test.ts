import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireAdmin } from "../auth/authz.server";
import { createClient } from "@/lib/supabase/server";

vi.mock("../auth/authz.server", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const { importDataset, listDatasets, previewDataset } = await import("./uploads.actions");

const requireAdminMock = requireAdmin as ReturnType<typeof vi.fn>;
const createClientMock = createClient as ReturnType<typeof vi.fn>;

const PATH = "datasets/tutor_applications/2026-11-04T10-00-00-000Z-ab12cd34.csv";
const INPUT = {
  name: "tutor_applications",
  title: "Tutor applications",
  storagePath: PATH,
  filename: "tutor-applications.csv",
};

type RpcResult = { data?: unknown; error?: { message: string } | null };

function stubClient({
  csv = "Name,Grade\nAna,9\nLee,10\n",
  download = null as { message: string } | null,
  rpc = {} as Record<string, RpcResult>,
} = {}) {
  const rpcMock = vi.fn<(fn: string, args?: unknown) => Promise<RpcResult>>(async (fn) => {
    const result = rpc[fn] ?? { data: fn === "data_portal_begin_upload" ? "upload-1" : null };
    return { data: result.data ?? null, error: result.error ?? null };
  });
  const downloadMock = vi.fn(async () =>
    download ? { data: null, error: download } : { data: new Blob([csv]), error: null },
  );
  const from = vi.fn(() => ({ download: downloadMock }));
  createClientMock.mockResolvedValue({ rpc: rpcMock, storage: { from } });
  return { rpc: rpcMock, from, download: downloadMock };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ user: { id: "admin-1" }, profile: { role: "Admin" } });
});

describe("importDataset", () => {
  it("refuses before any database or storage work when requireAdmin throws", async () => {
    requireAdminMock.mockRejectedValue(new Error("nope"));
    const { rpc, download } = stubClient();

    expect(await importDataset(INPUT)).toEqual({
      ok: false,
      error: "Uploaded data is limited to administrators.",
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("refuses a file outside the dataset's own folder", async () => {
    const { download } = stubClient();
    const outcome = await importDataset({ ...INPUT, storagePath: "datasets/other/x.csv" });
    expect(outcome.ok).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it("builds the table from the stored file: begin, rows, finish", async () => {
    const { rpc, from, download } = stubClient();

    const outcome = await importDataset(INPUT);

    expect(outcome).toEqual({
      ok: true,
      dataset: {
        name: "tutor_applications",
        title: "Tutor applications",
        rowCount: 2,
        columns: ["name", "grade"],
      },
    });
    expect(from).toHaveBeenCalledWith("data-portal-uploads");
    expect(download).toHaveBeenCalledWith(PATH);
    expect(rpc.mock.calls.map(([fn]) => fn)).toEqual([
      "data_portal_begin_upload",
      "data_portal_append_upload_rows",
      "data_portal_finish_upload",
    ]);
    expect(rpc).toHaveBeenCalledWith("data_portal_begin_upload", {
      p_name: "tutor_applications",
      p_title: "Tutor applications",
      p_columns: ["name", "grade"],
      p_storage_path: PATH,
      p_filename: "tutor-applications.csv",
    });
    expect(rpc).toHaveBeenCalledWith("data_portal_append_upload_rows", {
      p_upload_id: "upload-1",
      p_rows: [
        ["Ana", "9"],
        ["Lee", "10"],
      ],
    });
  });

  it("sends large files in chunks", async () => {
    const rows = Array.from({ length: 4500 }, (_, i) => `row${i}`).join("\n");
    const { rpc } = stubClient({ csv: `value\n${rows}\n` });

    expect((await importDataset(INPUT)).ok).toBe(true);
    const appends = rpc.mock.calls.filter(([fn]) => fn === "data_portal_append_upload_rows");
    expect(appends.map(([, args]) => (args as { p_rows: unknown[] }).p_rows.length)).toEqual([
      2000, 2000, 500,
    ]);
  });

  it("explains what is wrong with a malformed file and creates nothing", async () => {
    const { rpc } = stubClient({ csv: "a,b\n1,2\n3\n" });
    expect(await importDataset(INPUT)).toEqual({
      ok: false,
      error: "Row 3 has 1 values but the header has 2.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cancels the import when a chunk is refused, leaving the old table in place", async () => {
    const { rpc } = stubClient({
      rpc: { data_portal_append_upload_rows: { error: { message: "boom" } } },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await importDataset(INPUT);

    expect(outcome).toEqual({
      ok: false,
      error: "The upload could not be saved. Try again in a moment.",
    });
    expect(rpc).toHaveBeenCalledWith("data_portal_cancel_upload", { p_upload_id: "upload-1" });
    expect(rpc).not.toHaveBeenCalledWith("data_portal_finish_upload", expect.anything());
  });

  it("reports the database's admin refusal as a denial", async () => {
    stubClient({
      rpc: { data_portal_begin_upload: { error: { message: "Admin access required" } } },
    });
    expect(await importDataset(INPUT)).toEqual({
      ok: false,
      error: "Uploaded data is limited to administrators.",
    });
  });
});

describe("listDatasets and previewDataset", () => {
  it("refuses non-admins", async () => {
    requireAdminMock.mockRejectedValue(new Error("nope"));
    const { rpc } = stubClient();
    expect((await listDatasets()).ok).toBe(false);
    expect((await previewDataset("tutor_applications")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns validated datasets", async () => {
    const dataset = {
      name: "tutor_applications",
      title: "Tutor applications",
      columns: ["name"],
      rowCount: 2,
      originalFilename: "tutor-applications.csv",
      uploadedAt: "2026-11-04T10:00:00Z",
      uploadedBy: "Ada Admin",
      versions: 1,
    };
    stubClient({ rpc: { data_portal_list_datasets: { data: [dataset] } } });
    expect(await listDatasets()).toEqual({ ok: true, datasets: [dataset] });
  });

  it("treats an unexpected payload as an error", async () => {
    stubClient({ rpc: { data_portal_list_datasets: { data: [{ name: 1 }] } } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await listDatasets()).ok).toBe(false);
  });

  it("never sends an invalid name to the database", async () => {
    const { rpc } = stubClient();
    expect(await previewDataset('x"; drop table y; --')).toEqual({
      ok: false,
      error: "Unknown dataset.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
