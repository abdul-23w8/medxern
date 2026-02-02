/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Firestore } from "firebase-admin/firestore";
import { reportsCollectionRef, doctorSnapshotRef } from "../utils/firestorePaths";
import { aiBuildDoctorSnapshot, type ExtractedReportAI } from "./openai";

type ReportDoc = {
  fileName?: string;
  uploadedAt?: any;
  status?: string;
  ai?: ExtractedReportAI;
  publicUrl?: string;
  reportId?: string;
  reportDate?: string | null;
  reportType?: string;
};

function toISODateMaybe(ts: any): string | null {
  try {
    if (!ts) return null;
    // Firestore Timestamp has toDate()
    if (typeof ts.toDate === "function") return ts.toDate().toISOString();
    // JS Date
    if (ts instanceof Date) return ts.toISOString();
    return null;
  } catch {
    return null;
  }
}

export async function rebuildDoctorSnapshot(db: Firestore, patientId: string, limit = 20) {
  const reportsCol = reportsCollectionRef(db, patientId);

  const snap = await reportsCol.orderBy("uploadedAt", "desc").limit(limit).get();

  const reports: Array<{ reportId: string; fileName: string; uploadedAtISO: string | null; ai: ExtractedReportAI }> = [];
  const reportRefs: Array<{ reportId: string; fileName: string; reportType?: string; reportDate?: string | null; publicUrl?: string }> = [];

  snap.forEach((doc) => {
    const data = doc.data() as ReportDoc;
    if (!data || data.status !== "done" || !data.ai) return;

    const fileName = data.fileName ?? doc.id;
    reports.push({
      reportId: doc.id,
      fileName,
      uploadedAtISO: toISODateMaybe(data.uploadedAt),
      ai: data.ai
    });

    reportRefs.push({
      reportId: doc.id,
      fileName,
      reportType: data.ai.reportType,
      reportDate: data.ai.reportDate,
      publicUrl: data.publicUrl
    });
  });

  // If nothing processed yet, skip
  if (reports.length === 0) return;

  const snapshot = await aiBuildDoctorSnapshot({ patientId, reports });

  await doctorSnapshotRef(db, patientId).set(
    {
      updatedAt: new Date(),
      ...snapshot,
      reportRefs
    },
    { merge: true }
  );
}
