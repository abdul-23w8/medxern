/* eslint-disable @typescript-eslint/no-explicit-any */

import { onObjectFinalized } from "firebase-functions/v2/storage";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { parseReportUploadPath } from "../utils/parsePath";
import { reportDocRef, publicShareRef, stableShareIdForPatient } from "../utils/firestorePaths";
import { makePublicAndGetUrl } from "../utils/storageUrl";
import { extractAndAnalyze } from "../services/extract";
import { rebuildDoctorSnapshot } from "../services/snapshot";

setGlobalOptions({ region: "asia-south1" }); // change if needed
initializeApp();

export const onReportUpload = onObjectFinalized(
  {
    memory: "1GiB",
    timeoutSeconds: 300,
    cpu: 1
  },
  async (event) => {
    const object = event.data;
    const objectName = object.name;
    if (!objectName) return;

    const parsed = parseReportUploadPath(objectName);
    if (!parsed) return;

    const { patientId, reportId } = parsed;

    const db = getFirestore();
    const storage = getStorage();
    const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET); // if undefined, uses default

    const contentType = object.contentType || "application/octet-stream";
    const fileName = objectName.split("/").pop() || objectName;

    const reportRef = reportDocRef(db, patientId, reportId);

    // mark processing
    await reportRef.set(
      {
        fileName,
        mimeType: contentType,
        storagePath: objectName,
        uploadedAt: FieldValue.serverTimestamp(),
        status: "processing"
      },
      { merge: true }
    );

    try {
      // Download file buffer
      const [buf] = await bucket.file(objectName).download();

      // Make file public (demo) and store URL
      const publicUrl = await makePublicAndGetUrl(bucket, objectName);

      // Extract + analyze
      const { ai, extractedText } = await extractAndAnalyze({ buffer: buf, contentType, fileName });

      await reportRef.set(
        {
          status: "done",
          publicUrl,
          ai,
          extractedText: extractedText ?? null,
          processedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // Ensure a stable public share doc exists for this patient
      const shareId = stableShareIdForPatient(patientId);
      const shareRef = publicShareRef(db, shareId);
      const shareSnap = await shareRef.get();
      if (!shareSnap.exists) {
        await shareRef.set({
          patientId,
          createdAt: FieldValue.serverTimestamp(),
          mode: "public_demo",
          active: true
        });
      }

      // Rebuild snapshot
      await rebuildDoctorSnapshot(db, patientId, 20);
    } catch (err: any) {
      await reportRef.set(
        {
          status: "error",
          error: String(err?.message ?? err),
          failedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }
  }
);
