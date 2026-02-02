"use client";

import React, { useMemo, useState } from "react";
import type { ChatSummary } from "@/lib/chat/firestoreChat";

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function ChatSidebar({
  chats,
  activeId,
  onNew,
  onSelect,
  onRename,
  onDelete,
}: {
  chats: ChatSummary[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return chats;
    return chats.filter((c) => (c.title ?? "").toLowerCase().includes(t));
  }, [q, chats]);

  return (
    <aside className="h-full rounded-3xl border border-black/5 bg-white/70 shadow-sm backdrop-blur">
      <div className="border-b border-black/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-black/45">MEDXERN</div>
            <div className="text-sm font-semibold text-black/80">Chats</div>
          </div>

          <button
            onClick={onNew}
            className="rounded-xl bg-black px-3 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            New
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats…"
          className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200"
        />
      </div>

      <div className="max-h-[calc(100%-84px)] overflow-auto p-2">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-black/55">No chats yet.</div>
        ) : (
          <div className="space-y-1">
            {filtered.map((c) => {
              const active = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center justify-between gap-2 rounded-2xl px-3 py-2 transition",
                    active ? "bg-teal-50/60 ring-1 ring-teal-200" : "hover:bg-black/5"
                  )}
                >
                  <button
                    onClick={() => onSelect(c.id)}
                    className="min-w-0 flex-1 text-left"
                    title={c.title}
                  >
                    <div className="truncate text-sm font-medium text-black/80">
                      {c.title || "New chat"}
                    </div>
                    <div className="truncate text-xs text-black/45">{c.lastMessage || "—"}</div>
                  </button>

                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => {
                        const next = window.prompt("Rename chat", c.title || "New chat");
                        if (next != null) onRename(c.id, next);
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-black/60 hover:bg-black/5"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("Delete this chat?")) onDelete(c.id);
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-black/60 hover:bg-black/5"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
