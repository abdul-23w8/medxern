import type { Firestore } from "firebase-admin/firestore";

export function reportDocRef(db: Firestore, patientId: string, reportId: string) {
  return db.doc(`users/${patientId}/reports/${reportId}`);
}

export function reportsCollectionRef(db: Firestore, patientId: string) {
  return db.collection(`users/${patientId}/reports`);
}

export function doctorSnapshotRef(db: Firestore, patientId: string) {
  return db.doc(`users/${patientId}/doctorSnapshot/current`);
}

export function publicShareRef(db: Firestore, shareId: string) {
  return db.doc(`publicShares/${shareId}`);
}

/**
 * For demo: keep shareId stable per patient so QR doesn't change.
 */
export function stableShareIdForPatient(patientId: string) {
  return `SHARE-${patientId}`;
}
