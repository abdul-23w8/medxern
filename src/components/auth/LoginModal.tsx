// src/components/auth/LoginModal.tsx
"use client";

import React, { useEffect, useRef } from "react";
import LoginCard from "@/components/auth/LoginCard";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function LoginModal({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ESC to close + basic focus management
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Keep focus inside panel (simple trap)
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;

        const focusables = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (active === first || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", onKey);

    // Focus the first focusable element (or panel) on open
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const firstFocusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable ?? panel).focus?.();
    }, 0);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Login">
      {/* Backdrop (click to close) */}
      <button
        type="button"
        aria-label="Close login modal"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal container */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        {/* Panel */}
        <div
          ref={panelRef}
          tabIndex={-1}
          className="relative z-[101] outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-[110] grid h-10 w-10 place-items-center rounded-full bg-white/90 text-medx-navy shadow-md ring-1 ring-black/5 hover:bg-white"
          >
            ✕
          </button>

          {/* Close modal on successful login */}
          <LoginCard onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}
