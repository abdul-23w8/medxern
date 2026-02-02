// src/components/landing/HowDoctorsWorks.tsx
import {
  QrCode,
  ScanLine,
  Filter,
  FileSearch,
  Clock3,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

/**
 * ✅ Updated for “real product” + landing-page rules
 * Fixes applied:
 * - Removed “Try” / “See doctor view” buttons (no extra CTAs on landing)
 * - Kept this as a credibility block (doctor acceptance), not a second funnel
 * - More concise copy (scan fast, understand fast)
 * - Stronger trust signals without long explanations
 *
 * Recommended usage:
 * - If you keep this on landing: use it as a short credibility section.
 * - If your landing is now Hero → FeatureStrip → StickyStory → CTA,
 *   move this to /doctors later. But this version works either way.
 */

const actions = [
  {
    title: "Scan QR",
    desc: "Open the patient’s MEDXERN profile instantly.",
    Icon: ScanLine,
  },
  {
    title: "See timeline",
    desc: "Chronological visits, tests, diagnoses, and meds.",
    Icon: Sparkles,
  },
  {
    title: "Filter fast",
    desc: "Jump to what matters: test, condition, medicine, date.",
    Icon: Filter,
  },
  {
    title: "Open originals",
    desc: "One tap to view the exact PDF/photo behind any entry.",
    Icon: FileSearch,
  },
];

const trust = [
  { label: "Permission-based sharing", Icon: ShieldCheck },
  { label: "Doctor-ready in seconds", Icon: Clock3 },
  { label: "Patient stays in control", Icon: CheckCircle2 },
];

export default function HowDoctorsWorks() {
  return (
    <section className="relative overflow-hidden bg-medx-navy text-white">
      {/* Premium background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-[-120px] h-96 w-96 rounded-full bg-medx-teal/25 blur-3xl" />
        <div className="absolute -bottom-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-medx-gold/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-18">
        {/* Header */}
        <div className="grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80 shadow-sm">
              <QrCode className="h-4 w-4 text-medx-gold" />
              Built for clinics, OPD & emergencies
            </div>

            <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
              For doctors: understand the patient in{" "}
              <span className="relative inline-block">
                <span className="relative z-10">10 seconds</span>
                <span className="absolute inset-x-0 -bottom-1 h-3 rounded-lg bg-medx-gold/25" />
              </span>
            </h2>

            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/80">
              Scan a QR and view a clean timeline + original reports — without long back-and-forth.
            </p>
          </div>

          {/* Trust mini-panel */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="text-sm font-semibold text-white">Works instantly</div>
            <div className="mt-3 space-y-2">
              {trust.map(({ label, Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/10">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-white/85">{label}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-medx-gold" />
                <span className="text-sm text-white/85">
                  Built for fast decisions
                </span>
              </div>
              <div className="mt-1 text-xs text-white/70">
                ER triage • OPD follow-ups • second opinions
              </div>
            </div>
          </div>
        </div>

        {/* Action cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {actions.map(({ title, desc, Icon }) => (
            <div
              key={title}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur transition hover:-translate-y-[1px] hover:bg-white/10 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-base font-semibold">{title}</div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-white/80">{desc}</p>

              <div className="pointer-events-none mt-5 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>

        {/* Bottom line */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">
                No new workflow for doctors
              </div>
              <div className="mt-1 text-sm text-white/80">
                It’s just a scan + timeline — the patient controls access.
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <ScanLine className="h-4 w-4 text-medx-gold" />
              <span className="text-sm text-white/85">Scan. Review. Decide.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
