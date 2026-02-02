// src/components/landing/Family.tsx
import { Users, HeartPulse, Baby, ShieldCheck, QrCode, BellRing } from "lucide-react";

/**
 * ✅ Updated for conversion + “real product” tone
 * Fixes applied:
 * - Stronger, emotional headline (less feature-y)
 * - Reduced repetition (removed “Fully separate medical history” line)
 * - Benefits strip simplified (less clutter, more meaning)
 * - Copy tightened to match “one scroll = one idea”
 * - Still premium + consistent with your design system
 */

const profiles = [
  {
    title: "Parents",
    desc: "Chronic conditions, medicines, and visits — always ready when you need them.",
    Icon: HeartPulse,
    tone: "bg-medx-teal/10 text-medx-navy ring-medx-teal/20",
  },
  {
    title: "Kids",
    desc: "Vaccines, growth, illnesses, and school records — organized in one timeline.",
    Icon: Baby,
    tone: "bg-medx-gold/20 text-medx-navy ring-medx-gold/25",
  },
  {
    title: "Grandparents",
    desc: "Emergency-ready history you can share instantly, even when you’re not around.",
    Icon: ShieldCheck,
    tone: "bg-medx-orange/10 text-medx-navy ring-medx-orange/20",
  },
];

const benefits = [
  { label: "Separate timelines", Icon: Users },
  { label: "Individual QR sharing", Icon: QrCode },
  { label: "Reminders & alerts", Icon: BellRing },
];

export default function Family() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* subtle background accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-medx-teal/10 blur-3xl" />
        <div className="absolute -bottom-32 right-[-120px] h-80 w-80 rounded-full bg-medx-gold/12 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.025] [background-image:radial-gradient(#0f172a_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-18">
        {/* Header */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <Users className="h-4 w-4 text-medx-teal" />
            Family-first
          </div>

          <h2 className="mt-5 text-3xl font-bold tracking-tight text-medx-navy md:text-4xl">
            Everyone you love, protected in one place
          </h2>

          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Manage parents, kids, and grandparents — each with their own timeline and shareable MEDXERN ID.
          </p>
        </div>

        {/* Profile cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {profiles.map(({ title, desc, Icon, tone }) => (
            <div
              key={title}
              className="group rounded-3xl border border-border bg-white/75 p-6 shadow-sm backdrop-blur transition hover:-translate-y-[1px] hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div
                  className={[
                    "flex h-11 w-11 items-center justify-center rounded-2xl ring-1",
                    tone,
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <div className="text-base font-semibold text-medx-navy">{title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </div>

              {/* subtle bottom accent */}
              <div className="pointer-events-none mt-5 h-px bg-gradient-to-r from-transparent via-medx-teal/25 to-transparent opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>

        {/* Benefits strip (short, meaningful) */}
        <div className="mt-10 rounded-3xl border border-border bg-white/70 p-6 shadow-sm backdrop-blur">
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map(({ label, Icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-medx-teal/10 text-medx-teal ring-1 ring-medx-teal/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-medium text-medx-navy">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 text-xs text-muted-foreground">
            In emergencies, you can share a family member’s MEDXERN ID instantly.
          </div>
        </div>
      </div>
    </section>
  );
}
