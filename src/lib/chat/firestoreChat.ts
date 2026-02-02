// src/lib/chat/firestoreChat.ts
"use client";

/**
 * ✅ MEDXERN Assistant Chat Persistence (Firestore)
 *
 * - Uses users/{shortId}/assistantChats/... (shortId doc key)
 * - Supports roles: "system" | "user" | "assistant"
 * - Stores sticky thread flag: isMedicalContext
 * - Stores assistant meta: places + gate decision
 * - Chunked deletes (500 ops) for reset/delete
 * - Sends history + threadMedicalContext (+ shortId + chatId) to /api/assistant
 * - ✅ Adds guards to prevent runtime crashes
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  setDoc,
  type Unsubscribe,
  type Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/Auth"; // consider moving to "@/lib/firebase" if that's your canonical db export

/** ---------- Types ---------- */

export type PlaceResult = {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  userRatingCount?: number;
  phone?: string;
  website?: string;
  googleMapsUri?: string;
  openNow?: boolean;
};

export type GateLabel = "ALLOW_MEDICAL" | "REJECT_NON_MEDICAL";

export type AssistantMeta = {
  places?: PlaceResult[];
  provider?: string;
  gate?: {
    label: GateLabel;
    reason?: string;
  };
};

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: Timestamp;
  meta?: AssistantMeta;
};

export type ChatSummary = {
  id: string;
  title: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastMessage?: string;

  /** Sticky context: once true, follow-ups can be allowed even without medical keywords */
  isMedicalContext?: boolean;
};

/** ---------- Guards ---------- */

function assertId(name: string, v: string) {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`[firestoreChat] Missing ${name}`);
  }
  return v;
}

/** ---------- Firestore paths ---------- */

function userDoc(shortId: string) {
  return doc(db, "users", assertId("shortId", shortId));
}

function chatsCol(shortId: string) {
  return collection(db, "users", assertId("shortId", shortId), "assistantChats");
}

function chatDoc(shortId: string, chatId: string) {
  return doc(
    db,
    "users",
    assertId("shortId", shortId),
    "assistantChats",
    assertId("chatId", chatId)
  );
}

function messagesCol(shortId: string, chatId: string) {
  return collection(
    db,
    "users",
    assertId("shortId", shortId),
    "assistantChats",
    assertId("chatId", chatId),
    "messages"
  );
}

/** ---------- Chat CRUD ---------- */

export async function createChat(shortId: string, title = "New chat") {
  const ref = await addDoc(chatsCol(shortId), {
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "",
    isMedicalContext: false,
  });
  return ref.id;
}

export function subscribeChats(shortId: string, cb: (chats: ChatSummary[]) => void): Unsubscribe {
  const q = query(chatsCol(shortId), orderBy("updatedAt", "desc"), limit(50));
  return onSnapshot(q, (snap) => {
    const chats: ChatSummary[] = snap.docs.map((d) => {
      const data = d.data() as Omit<ChatSummary, "id">;
      return { id: d.id, ...data };
    });
    cb(chats);
  });
}

export function subscribeMessages(
  shortId: string,
  chatId: string,
  cb: (messages: ChatMessage[]) => void
): Unsubscribe {
  const q = query(messagesCol(shortId, chatId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const msgs: ChatMessage[] = snap.docs.map((d) => {
      const data = d.data() as Omit<ChatMessage, "id">;
      return { id: d.id, ...data };
    });
    cb(msgs);
  });
}

export async function renameChat(shortId: string, chatId: string, title: string) {
  await updateDoc(chatDoc(shortId, chatId), {
    title: title.trim() || "New chat",
    updatedAt: serverTimestamp(),
  });
}

/** ---------- Delete helpers (chunked) ---------- */

async function deleteAllMessages(shortId: string, chatId: string) {
  while (true) {
    const snap = await getDocs(query(messagesCol(shortId, chatId), limit(500)));
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteChat(shortId: string, chatId: string) {
  await deleteAllMessages(shortId, chatId);
  await deleteDoc(chatDoc(shortId, chatId));
}

export async function resetChat(shortId: string, chatId: string) {
  await deleteAllMessages(shortId, chatId);

  await updateDoc(chatDoc(shortId, chatId), {
    updatedAt: serverTimestamp(),
    lastMessage: "",
    isMedicalContext: false,
  });
}

/** ---------- Optional: store last location client-side too ---------- */
/** This is optional but useful so you can reuse location even before backend persistence is finished. */
async function saveLastKnownLocationClient(shortId: string, loc: { lat: number; lng: number }) {
  await setDoc(
    userDoc(shortId),
    {
      lastKnownLocation: {
        lat: loc.lat,
        lng: loc.lng,
        updatedAt: serverTimestamp(),
      },
    },
    { merge: true }
  );
}

/** ---------- Message writing ---------- */

async function addMessage(params: {
  shortId: string;
  chatId: string;
  role: ChatRole;
  content: string;
  meta?: AssistantMeta;
}) {
  const { shortId, chatId, role, content, meta } = params;

  await addDoc(messagesCol(shortId, chatId), {
    role,
    content,
    ...(meta ? { meta } : {}), // ✅ don't store null; store nothing if absent
    createdAt: serverTimestamp(),
  });

  await updateDoc(chatDoc(shortId, chatId), {
    updatedAt: serverTimestamp(),
    lastMessage: content.slice(0, 160),
  });
}

/** ---------- Send flow ---------- */

export async function sendMessageAndGetAssistantReply(args: {
  shortId: string;
  chatId: string;
  text: string;
  history: Array<{ role: ChatRole; content: string }>;
  location?: { lat: number; lng: number } | null;
  threadMedicalContext?: boolean;
}) {
  const { shortId, chatId, text, history, location, threadMedicalContext } = args;

  const trimmed = text.trim();
  if (!trimmed) return;

  assertId("shortId", shortId);
  assertId("chatId", chatId);

  // ✅ If location exists, persist it (optional but helpful)
  if (location?.lat && location?.lng) {
    saveLastKnownLocationClient(shortId, location).catch(() => {});
  }

  // 1) store user message
  await addMessage({ shortId, chatId, role: "user", content: trimmed });

  // 2) call server route (✅ FIX: include shortId + chatId so backend can store location)
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shortId, // ✅ critical
      chatId,  // ✅ critical
      message: trimmed,
      history: history.slice(-12),
      location: location ?? null,
      threadMedicalContext: threadMedicalContext ?? false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    await addMessage({
      shortId,
      chatId,
      role: "assistant",
      content: "I couldn’t process that request right now. Please try again in a moment.",
    });
    // eslint-disable-next-line no-console
    console.error("assistant api error:", res.status, errText);
    return;
  }

  const data = (await res.json()) as { reply?: string; meta?: AssistantMeta };

  // 3) store assistant reply
  await addMessage({
    shortId,
    chatId,
    role: "assistant",
    content:
      (data.reply ?? "").trim() ||
      "I can help with medical questions. Please share symptoms/injury details (duration, severity, age, meds/allergies).",
    meta: data.meta,
  });

  // 4) Update sticky thread medical context
  if (data.meta?.gate?.label === "ALLOW_MEDICAL") {
    await updateDoc(chatDoc(shortId, chatId), {
      isMedicalContext: true,
      updatedAt: serverTimestamp(),
    });
  }
}
