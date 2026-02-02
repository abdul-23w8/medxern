"use client";

import React, { useEffect, useMemo, useState } from "react";
import ChatSidebar from "./ChatSidebar";
import ChatThread from "./ChatThread";

import {
  createChat,
  deleteChat,
  renameChat,
  resetChat,
  sendMessageAndGetAssistantReply,
  subscribeChats,
  subscribeMessages,
  type ChatMessage,
  type ChatSummary,
} from "@/lib/chat/firestoreChat";

import { subscribeToAuth, type Session } from "@/lib/Auth";

/* -------------------------------
 * Helpers
 * ------------------------------*/

function wantsLocation(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("near") ||
    t.includes("nearby") ||
    t.includes("closest") ||
    t.includes("hospital") ||
    t.includes("clinic") ||
    t.includes("doctor") ||
    t.includes("pharmacy") ||
    t.includes("emergency") ||
    t.includes("ambulance")
  );
}

function seemsUrgent(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("chest pain") ||
    t.includes("can't breathe") ||
    t.includes("trouble breathing") ||
    t.includes("heavy bleeding") ||
    t.includes("fracture") ||
    t.includes("broken") ||
    t.includes("unconscious") ||
    t.includes("seizure")
  );
}

/* -------------------------------
 * Component
 * ------------------------------*/

export default function AssistantScreen() {
  const [session, setSession] = useState<Session | null>(null);

  const shortId = session?.shortId ?? null;

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<"idle" | "requesting" | "granted" | "denied">("idle");

  /* -------------------------------
   * Auth
   * ------------------------------*/
  useEffect(() => {
    return subscribeToAuth(setSession);
  }, []);

  /* -------------------------------
   * Chats
   * ------------------------------*/
  useEffect(() => {
    if (!shortId) return;

    return subscribeChats(shortId, (list) => {
      setChats(list);
      setActiveChatId((prev) =>
        prev && list.some((c) => c.id === prev) ? prev : list[0]?.id ?? null
      );
    });
  }, [shortId]);

  /* -------------------------------
   * Messages
   * ------------------------------*/
  useEffect(() => {
    if (!shortId || !activeChatId) {
      setMessages([]);
      return;
    }
    return subscribeMessages(shortId, activeChatId, setMessages);
  }, [shortId, activeChatId]);

  /* -------------------------------
   * Location
   * ------------------------------*/
  async function requestLocation(): Promise<{ lat: number; lng: number } | null> {
    if (location) return location;
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return null;
    }

    setLocationStatus("requesting");

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setLocation(loc);
          setLocationStatus("granted");
          resolve(loc);
        },
        () => {
          setLocationStatus("denied");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  /* -------------------------------
   * Send message
   * ------------------------------*/
  async function handleSend() {
    if (!shortId || !draft.trim()) return;

    const text = draft.trim();
    setDraft("");
    setSending(true);

    try {
      let chatId = activeChatId;
      if (!chatId) {
        chatId = await createChat(shortId, "New chat");
        setActiveChatId(chatId);
      }

      const history = messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let loc = location;
      if (!loc && (wantsLocation(text) || seemsUrgent(text))) {
        loc = await requestLocation();
      }

      await sendMessageAndGetAssistantReply({
        shortId,
        chatId,
        text,
        history,
        location: loc,
        threadMedicalContext: chats.find((c) => c.id === chatId)?.isMedicalContext ?? false,
      });
    } finally {
      setSending(false);
    }
  }

  /* -------------------------------
   * UI helpers
   * ------------------------------*/
  const activeTitle =
    chats.find((c) => c.id === activeChatId)?.title ?? "MEDXERN Assistant";

  /* -------------------------------
   * RENDER
   * ------------------------------*/

  if (!session?.user) {
    return (
      <div className="rounded-xl border p-6 text-sm text-gray-600">
        Please sign in to use the medical assistant.
      </div>
    );
  }

  if (!shortId) {
    return (
      <div className="rounded-xl border p-6">
        <div className="font-semibold">Account setup incomplete</div>
        <div className="text-sm text-gray-500 mt-1">
          Please log out and log in again to complete setup.
        </div>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="rounded-xl border p-6">
        <h2 className="font-semibold text-lg">AI Medical Assistant</h2>
        <p className="text-sm text-gray-600 mt-1">
          Ask about symptoms, injuries, or nearby medical help.
        </p>
        <button
          onClick={() => createChat(shortId, "New chat")}
          className="mt-4 rounded-lg bg-black text-white px-4 py-2"
        >
          Start chat
        </button>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-220px)] grid-cols-[320px_1fr] gap-4">
      <ChatSidebar
        chats={chats}
        activeId={activeChatId}
        onNew={() => createChat(shortId, "New chat")}
        onSelect={setActiveChatId}
        onRename={(id, t) => renameChat(shortId, id, t)}
        onDelete={(id) => deleteChat(shortId, id)}
      />

      <ChatThread
        title={activeTitle}
        messages={messages}
        draft={draft}
        setDraft={setDraft}
        sending={sending}
        onSend={handleSend}
        onReset={() => activeChatId && resetChat(shortId, activeChatId)}
        onRequestLocation={requestLocation}
        locationStatus={locationStatus}
      />
    </div>
  );
}
