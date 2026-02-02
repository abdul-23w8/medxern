// src/lib/createProfileWithShortId.ts

import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

type UserRole = "patient" | "doctor";

export type UserProfileData = {
  name: string;
  email: string;
  dob?: string; // "YYYY-MM-DD"
};

export type CreateProfileInput = {
  role: UserRole;
  phone?: string; // e.g. +9198xxxxxxx
  profile: UserProfileData;
};

/**
 * Short, readable, non-confusing alphabet:
 * - No 0/O and 1/I to avoid confusion.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Secure shortId generator using Web Crypto.
 * Example outputs:
 *  - PAT-7K3Q9M2H
 *  - DOC-X8P2Z7QW
 */
export function makeShortId(role: UserRole, length = 8): string {
  const prefix = role === "doctor" ? "DOC" : "PAT";

  // Web Crypto (available in modern browsers & Next.js client)
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let token = "";
  for (let i = 0; i < bytes.length; i++) {
    token += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return `${prefix}-${token}`;
}

/**
 * Creates:
 *  1) users/{shortId}  (main user doc, with uid inside)
 *  2) uidMap/{uid}     (mapping uid -> shortId for fast lookup after login)
 *  3) publicIds/{shortId} (registry to guarantee uniqueness)
 *
 * IMPORTANT:
 * - Keep Firebase Auth UID as the real identity.
 * - shortId is for readability and user-facing display.
 */
export async function createProfileWithShortId(
  db: Firestore,
  user: { uid: string },
  input: CreateProfileInput
): Promise<{ shortId: string }> {
  const role = input.role ?? "patient";

  // Atomic transaction: guarantees uniqueness + consistent writes
  const result = await runTransaction(db, async (tx) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const shortId = makeShortId(role, 8);

      const publicIdRef = doc(db, "publicIds", shortId);
      const existing = await tx.get(publicIdRef);

      if (existing.exists()) continue; // collision, retry

      // Reserve shortId (uniqueness registry)
      tx.set(publicIdRef, {
        uid: user.uid,
        role,
        createdAt: serverTimestamp(),
      });

      // uid -> shortId mapping
      tx.set(doc(db, "uidMap", user.uid), {
        shortId,
        role,
        updatedAt: serverTimestamp(),
      });

      // Main user doc stored under users/{shortId}
      tx.set(doc(db, "users", shortId), {
        uid: user.uid,
        shortId,
        role,
        phone: input.phone ?? "",
        profile: {
          name: input.profile?.name ?? "",
          email: input.profile?.email ?? "",
          dob: input.profile?.dob ?? "",
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { shortId };
    }

    throw new Error("Failed to generate a unique shortId. Please retry.");
  });

  return result;
}
