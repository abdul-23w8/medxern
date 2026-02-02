/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePatientUI } from "@/hooks/usePatientUI";

import { db, storage } from "@/lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable } from "firebase/storage";

type UIReportType =
  | "Lab Report"
  | "Prescription"
  | "Imaging"
  | "Discharge Summary"
  | "Other";

// maps UI label -> canonical ReportType (matches reportTypes.ts)
function toCanonicalReportType(t: UIReportType) {
  switch (t) {
    case "Lab Report":
      return "lab";
    case "Prescription":
      return "prescription";
    case "Imaging":
      return "scan";
    case "Discharge Summary":
      return "discharge";
    default:
      return "other";
  }
}

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function makeId(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function extFromName(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "bin";
}

function contentTypeFallback(file: File) {
  if (file.type) return file.type;
  const ext = extFromName(file.name);
  if (ext === "pdf") return "application/pdf";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`;
  return "application/octet-stream";
}

/**
 * Pull shortId from localStorage (as per your auth.ts caching).
 * Replace this if you already have patientId from context/hook.
 */
function getPatientId(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("medxern_shortid_cache_v1") ||
    localStorage.getItem("medxern_patient_id") ||
    null
  );
}

export default function UploadModal() {
  const { isUploadOpen, closeUpload } = usePatientUI();

  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [reportType, setReportType] = useState<UIReportType>("Lab Report");
  const [providerName, setProviderName] = useState("");
  const [reportDate, setReportDate] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const title = useMemo(
    () => (files.length ? `${files.length} file(s) selected` : "Upload report"),
    [files.length]
  );

  const resetLocalState = () => {
    setDragOver(false);
    setFiles([]);
    setReportType("Lab Report");
    setProviderName("");
    setReportDate("");
    setIsUploading(false);
    setProgressPct(0);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetLocalState();
    closeUpload();
  };

  useEffect(() => {
    if (!isUploadOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading) handleClose();
    };

    document.addEventListener("keydown", onKeyDown);

    // lock scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploadOpen, isUploading]);

  if (!isUploadOpen) return null;

  const onPickFiles = () => fileInputRef.current?.click();

  const addFiles = (incoming: FileList | File[]) => {
    const next = Array.from(incoming).filter(Boolean);
    if (!next.length) return;

    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of next) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) merged.push(f);
      }
      return merged;
    });
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  async function uploadSingleFile(params: {
    patientId: string;
    file: File;
    uiReportType: UIReportType;
    providerName: string;
    reportDate: string;
  }) {
    const { patientId, file, uiReportType, providerName, reportDate } = params;

    const reportId = `${Date.now()}-${makeId(6)}`;
    const ext = extFromName(file.name);
    const storagePath = `reports/${patientId}/${reportId}.${ext}`;

    const contentType = contentTypeFallback(file);
    const canonicalType = toCanonicalReportType(uiReportType);

    // 1) Create Firestore doc first (so UI can list immediately)
    const reportRef = doc(db, `users/${patientId}/reports/${reportId}`);
    await setDoc(
      reportRef,
      {
        fileName: file.name,
        storagePath,
        contentType,
        size: file.size,

        // canonical fields (matches reportTypes.ts)
        reportType: canonicalType,
        providerName: providerName || "",
        reportDate: reportDate || null,

        uploadedAt: serverTimestamp(),
        status: "uploaded",
        error: null,
      },
      { merge: true }
    );

    // 2) Upload to Storage (finalize trigger will run)
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, { contentType });

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct = snap.totalBytes
            ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            : 0;
          setProgressPct(pct);
        },
        (err) => reject(err),
        () => resolve()
      );
    });

    // 3) Mark processing (function will later set processed/error)
    await setDoc(
      reportRef,
      { status: "processing", updatedAt: serverTimestamp() },
      { merge: true }
    );

    return { reportId, storagePath };
  }

  const onUpload = async () => {
    setErrorMsg(null);

    const patientId = getPatientId();
    if (!patientId) {
      setErrorMsg("Patient ID not found. Please login again (shortId not available).");
      return;
    }

    if (!files.length) return;

    setIsUploading(true);
    setProgressPct(0);

    try {
      // sequential upload (clear progress)
      for (let i = 0; i < files.length; i++) {
        setProgressPct(0);
        await uploadSingleFile({
          patientId,
          file: files[i],
          uiReportType: reportType,
          providerName,
          reportDate,
        });
      }

      handleClose();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Upload failed. Please try again.");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={() => {
          if (!isUploading) handleClose();
        }}
        aria-hidden="true"
      />

      {/* modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upload report"
          className="w-full max-w-xl rounded-2xl border border-black/10 bg-white shadow-2xl"
        >
          {/* header */}
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
            <div>
              <div className="text-sm text-black/50">MEDXERN</div>
              <h2 className="text-lg font-semibold text-black/90">{title}</h2>
            </div>
            <button
              onClick={() => {
                if (!isUploading) handleClose();
              }}
              className={cn(
                "rounded-xl px-3 py-2 text-sm text-black/60 hover:bg-black/5",
                isUploading && "cursor-not-allowed opacity-50 hover:bg-transparent"
              )}
              disabled={isUploading}
            >
              Close
            </button>
          </div>

          {/* body */}
          <div className="space-y-4 p-5">
            {errorMsg ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                {errorMsg}
              </div>
            ) : null}

            {/* progress */}
            {isUploading ? (
              <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-black/80">Uploading…</div>
                  <div className="text-xs text-black/60">{progressPct}%</div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10">
                  <div className="h-full bg-teal-700 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="mt-2 text-xs text-black/50">Don’t close this window.</div>
              </div>
            ) : null}

            {/* dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!isUploading) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                if (!isUploading) onDrop(e);
              }}
              className={cn(
                "rounded-2xl border border-dashed p-5 transition",
                dragOver
                  ? "border-teal-400 bg-teal-50/60"
                  : "border-black/15 bg-gradient-to-b from-white to-teal-50/30",
                isUploading && "pointer-events-none opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-black/80">Add medical documents</div>
                  <div className="mt-1 text-sm text-black/55">
                    Drag & drop files here, or browse to select. PDF, images, or documents.
                  </div>
                </div>
                <button
                  onClick={onPickFiles}
                  disabled={isUploading}
                  className={cn(
                    "shrink-0 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90",
                    isUploading && "cursor-not-allowed opacity-60 hover:opacity-60"
                  )}
                >
                  Browse
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                }}
                disabled={isUploading}
              />

              {!!files.length && (
                <div className="mt-4 space-y-2">
                  {files.map((f, idx) => (
                    <div
                      key={`${f.name}:${f.size}:${idx}`}
                      className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-black/80">{f.name}</div>
                        <div className="text-xs text-black/50">{Math.ceil(f.size / 1024)} KB</div>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        disabled={isUploading}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs text-black/60 hover:bg-black/5",
                          isUploading && "cursor-not-allowed opacity-60 hover:bg-transparent"
                        )}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* metadata */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <div className="text-xs font-medium text-black/60">Report type</div>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as UIReportType)}
                  disabled={isUploading}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200 disabled:opacity-60"
                >
                  <option>Lab Report</option>
                  <option>Prescription</option>
                  <option>Imaging</option>
                  <option>Discharge Summary</option>
                  <option>Other</option>
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs font-medium text-black/60">Report date</div>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  disabled={isUploading}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200 disabled:opacity-60"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <div className="text-xs font-medium text-black/60">Provider / Hospital (optional)</div>
                <input
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="e.g., Apollo Clinic, Dr. Sharma"
                  disabled={isUploading}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200 disabled:opacity-60"
                />
              </label>
            </div>
          </div>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-black/5 px-5 py-4">
            <div className="text-xs text-black/50">
              Your files stay private. Sharing always requires your permission.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                disabled={isUploading}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm text-black/70 hover:bg-black/5",
                  isUploading && "cursor-not-allowed opacity-60 hover:bg-transparent"
                )}
              >
                Cancel
              </button>
              <button
                onClick={onUpload}
                disabled={!files.length || isUploading}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium text-white",
                  files.length && !isUploading ? "bg-teal-700 hover:opacity-90" : "bg-black/30 cursor-not-allowed"
                )}
              >
                {isUploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
