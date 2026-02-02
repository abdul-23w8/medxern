// src/components/landing/HowItWorks.tsx
import { UploadCloud, Sparkles, QrCode } from "lucide-react";

/**
 * ✅ Updated for conversion + “real product” feel
 * Fixes applied (from recommendations):
 * - Less verbose (no feature dump / long bullet lists)
 * - Clear single idea: Upload → Organize → Share
 * - No “prototype/demo” language
 * - Keep it premium + fast to scan
 * - Keep tiny “No hospital integration needed” line (v1 honesty, still confident)
 * - Optional micro reassurance line (reduces friction)
 */

const steps = [
  {
    step: "01",
    title: "Upload",
    desc: "Drop any report, scan, or prescription — even WhatsApp files.",
    Icon: UploadCloud,
  },
  {
    step: "02",
    title: "Organize",
    desc: "MEDXERN builds a clean timeline doctors can understand instantly.",
    Icon: Sparkles,
  },
  {
    step: "03",
    title: "Share",
    desc: "One MEDXERN ID or QR — any doctor can view what matters in seconds.",
    Icon: QrCode,
  },
];

export default function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* subtle background to match premium system */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-medx-teal/10 blur-3xl" />
        <div className="absolute -bottom-28 right-[-120px] h-80 w-80 rounded-full bg-medx-gold/12 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02] [background-image:radial-gradient(#0f172a_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-18">
        {/* Header */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <Sparkles className="h-4 w-4 text-medx-teal" />
            Simple workflow
          </div>

          <h2 className="mt-5 text-3xl font-bold tracking-tight text-medx-navy md:text-4xl">
            Upload → Organize → Share
          </h2>

          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            No hospital integration needed — you bring your records. MEDXERN turns them into a doctor-ready timeline.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map(({ step, title, desc, Icon }) => (
            <div
              key={step}
              className="group relative rounded-3xl border border-border bg-white/75 p-6 shadow-sm backdrop-blur transition hover:-translate-y-[1px] hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-medx-teal/10 text-medx-teal ring-1 ring-medx-teal/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-muted-foreground">Step {step}</div>
                    <div className="text-base font-semibold text-medx-navy">{title}</div>
                  </div>
                </div>

                <span className="rounded-full border border-border bg-white px-2 py-1 text-xs text-muted-foreground">
                  {step === "01" ? "Reports" : step === "02" ? "Timeline" : "QR"}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{desc}</p>

              {/* subtle bottom accent */}
              <div className="pointer-events-none absolute inset-x-6 bottom-4 h-px bg-gradient-to-r from-transparent via-medx-teal/25 to-transparent opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>

        {/* Micro reassurance strip (not a feature list) */}
        <div className="mt-8 rounded-3xl border border-border bg-white/70 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-medium text-medx-navy">
              Works with your existing PDFs, photos, and prescriptions.
            </div>
            <div className="text-xs text-muted-foreground">
              Tip: Upload full pages (name/date visible) for best results.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
