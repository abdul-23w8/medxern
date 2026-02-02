/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/reports/publicShare.ts
//
// Client-side helper to ensure the demo "public share" doc exists.
// Firestore: publicShares/{shareId}
// shareId is stable: SHARE-{patientId}

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PublicShareDoc } from "./reportTypes";

export const stableShareIdForPatient = (patientId: string) => `SHARE-${patientId}`;

export async function ensurePublicShare(params: {
  patientId: string; // shortId
  shareId?: string;  // optional override
}) {
  const shareId = params.shareId ?? stableShareIdForPatient(params.patientId);
  const ref = doc(db, "publicShares", shareId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const payload: PublicShareDoc = {
      patientId: params.patientId,
      createdAt: serverTimestamp() as any,
      active: true,
      mode: "public_demo",
    };

    await setDoc(ref, payload, { merge: true });
    return { shareId, data: payload };
  }

  return { shareId, data: snap.data() as PublicShareDoc };
}

export function buildShareUrl(shareId: string) {
  if (typeof window === "undefined") return `/share/${shareId}`;
  return `${window.location.origin}/share/${shareId}`;
}
