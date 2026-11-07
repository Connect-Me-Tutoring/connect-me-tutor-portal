"use server";

import { requireAdmin } from "../auth/authz.server";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_UPLOAD_BYTES,
  ROWS_PER_CHUNK,
  UPLOADS_BUCKET,
  chunk,
  datasetListSchema,
  datasetNameSchema,
  datasetPreviewSchema,
  datasetTitleSchema,
  isStoragePathFor,
  parseCsvForImport,
  type DatasetPreview,
  type DatasetSummary,
} from "@/lib/data-portal/uploads";

/**
 * Admin-only actions behind the Data Portal's uploaded data.
 *
 * The browser puts the original CSV in the private bucket itself (the storage
 * policies let only Active Admins add files, into a dataset's own folder).
 * importDataset then reads that stored file back, so the table is always
 * built from exactly the file that was kept, and loads it through the
 * database functions in chunks.
 *
 * As with the overview, requireAdmin() here is the usual gate and the
 * database functions hold the authoritative one: each decides from auth.uid()
 * on the caller's own session. Errors returned to the client say what was
 * wrong with the file, never what went wrong inside the database.
 */

const DENIED = "Uploaded data is limited to administrators.";
const FAILED = "The upload could not be saved. Try again in a moment.";

type Outcome<T> = ({ ok: true } & T) | { ok: false; error: string };

async function adminClient() {
  try {
    await requireAdmin();
  } catch {
    return null;
  }
  return createClient();
}

function deniedOr(message: string, error: { message: string }) {
  if (error.message.includes("Admin access required")) return DENIED;
  console.error("[data-portal] Upload call failed.", { message: error.message });
  return message;
}

export const importDataset = async (input: {
  name: string;
  title: string;
  storagePath: string;
  filename: string;
}): Promise<
  Outcome<{ dataset: { name: string; title: string; rowCount: number; columns: string[] } }>
> => {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: DENIED };

  const name = datasetNameSchema.safeParse(input.name);
  if (!name.success) return { ok: false, error: "That dataset name is not allowed." };
  const title = datasetTitleSchema.safeParse(input.title);
  if (!title.success)
    return { ok: false, error: "Give the dataset a title of up to 120 characters." };
  if (!isStoragePathFor(name.data, input.storagePath)) {
    return { ok: false, error: "The uploaded file could not be found." };
  }
  const filename = input.filename.slice(0, 255) || "upload.csv";

  const { data: file, error: downloadError } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .download(input.storagePath);
  if (downloadError || !file) {
    console.error("[data-portal] Reading the uploaded file failed.", {
      message: downloadError?.message,
    });
    return { ok: false, error: "The uploaded file could not be read back." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "The file is larger than 25 MB." };
  }

  const parsed = parseCsvForImport(await file.text());
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { data: uploadId, error: beginError } = await supabase.rpc("data_portal_begin_upload", {
    p_name: name.data,
    p_title: title.data,
    p_columns: parsed.columns,
    p_storage_path: input.storagePath,
    p_filename: filename,
  });
  if (beginError || !uploadId) {
    return { ok: false, error: beginError ? deniedOr(FAILED, beginError) : FAILED };
  }

  for (const rows of chunk(parsed.rows, ROWS_PER_CHUNK)) {
    const { error } = await supabase.rpc("data_portal_append_upload_rows", {
      p_upload_id: uploadId,
      p_rows: rows,
    });
    if (error) {
      await supabase.rpc("data_portal_cancel_upload", { p_upload_id: uploadId });
      return { ok: false, error: deniedOr(FAILED, error) };
    }
  }

  const { error: finishError } = await supabase.rpc("data_portal_finish_upload", {
    p_upload_id: uploadId,
  });
  if (finishError) {
    await supabase.rpc("data_portal_cancel_upload", { p_upload_id: uploadId });
    return { ok: false, error: deniedOr(FAILED, finishError) };
  }

  return {
    ok: true,
    dataset: {
      name: name.data,
      title: title.data,
      rowCount: parsed.rows.length,
      columns: parsed.columns,
    },
  };
};

export const listDatasets = async (): Promise<Outcome<{ datasets: DatasetSummary[] }>> => {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: DENIED };

  const { data, error } = await supabase.rpc("data_portal_list_datasets");
  if (error) return { ok: false, error: deniedOr("Uploaded data could not be loaded.", error) };

  const parsed = datasetListSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[data-portal] Dataset list failed validation.");
    return { ok: false, error: "Uploaded data could not be loaded." };
  }
  return { ok: true, datasets: parsed.data };
};

export const previewDataset = async (
  name: string,
): Promise<Outcome<{ preview: DatasetPreview }>> => {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: DENIED };

  const parsedName = datasetNameSchema.safeParse(name);
  if (!parsedName.success) return { ok: false, error: "Unknown dataset." };

  const { data, error } = await supabase.rpc("data_portal_dataset_preview", {
    p_name: parsedName.data,
    p_limit: 25,
  });
  if (error) return { ok: false, error: deniedOr("This dataset could not be loaded.", error) };

  const parsed = datasetPreviewSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[data-portal] Dataset preview failed validation.");
    return { ok: false, error: "This dataset could not be loaded." };
  }
  return { ok: true, preview: parsed.data };
};
