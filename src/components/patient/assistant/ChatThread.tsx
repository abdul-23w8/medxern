// src/components/patient/assistant/ChatThread.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import type { ChatMessage } from "@/lib/chat/firestoreChat";

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function ChatThread({
  title,
  messages,
  sending,
  draft,
  setDraft,
  onSend,
  onReset,
  onRequestLocation,
}: {
  title: string;
  messages: ChatMessage[];
  sending: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onReset: () => void;
  /** Kept for fallback UX: user can explicitly try enabling location */
  onRequestLocation: () => Promise<{ lat: number; lng: number } | null>;
  locationStatus?: "idle" | "requesting" | "granted" | "denied";
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // tiny UX state: shows a hint if location permission was denied/unavailable
  const [locHint, setLocHint] = useState<null | "denied" | "unavailable">(null);

  // scroll to bottom when messages change
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const placeholder = useMemo(
    () =>
      "Describe symptoms/injury, meds, or ask about urgency & next steps. (Non-medical questions are refused.)",
    []
  );

  async function handleSend() {
    if (!draft.trim() || sending) return;
    // Location is requested automatically by AssistantScreen on Send when needed
    onSend();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleLocationFallbackClick() {
    const loc = await onRequestLocation().catch(() => null);
    if (!loc) {
      setLocHint(navigator.geolocation ? "denied" : "unavailable");
    } else {
      setLocHint(null);
    }
  }

  // Detect if assistant is asking for location (simple heuristic)
  const lastAssistant = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    return (last?.content ?? "").toLowerCase();
  }, [messages]);

  const assistantRequestedLocation = useMemo(() => {
    return (
      lastAssistant.includes("need location") ||
      lastAssistant.includes("your location") ||
      lastAssistant.includes("location permission") ||
      lastAssistant.includes("tell me your city") ||
      lastAssistant.includes("to show nearby") ||
      lastAssistant.includes("nearby hospitals") ||
      lastAssistant.includes("nearby clinics")
    );
  }, [lastAssistant]);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-black/5 bg-white/70 shadow-sm backdrop-blur">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
        <div>
          <div className="text-xs text-black/45">MEDXERN</div>
          <div className="text-base font-semibold text-black/85">{title}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Show location button only when it's actually needed */}
          {assistantRequestedLocation && (
            <button
              onClick={() => void handleLocationFallbackClick()}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/70 hover:bg-black/5"
              title="Allow location so I can suggest nearby hospitals/clinics."
            >
              Enable location
            </button>
          )}

          <button
            onClick={onReset}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/70 hover:bg-black/5"
          >
            Reset chat
          </button>
        </div>
      </div>

      {/* optional location hint */}
      {assistantRequestedLocation && locHint && (
        <div className="border-b border-black/5 px-5 py-3 text-xs text-black/60">
          {locHint === "unavailable" ? (
            <span>
              Location isn’t available in this browser. You can type your <b>city/area</b> and I’ll
              still try to help.
            </span>
          ) : (
            <span>
              Location access was denied. You can enable it in browser settings, or type your{" "}
              <b>city/area</b>.
            </span>
          )}
        </div>
      )}

      {/* message list */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="rounded-3xl border border-black/10 bg-gradient-to-b from-white to-teal-50/30 p-6 text-sm text-black/65">
            <div className="font-semibold text-black/80">How can I help?</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>First-aid steps and what to do immediately</li>
              <li>When to seek emergency care</li>
              <li>Which specialist to consult</li>
              <li>Nearby clinics/hospitals (asked automatically when needed)</li>
            </ul>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} meta={m.meta} />
          ))
        )}

        {sending && <div className="text-xs text-black/40">MEDXERN Assistant is thinking…</div>}
      </div>

      {/* composer */}
      <div className="border-t border-black/5 px-5 py-4">
        <div className="flex items-end gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={placeholder}
            className={cn(
              "min-h-[44px] w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none",
              "focus:ring-2 focus:ring-teal-200"
            )}
          />

          <button
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className={cn(
              "shrink-0 rounded-2xl px-4 py-3 text-sm font-medium text-white",
              sending || !draft.trim()
                ? "cursor-not-allowed bg-black/30"
                : "bg-teal-700 hover:opacity-90"
            )}
          >
            Send
          </button>
        </div>

        <div className="mt-2 text-[11px] text-black/45">
          Not a doctor • No diagnosis • Emergency symptoms → seek immediate care.
        </div>
      </div>
    </div>
  );
}
