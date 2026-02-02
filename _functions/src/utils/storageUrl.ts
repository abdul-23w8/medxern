import type { Bucket } from "@google-cloud/storage";

export async function makePublicAndGetUrl(bucket: Bucket, objectPath: string): Promise<string> {
  const file = bucket.file(objectPath);

  // Make public for demo (anyone with URL can access)
  // If object already public, this is fine.
  await file.makePublic();

  // Public URL format for GCS
  // NOTE: objectPath must be URL-encoded for safety
  const encoded = encodeURIComponent(objectPath).replace(/%2F/g, "/");
  return `https://storage.googleapis.com/${bucket.name}/${encoded}`;
}
