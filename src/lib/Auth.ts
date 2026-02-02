// src/lib/Auth.ts
"use client";

/**
 * ✅ MEDXERN Auth + Firestore helpers (CANONICAL)
 *
 * Schema:
 * - users/{shortId}               (primary profile doc)
 * - uidMap/{uid} -> { shortId }   (login lookup)
 * - publicIds/{shortId} (optional)
 *
 * Notes:
 * - Firebase Auth UID remains the true identity.
 * - This file re-exports `auth` and `db` (single source of truth).
 * - Provides subscribeToAuth() returning { user, role, shortId }.
 * - Provides helpers to create/ensure profile docs in the new schema.
 */

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export { auth, db };

export type Role = "patient" | "doctor";

/** ---------- Local cache (UX only) ---------- */
const ROLE_KEY = "medxern_role_cache_v2";
const SHORTID_KEY = "medxern_shortid_cache_v1";

function setCachedRole(role: Role) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_KEY, role);
}

export function getCachedRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ROLE_KEY);
  return v === "patient" || v === "doctor" ? v : null;
}

function setCachedShortId(shortId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHORTID_KEY, shortId);
}

export function getCachedShortId(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(SHORTID_KEY);
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function clearCachedAuthMeta() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(SHORTID_KEY);
}

/** ---------- Firestore lookups (new schema) ---------- */
/**
 * uidMap/{uid} -> { shortId }
 */
export async function getShortIdByUid(uid: string): Promise<string | null> {
  const ref = doc(db, "uidMap", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as { shortId?: unknown };
  const shortId = typeof data.shortId === "string" ? data.shortId : null;

  if (shortId) setCachedShortId(shortId);
  return shortId;
}

/**
 * users/{shortId} -> { role, ... }
 */
export async function getUserRoleByShortId(shortId: string): Promise<Role | null> {
  const ref = doc(db, "users", shortId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as { role?: unknown };
  const role = data.role === "patient" || data.role === "doctor" ? data.role : null;

  if (role) setCachedRole(role);
  return role;
}

/**
 * Convenience: get role starting from Firebase UID.
 * Flow:
 *   uid -> shortId (uidMap) -> role (users)
 */
export async function getUserRole(uid: string): Promise<Role | null> {
  const shortId = (await getShortIdByUid(uid)) ?? getCachedShortId();
  if (!shortId) return getCachedRole();
  const roleFromDb = await getUserRoleByShortId(shortId);
  return roleFromDb ?? getCachedRole();
}

/**
 * Update role in users/{shortId}.
 * Requires uidMap/{uid} to exist.
 */
export async function setUserRole(uid: string, role: Role): Promise<Role> {
  const shortId = await getShortIdByUid(uid);
  if (!shortId) {
    throw new Error("No uidMap entry found. Create uidMap/{uid}->{shortId} at signup.");
  }

  await setDoc(
    doc(db, "users", shortId),
    {
      role,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  setCachedRole(role);
  return role;
}

/** ---------- Profile creation / ensure helpers ---------- */

function makeShortId(role: Role) {
  const prefix = role === "patient" ? "PAT" : "DOC";
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${token}`;
}

/**
 * Ensure BOTH:
 * - uidMap/{uid} exists -> { shortId }
 * - users/{shortId} exists with role + uid
 *
 * Use this at signup completion (OTP verified).
 */
export async function ensureUserProfile(params: {
  uid: string;
  role: Role;
  phone?: string;
  shortId?: string; // optional if you want to provide one
  createPublicId?: boolean; // optional
}) {
  const { uid, role, phone, createPublicId } = params;

  // 1) Resolve or create shortId
  let shortId = await getShortIdByUid(uid);
  if (!shortId) {
    shortId = params.shortId ?? makeShortId(role);
    await setDoc(doc(db, "uidMap", uid), { shortId }, { merge: true });
    setCachedShortId(shortId);
  }

  // 2) Ensure users/{shortId}
  const userRef = doc(db, "users", shortId);
  const userSnap = await getDoc(userRef);

  const base = {
    uid,
    shortId,
    role,
    phone: phone ?? null,
    updatedAt: serverTimestamp(),
    ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
  };

  await setDoc(userRef, base, { merge: true });
  setCachedRole(role);

  // 3) Optional: publicIds/{shortId}
  if (createPublicId) {
    await setDoc(
      doc(db, "publicIds", shortId),
      {
        shortId,
        uid,
        role,
        updatedAt: serverTimestamp(),
        ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );
  }

  return { shortId, role };
}

/**
 * Backward-compatible helper name (older code used ensureUserRole).
 * Now targets users/{shortId}, not users/{uid}.
 */
export async function ensureUserRole(uid: string, role: Role) {
  const shortId = await getShortIdByUid(uid);
  if (!shortId) {
    throw new Error("No uidMap entry found. You must create shortId at account creation.");
  }

  const userRef = doc(db, "users", shortId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(
      userRef,
      {
        uid,
        shortId,
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    const data = snap.data() as { role?: unknown };
    const existing = data.role === "patient" || data.role === "doctor" ? data.role : null;
    if (existing !== role) {
      await setDoc(userRef, { role, updatedAt: serverTimestamp() }, { merge: true });
    }
  }

  setCachedRole(role);
  return role;
}

/** ---------- Session helpers ---------- */

export type Session = {
  user: User;
  role: Role | null;
  shortId: string | null;
};

export function subscribeToAuth(cb: (session: Session | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearCachedAuthMeta();
      cb(null);
      return;
    }

    const shortIdFromDb = await getShortIdByUid(user.uid);
    const shortId = shortIdFromDb ?? getCachedShortId();

    let role: Role | null = null;
    if (shortId) {
      const roleFromDb = await getUserRoleByShortId(shortId);
      role = roleFromDb ?? getCachedRole();
    } else {
      role = getCachedRole();
    }

    cb({ user, role, shortId });
  });
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function logout() {
  await signOut(auth);
  clearCachedAuthMeta();
}

/** ---------- Utility ---------- */
/**
 * Utility: normalize phone input to E.164-ish.
 * For India: +91XXXXXXXXXX
 */
export function normalizePhone(input: string) {
  const v = input.trim();
  if (!v) return v;
  if (v.startsWith("+")) return v;
  if (/^\d{10}$/.test(v)) return `+91${v}`;
  return v;
}
