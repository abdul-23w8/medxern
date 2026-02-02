// src/components/landing/TimelinePreview.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  HeartPulse,
  Microscope,
  ShieldCheck,
  FileText,
  Pill,
  ClipboardList,
  QrCode,
  Shield,
  Link2,
  CheckCircle2,
} from "lucide-react";

/**
 * TimelinePreview
 * States:
 * - "chaos"        → scattered files, dim timeline
 * - "organized"    → clean structured timeline
 * - "doctorReady"  → highlights + QR label + subtle auto-cycle
 * - "control"      → sharing + revoke state + access hints
 *
 * Note:
 * - We do NOT mirror `state` into component state.
 * - Highlight is derived: defaultIdx for most states, cyclingIdx for doctorReady.
 * - This avoids React warnings about unnecessary effects.
 */

type State = "chaos" | "organized" | "doctorReady" | "control";

type Props = {
  state?: State;
  autoCycle?: boolean;
  cycleMs?: number;
};

export default function TimelinePreview({
  state = "doctorReady",
  autoCycle = true,
  cycleMs = 2400,
}: Props) {
  const timeline = useMemo(
    () => [
      {
        year: "2021",
        title: "Diabetes diagnosed",
        sub: "Metformin started",
        icon: Activity,
        file: "diabetes-note.pdf",
      },
      {
        year: "2022",
        title: "BP increasing",
        sub: "Lifestyle + follow-up",
        icon: HeartPulse,
        file: "bp-reading.jpg",
      },
      {
        year: "2023",
        title: "ECG + Lipid profile",
        sub: "Stable",
        icon: Microscope,
        file: "ecg-lipid.pdf",
      },
      {
        year: "2024",
        title: "Chest discomfort",
        sub: "Doctor review advised",
        icon: ShieldCheck,
        file: "visit-summary.pdf",
      },
    ],
    []
  );

  const chaosFiles = useMemo(
    () => [
      { label: "report.pdf", Icon: FileText },
      { label: "scan.jpg", Icon: Microscope },
      { label: "meds.png", Icon: Pill },
      { label: "prescription.pdf", Icon: ClipboardList },
    ],
    []
  );

  // Default highlight row (looks intentional even without animation)
  const defaultIdx = 2;

  // For doctorReady animation: we only track "tick"
  const [tick, setTick] = useState(0);

  // Hover micro-tooltip (only visual)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (state !== "doctorReady" || !autoCycle) return;

    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, cycleMs);

    return () => window.clearInterval(id);
  }, [state, autoCycle, cycleMs]);

  // Derived highlight index:
  const activeIdx =
    state === "doctorReady" ? (defaultIdx + tick) % timeline.length : defaultIdx;

  const headerTitle =
    state === "chaos" ? "Scattered records" : "Doctor-ready timeline";

  const headerBadge =
    state === "doctorReady" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-medx-teal/10 px-2 py-1 text-xs text-medx-teal ring-1 ring-medx-teal/20">
        <QrCode className="h-3.5 w-3.5" />
        QR ready
      </span>
    ) : state === "control" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-medx-gold/20 px-2 py-1 text-xs text-medx-navy ring-1 ring-medx-gold/30">
        <Shield className="h-3.5 w-3.5" />
        Sharing ON
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-medx-teal/10 px-2 py-1 text-xs text-medx-navy ring-1 ring-medx-teal/15">
        <CheckCircle2 className="h-3.5 w-3.5 text-medx-teal" />
        Organized
      </span>
    );

  return (
    <div className="relative">
      {/* floating chaos files (only in chaos state) */}
      {state === "chaos" && (
        <div className="pointer-events-none absolute -inset-8">
          {chaosFiles.map((f, i) => (
            <div
              key={f.label}
              className="absolute animate-medx-float rounded-xl border border-border bg-white/80 px-3 py-1 text-xs shadow-sm backdrop-blur"
              style={{
                top: `${10 + i * 18}%`,
                left: i % 2 === 0 ? "-12%" : "85%",
                animationDelay: `${-i * 0.6}s`,
              }}
            >
              <f.Icon className="mr-2 inline h-3.5 w-3.5 text-medx-teal" />
              {f.label}
            </div>
          ))}
        </div>
      )}

      <div
        className={[
          "relative rounded-3xl border border-border bg-white/85 p-6 shadow-lg backdrop-blur transition-all duration-500",
          state === "chaos" ? "opacity-85 blur-[1px]" : "opacity-100",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-medx-navy">
            {headerTitle}
          </div>
          {headerBadge}
        </div>

        {/* Timeline */}
        <div className="mt-5 space-y-3">
          {timeline.map((item, idx) => {
            const Icon = item.icon;
            const highlight = state !== "chaos" && idx === activeIdx;

            const showOriginal =
              state !== "chaos" &&
              highlight &&
              (state === "doctorReady" || state === "organized");

            const showAccessHint = state === "control" && highlight;

            const hovering = hoverIdx === idx && state !== "chaos";

            return (
              <div
                key={item.year}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                className={[
                  "group relative rounded-2xl border border-border bg-white p-4 shadow-sm transition",
                  "hover:shadow-md",
                  highlight ? "ring-2 ring-medx-teal/30 bg-medx-teal/5" : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-sm font-semibold text-medx-navy">
                    {item.year}
                  </div>

                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={[
                        "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition",
                        highlight
                          ? "bg-medx-teal/15 text-medx-teal ring-medx-teal/25"
                          : "bg-medx-teal/10 text-medx-teal ring-medx-teal/20",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-medx-navy">
                        {item.title}
                      </div>
                      <div className="mt-1 truncate text-sm text-muted-foreground">
                        {item.sub}
                      </div>

                      {showOriginal && (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-medx-teal">
                          <FileText className="h-3.5 w-3.5" />
                          Open original file
                          <span className="text-medx-navy/40">•</span>
                          <span className="truncate text-medx-navy/55">
                            {item.file}
                          </span>
                        </div>
                      )}

                      {showAccessHint && (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-medx-navy/70">
                          <Link2 className="h-3.5 w-3.5 text-medx-teal" />
                          Shared with doctor • can revoke anytime
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hover micro-tooltip (subtle) */}
                <div
                  className={[
                    "pointer-events-none absolute right-4 top-4 hidden items-center gap-1 rounded-full border border-border bg-white/90 px-2 py-1 text-[11px] text-medx-navy/70 shadow-sm backdrop-blur",
                    hovering ? "md:flex" : "",
                  ].join(" ")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-medx-teal" />
                  Opened
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {state === "chaos"
              ? "Files from different places"
              : state === "control"
              ? "Share only when you choose"
              : "Tap any item to open the original PDF or photo"}
          </span>

          {state === "control" ? (
            <span className="rounded-full border border-border bg-white px-2 py-1">
              Revoke anytime
            </span>
          ) : (
            <span className="rounded-full border border-border bg-white px-2 py-1">
              Doctor-ready
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
