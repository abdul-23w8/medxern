"use client";

import React from "react";
import type { AssistantMeta, ChatRole, PlaceResult } from "@/lib/chat/firestoreChat";

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function PlaceCard({ p }: { p: PlaceResult }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white px-3 py-3">
      <div className="text-sm font-semibold text-black/85">{p.name}</div>
      {p.address && <div className="mt-1 text-xs text-black/55">{p.address}</div>}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-black/60">
        {typeof p.rating === "number" && (
          <span className="rounded-full bg-black/5 px-2 py-1">⭐ {p.rating}</span>
        )}
        {typeof p.userRatingCount === "number" && (
          <span className="rounded-full bg-black/5 px-2 py-1">{p.userRatingCount} reviews</span>
        )}
        {typeof p.openNow === "boolean" && (
          <span
            className={cn(
              "rounded-full px-2 py-1",
              p.openNow ? "bg-teal-50 text-teal-800" : "bg-black/5 text-black/60"
            )}
          >
            {p.openNow ? "Open now" : "Closed"}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {p.googleMapsUri && (
          <a
            href={p.googleMapsUri}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/70 hover:bg-black/5"
          >
            Open in Maps
          </a>
        )}
        {p.website && (
          <a
            href={p.website}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/70 hover:bg-black/5"
          >
            Website
          </a>
        )}
      </div>
    </div>
  );
}

export default function MessageBubble({
  role,
  content,
  meta,
}: {
  role: ChatRole;
  content: string;
  meta?: AssistantMeta;
}) {
  const isUser = role === "user";
  const places = meta?.places;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-black text-white shadow-sm"
            : "bg-white border border-black/10 text-black/80 shadow-sm"
        )}
      >
        <div className="whitespace-pre-wrap">{content}</div>

        {!!places?.length && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-black/50">Nearby options</div>
            <div className="space-y-2">
              {places.map((p) => (
                <PlaceCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
