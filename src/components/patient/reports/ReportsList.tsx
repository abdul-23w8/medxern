/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReportCard, { ReportItem } from "@/components/patient/reports/ReportCard";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";

import { auth, db, storage } from "@/lib/firebase";

type ReportDoc = {
  // what you ACTUALLY have in Firestore (from your screenshot)
  fileName?: string;
  mimeType?: string;
  status?: "processing" | "uploaded" | "failed";
  storagePath?: string;
  downloadURL?: string | null;

  uploadedAt?: Timestamp | string | number | null;
  createdAt?: Timestamp | null;

  uiMeta?: {
    providerName?: string | null;
    reportType?: string | null;
    reportDate?: string | null; // "YYYY-MM-DD"
  };

  // legacy/optional fields
  title?: string;
  kind?: string;
  provider?: string;
};

function formatUploadedAt(v: ReportDoc["uploadedAt"]): string {
  if (!v) return "—";
  if (typeof v === "object" && "toDate" in v) {
    const d = (v as Timestamp).toDate();
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }
  if (typeof v === "string") return v;
  if (typeof v === "number") {
    const d = new Date(v);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }
  return "—";
}

async function getShortIdFromUid(uid: string): Promise<string | null> {
  const ref = doc(db, "uidMap", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { shortId?: string };
  return data.shortId ?? null;
}

// ✅ turn on/off caching of downloadURL into Firestore
const CACHE_DOWNLOAD_URL = true;

export default function ReportsList() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const countLabel = useMemo(
    () => `${items.length} reports in your vault`,
    [items.length]
  );

  useEffect(() => {
    setLoading(true);
    setErr(null);

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setItems([]);
      setErr(null);

      if (!user) {
        setLoading(false);
        setErr("Not signed in.");
        return;
      }

      try {
        const shortId = await getShortIdFromUid(user.uid);
        if (!shortId) {
          setLoading(false);
          setErr("No shortId found for this account (uidMap missing).");
          return;
        }

        const colRef = collection(db, "users", shortId, "reports");
        const qRef = query(colRef, orderBy("uploadedAt", "desc"));

        const unsubReports = onSnapshot(
          qRef,
          async (snap) => {
            try {
              const next: ReportItem[] = await Promise.all(
                snap.docs.map(async (docSnap) => {
                  const data = docSnap.data() as ReportDoc;

                  // ✅ Pick best available display fields
                  const title =
                    data.title ??
                    data.fileName ??
                    "Untitled report";

                  const kind =
                    data.kind ??
                    data.uiMeta?.reportType ??
                    "Document";

                  const provider =
                    data.provider ??
                    data.uiMeta?.providerName ??
                    "—";

                  const uploadedAt = formatUploadedAt(
                    data.uploadedAt ?? data.createdAt ?? null
                  );

                  // ✅ status for pill (processing/uploaded/failed)
                  const status = (data.status ?? "processing") as any;

                  // ✅ downloadURL: use stored one OR fetch from Storage using storagePath
                  let downloadURL: string | null = data.downloadURL ?? null;

                  if (!downloadURL && data.storagePath) {
                    try {
                      downloadURL = await getDownloadURL(
                        storageRef(storage, data.storagePath)
                      );

                      // ✅ cache URL in Firestore once (optional)
                      if (CACHE_DOWNLOAD_URL) {
                        await updateDoc(docSnap.ref, { downloadURL });
                      }
                    } catch (e) {
                      // If this fails, it’s usually Storage rules OR file missing
                      downloadURL = null;
                    }
                  }

                  return {
                    id: docSnap.id,
                    title,
                    kind,
                    provider,
                    uploadedAt,
                    status,

                    // ✅ extra fields used by the updated ReportCard
                    mimeType: data.mimeType ?? "",
                    storagePath: data.storagePath ?? "",
                    downloadURL,
                    uiMeta: data.uiMeta ?? {},
                  } as any;
                })
              );

              setItems(next);
              setLoading(false);
            } catch (e: any) {
              console.error(e);
              setErr(e?.message || "Failed to process reports.");
              setLoading(false);
            }
          },
          (e) => {
            console.error(e);
            setErr(e.message || "Failed to load reports.");
            setLoading(false);
          }
        );

        return () => unsubReports();
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Failed to resolve user reports.");
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <button
          className="rounded-xl px-3 py-2 text-sm text-black/70 hover:bg-black/5"
          disabled
          title="Filters coming soon"
        >
          Filters
        </button>

        <span className="text-xs text-black/40">
          {loading ? "Loading…" : countLabel}
        </span>
      </div>

      {/* States */}
      {err ? (
        <div className="rounded-3xl border border-red-200 bg-white p-6">
          <div className="text-base font-semibold text-red-700">
            Couldn’t load reports
          </div>
          <div className="mt-1 text-sm text-red-700/80">{err}</div>
          <div className="mt-3 text-xs text-red-700/70">
            If downloads don’t work, it’s usually Firebase Storage rules blocking read access.
          </div>
        </div>
      ) : loading ? (
        <div className="rounded-3xl border border-black/10 bg-white p-8">
          <div className="text-base font-semibold text-black/70">
            Loading your reports…
          </div>
          <div className="mt-1 text-sm text-black/45">Fetching from your vault.</div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-black/10 bg-gradient-to-b from-white to-teal-50/30 p-8 text-center">
          <div className="text-base font-semibold text-black/80">
            No reports uploaded yet
          </div>
          <div className="mt-1 text-sm text-black/55">
            Upload medical documents using the Upload button above.
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <ReportCard key={item.id} item={item as any} />
          ))}
        </div>
      )}
    </div>
  );
}
