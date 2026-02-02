// functions/src/index.ts
/**
 * Import function triggers from their respective submodules:
 *
 * import { onCall } from "firebase-functions/v2/https";
 * import { onDocumentWritten } from "firebase-functions/v2/firestore";
 *
 * See supported triggers:
 * https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";

// ✅ Apply defaults to v2 functions (your onObjectFinalized trigger is v2)
setGlobalOptions({
  maxInstances: 10,
  region: "asia-south1", // keep consistent with your bucket + latency
});

// ✅ Storage finalize trigger (AI pipeline entrypoint)
export { onReportUpload } from "./triggers/onReportUpload";

// (Optional) Add more exports later, e.g. doctor snapshot refresh, share revoke, etc.
// export { refreshDoctorSnapshot } from "./triggers/refreshDoctorSnapshot";
// export { revokeShare } from "./triggers/revokeShare";
