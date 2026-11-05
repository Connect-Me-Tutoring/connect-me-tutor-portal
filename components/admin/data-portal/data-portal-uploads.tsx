"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  importDataset,
  listDatasets,
  previewDataset,
} from "@/lib/actions/data-portal/uploads.actions";
import {
  MAX_UPLOAD_BYTES,
  UPLOADS_BUCKET,
  datasetNameFromFilename,
  datasetNameSchema,
  datasetTitleFromFilename,
  parseCsvForImport,
  storagePathFor,
  type DatasetPreview,
  type DatasetSummary,
} from "@/lib/data-portal/uploads";
import styles from "./data-portal.module.css";

/**
 * Uploaded data: CSVs an admin adds, kept as shared tables for every admin.
 *
 * The file goes straight to the private bucket from here, and the server
 * then builds the table from that stored copy. Uploading under a name that
 * already exists replaces that table; the earlier file stays in the bucket.
 */

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; datasets: DatasetSummary[] };

function fileId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${crypto.randomUUID().slice(0, 8)}`;
}

export function DataPortalUploads() {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const refresh = async () => {
    let outcome: Awaited<ReturnType<typeof listDatasets>>;
    try {
      outcome = await listDatasets();
    } catch {
      outcome = { ok: false, error: "Uploaded data could not be loaded." };
    }
    setList(
      outcome.ok
        ? { status: "ready", datasets: outcome.datasets }
        : { status: "error", message: outcome.error },
    );
  };

  useEffect(() => {
    // Strict mode mounts effects twice in development; load once.
    if (started.current) return;
    started.current = true;
    void refresh();
  }, []);

  const existing =
    list.status === "ready" ? list.datasets.find((dataset) => dataset.name === name) : undefined;
  const nameValid = datasetNameSchema.safeParse(name).success;

  const choose = (chosen: File | null) => {
    setError(null);
    setNotice(null);
    setFile(chosen);
    if (!chosen) return;
    setName(datasetNameFromFilename(chosen.name));
    setTitle(datasetTitleFromFilename(chosen.name));
  };

  const reset = () => {
    setFile(null);
    setName("");
    setTitle("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async () => {
    if (!file || pending) return;
    setError(null);
    setNotice(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a .csv file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("The file is larger than 25 MB.");
      return;
    }
    if (!nameValid) {
      setError(
        "Use lowercase letters, numbers and underscores for the name, starting with a letter.",
      );
      return;
    }
    if (!title.trim()) {
      setError("Give the dataset a title.");
      return;
    }

    setPending(true);
    try {
      // Checked here first so a file that cannot be imported is never kept.
      // The server checks the stored copy again.
      const parsed = parseCsvForImport(await file.text());
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }

      const storagePath = storagePathFor(name, fileId());
      const { error: storageError } = await createClient()
        .storage.from(UPLOADS_BUCKET)
        .upload(storagePath, file, { contentType: "text/csv", upsert: false });
      if (storageError) {
        setError("The file could not be uploaded. Try again in a moment.");
        return;
      }

      const outcome = await importDataset({
        name,
        title: title.trim(),
        storagePath,
        filename: file.name,
      });
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }

      setNotice(
        `${outcome.dataset.title}: ${outcome.dataset.rowCount.toLocaleString()} rows and ${outcome.dataset.columns.length} columns saved as uploads.${outcome.dataset.name}.`,
      );
      reset();
      setPreview(null);
      await refresh();
    } catch {
      setError("The upload could not be saved. Try again in a moment.");
    } finally {
      setPending(false);
    }
  };

  const togglePreview = async (datasetName: string) => {
    if (preview?.name === datasetName) {
      setPreview(null);
      return;
    }
    setPreviewing(datasetName);
    try {
      const outcome = await previewDataset(datasetName);
      if (outcome.ok) setPreview(outcome.preview);
      else setError(outcome.error);
    } catch {
      setError("This dataset could not be loaded.");
    } finally {
      setPreviewing(null);
    }
  };

  return (
    <section aria-labelledby="dp-uploads-heading" className={`${styles.card} ${styles.uploads}`}>
      <div className={styles.cardHead}>
        <h2 id="dp-uploads-heading" className={styles.cardTitle}>
          Uploaded data
        </h2>
        <span className={styles.cardMeta}>admins only · shared with every admin</span>
      </div>

      <div className={styles.uploadForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>CSV file</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className={styles.fileInput}
            disabled={pending}
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
        </label>

        {file && (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Table name</span>
              <input
                className={styles.textInput}
                value={name}
                maxLength={48}
                disabled={pending}
                onChange={(event) => setName(event.target.value.toLowerCase())}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Title</span>
              <input
                className={styles.textInput}
                value={title}
                maxLength={120}
                disabled={pending}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 self-end border-black/15 bg-white/60"
              disabled={pending || !nameValid || !title.trim()}
              onClick={() => void upload()}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {existing ? "Replace" : "Upload"}
            </Button>
          </>
        )}
      </div>

      {file && existing && !pending && (
        <p className={styles.uploadNote}>
          This replaces {existing.title} ({existing.rowCount.toLocaleString()} rows). The earlier
          file is kept.
        </p>
      )}
      {error ? <p className={styles.chatError}>{error}</p> : null}
      {notice ? <p className={styles.uploadNote}>{notice}</p> : null}

      <div className={styles.datasets}>
        {list.status === "loading" ? (
          <p className={styles.uploadNote}>Loading uploaded data...</p>
        ) : list.status === "error" ? (
          <p className={styles.chatError}>{list.message}</p>
        ) : list.datasets.length === 0 ? (
          <p className={styles.emptyNote}>No data has been uploaded yet.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.datasetTable}`}>
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Table</th>
                  <th scope="col">Rows</th>
                  <th scope="col">Columns</th>
                  <th scope="col">Uploaded</th>
                  <th scope="col">
                    <span className="sr-only">Preview</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.datasets.map((dataset) => (
                  <tr key={dataset.name}>
                    <th scope="row">
                      {dataset.title}
                      <span className={styles.datasetFile}>{dataset.originalFilename}</span>
                    </th>
                    <td className={styles.mono}>uploads.{dataset.name}</td>
                    <td>{dataset.rowCount.toLocaleString()}</td>
                    <td>{dataset.columns.length}</td>
                    <td>
                      {new Date(dataset.uploadedAt).toLocaleDateString()}
                      {dataset.uploadedBy ? ` · ${dataset.uploadedBy}` : ""}
                      {dataset.versions > 1 ? ` · ${dataset.versions} versions` : ""}
                    </td>
                    <td>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={previewing !== null}
                        onClick={() => void togglePreview(dataset.name)}
                      >
                        {previewing === dataset.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : preview?.name === dataset.name ? (
                          "Hide"
                        ) : (
                          "Preview"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && (
        <div className={styles.preview}>
          <p className={styles.uploadNote}>
            First {preview.rows.length} of {preview.rowCount.toLocaleString()} rows of uploads.
            {preview.name}
          </p>
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.previewTable}`}>
              <thead>
                <tr>
                  {preview.columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((value, cell) => (
                      <td key={cell}>{value ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
