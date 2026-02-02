"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

export type ReportStatus = "processing" | "uploaded" | "failed";

export type ReportItem = {
  id: string;

  // display
  title: string; // usually fileName
  kind: string; // e.g. "Lab Report", "Imaging", etc (don’t over-restrict)
  provider?: string | null;
  uploadedAt: string; // readable date string (already formatted in list)

  // backend/meta
  status: ReportStatus; // from Firestore: "processing" | "uploaded"
  mimeType?: string;
  storagePath?: string;

  // optional convenience fields
  downloadURL?: string | null;

  // optional UI meta (as in your screenshot)
  uiMeta?: {
    reportType?: string | null;
    providerName?: string | null;
    reportDate?: string | null; // "YYYY-MM-DD"
  };

  // optional route approach
  detailsHref?: string; // if provided, clicking View details navigates
};

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function fileTypeLabel(mime?: string, title?: string) {
  const t = (mime || "").toLowerCase();
  const n = (title || "").toLowerCase();
  if (t.includes("pdf") || n.endsWith(".pdf")) return "PDF";
  if (t.includes("image") || n.match(/\.(png|jpg|jpeg|webp)$/)) return "Image";
  return "Document";
}

function pillStyle(status: ReportStatus) {
  if (status === "uploaded") return "bg-teal-50 text-teal-800 border-teal-100";
  if (status === "failed") return "bg-red-50 text-red-700 border-red-100";
  return "bg-amber-50 text-amber-800 border-amber-100"; // processing
}

function pillText(status: ReportStatus) {
  if (status === "uploaded") return "uploaded";
  if (status === "failed") return "failed";
  return "processing";
}

function prettyProvider(item: ReportItem) {
  return item.provider ?? item.uiMeta?.providerName ?? "—";
}

function prettyKind(item: ReportItem) {
  return item.kind || item.uiMeta?.reportType || "Document";
}

export default function ReportCard({
  item,
  onOpenDetails,
}: {
  item: ReportItem;
  onOpenDetails?: (item: ReportItem) => void; // optional: parent-controlled modal
}) {
  const [open, setOpen] = useState(false);

  const hasDownload = !!item.downloadURL;
  const typeChip = useMemo(
    () => fileTypeLabel(item.mimeType, item.title),
    [item.mimeType, item.title]
  );

  const provider = prettyProvider(item);
  const kind = prettyKind(item);

  const detailsAction = () => {
    if (onOpenDetails) return onOpenDetails(item);
    setOpen(true);
  };

  return (
    <>
      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition hover:border-black/20">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-black/85">
              {item.title}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55">
              <span>{kind}</span>
              <span className="text-black/25">•</span>
              <span className="truncate">{provider}</span>
              <span className="text-black/25">•</span>
              <span>{item.uploadedAt}</span>

              <span className="ml-1 rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] text-black/60">
                {typeChip}
              </span>
            </div>
          </div>

          {/* Status pill */}
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium border",
              pillStyle(item.status)
            )}
          >
            {pillText(item.status)}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between">
          {/* View details: route OR modal */}
          {item.detailsHref ? (
            <Link
              href={item.detailsHref}
              className="group inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-black/70 hover:bg-black/5"
            >
              <span className="group-hover:underline">View details</span>
              <span className="text-black/40">→</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={detailsAction}
              className="group inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-black/70 hover:bg-black/5"
            >
              <span className="group-hover:underline">View details</span>
              <span className="text-black/40">→</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-black/40">
              {hasDownload ? "Ready" : "Storage pending"}
            </span>

            {hasDownload ? (
              <a
                href={item.downloadURL!}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl px-3 py-2 text-sm text-black/70 hover:bg-black/5"
                title="Open download in a new tab"
              >
                Download
              </a>
            ) : (
              <button
                disabled
                className="rounded-xl px-3 py-2 text-sm text-black/35 cursor-not-allowed"
                title="Download will be available once a secure URL is generated."
              >
                Download
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Local Modal (only if parent isn’t controlling it) */}
      {!onOpenDetails && open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-black/85">
                  {item.title}
                </div>
                <div className="mt-1 text-sm text-black/55">
                  {kind} • {provider}
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm text-black/70 hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm">
              <Row k="Status" v={pillText(item.status)} />
              <Row k="Uploaded" v={item.uploadedAt} />
              <Row k="Type" v={typeChip} />
              <Row k="MIME" v={item.mimeType ?? "—"} />
              <Row k="Storage path" v={item.storagePath ?? "—"} />
              <Row k="Report date" v={item.uiMeta?.reportDate ?? "—"} />
            </div>

            {item.downloadURL ? (
              <div className="mt-4 flex justify-end">
                <a
                  href={item.downloadURL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Open / Download
                </a>
              </div>
            ) : (
              <div className="mt-4 text-xs text-black/50">
                Download isn’t ready yet (no secure URL saved). You can still see
                metadata above.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-black/50">{k}</div>
      <div className="max-w-[70%] break-words text-right text-black/80">{v}</div>
    </div>
  );
}
