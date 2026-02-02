"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { stableShareIdForPatient } from "@/lib/reports/publicShare";

type Props = {
  patientId: string; // shortId like PAT-7K3Q9M
};

export default function PatientShareQrCard({ patientId }: Props) {
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const shareId = useMemo(
    () => stableShareIdForPatient(patientId),
    [patientId]
  );

  useEffect(() => {
    const initShare = async () => {
      try {
        const ref = doc(db, "publicShares", shareId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            patientId,
            createdAt: serverTimestamp(),
            active: true,
            mode: "public_demo",
          });
        }

        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}/share/${shareId}`
            : `/share/${shareId}`;

        setShareUrl(url);
      } catch (err) {
        console.error("Failed to init share:", err);
      } finally {
        setLoading(false);
      }
    };

    initShare();
  }, [patientId, shareId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-40 w-40 animate-pulse rounded-xl bg-white/10" />
      </div>
    );
  }

  if (!shareUrl) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
        Failed to generate share link.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold text-white">
        Doctor Share QR
      </div>

      <p className="mt-1 text-xs text-white/60">
        Doctor can scan this to view medical summary
      </p>

      <div className="mt-4 flex flex-col items-center gap-4">
        <div className="rounded-xl bg-white p-3">
          <QRCodeCanvas value={shareUrl} size={160} />
        </div>

        <div className="w-full">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <input
              readOnly
              value={shareUrl}
              className="w-full bg-transparent text-white/80 outline-none"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-white/50">
        This link shows a read-only medical snapshot.
      </div>
    </div>
  );
}
