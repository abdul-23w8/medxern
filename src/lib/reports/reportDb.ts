/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/reports/reportDb.ts
//
// Client-side Firestore helpers for:
// - Creating report docs after upload
// - Listing reports
// - Reading doctor snapshot
//
// Firestore layout:
// users/{patientId}/reports/{reportId}
// users/{patientId}/doctorSnapshot/current

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { DoctorSnapshot, ReportDoc, ReportStatus, ReportType } from "./reportTypes";

/** Internal helper: report doc ref */
export function reportRef(patientId: string, reportId: string) {
  return doc(db, `users/${patientId}/reports/${reportId}`);
}

/** Internal helper: reports collection ref */
export function reportsCol(patientId: string) {
  return collection(db, `users/${patientId}/reports`);
}

/**
 * Create / initialize a report doc (status: uploaded).
 * NOTE: do NOT store patientId inside the doc (it's implied by the path).
 */
export async function createReportDoc(params: {
  patientId: string; // shortId e.g. PAT-7K3Q9M (used for path only)
  reportId: string;

  // file info
  fileName: string;
  storagePath: string; // reports/{patientId}/{reportId}.{ext}
  contentType: string;
  size: number;

  // metadata
  reportType: ReportType;
  providerName?: string;
  reportDate?: string | null; // YYYY-MM-DD
}) {
  const ref = reportRef(params.patientId, params.reportId);

  // payload matches ReportDoc
  const payload: Partial<ReportDoc> & { uploadedAt: any; updatedAt: any } = {
    fileName: params.fileName,
    storagePath: params.storagePath,
    contentType: params.contentType,
    size: params.size,

    reportType: params.reportType,
    providerName: params.providerName || "",
    reportDate: params.reportDate ?? null,

    status: "uploaded" as ReportStatus,
    error: null,

    uploadedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
  return ref;
}

/** Patch / update any report fields safely. */
export async function updateReportDoc(params: {
  patientId: string;
  reportId: string;
  patch: Partial<ReportDoc>;
}) {
  const ref = reportRef(params.patientId, params.reportId);
  await setDoc(
    ref,
    {
      ...params.patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return ref;
}

/** Read one report doc. */
export async function getReportDoc(params: { patientId: string; reportId: string }) {
  const ref = reportRef(params.patientId, params.reportId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as DocumentData) } as ReportDoc & { id: string };
}

/**
 * List latest reports for a patient.
 * Sort by uploadedAt (fallback to createdAt for older docs if any).
 */
export async function listReports(params: { patientId: string; pageSize?: number }) {
  const { patientId, pageSize = 50 } = params;

  // Primary sort field = uploadedAt (your UploadModal writes this)
  const col = reportsCol(patientId);
  const q = query(col, orderBy("uploadedAt", "desc"), limit(pageSize));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as Array<
    ReportDoc & { id: string }
  >;
}

/** Read current doctor snapshot. */
export async function getDoctorSnapshot(params: { patientId: string }) {
  const ref = doc(db, `users/${params.patientId}/doctorSnapshot/current`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as DoctorSnapshot;
}
