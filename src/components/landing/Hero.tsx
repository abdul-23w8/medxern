// src/components/landing/Hero.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import TimelinePreview from "@/components/landing/TimelinePreview";

export default function Hero() {
  return (
    <section className="relative min-h-[calc(100svh-64px)] overflow-hidden bg-gradient-to-b from-white via-medx-teal/5 to-medx-teal/15">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-28 h-80 w-80 rounded-full bg-medx-teal/18 blur-3xl" />
        <div className="absolute -top-40 right-[-120px] h-96 w-96 rounded-full bg-medx-gold/16 blur-3xl" />
        <div className="absolute bottom-[-140px] left-1/3 h-96 w-96 rounded-full bg-medx-orange/12 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#0f172a_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-64px)] max-w-6xl items-center px-4">
        <div className="grid items-start gap-10 md:grid-cols-2">
          {/* Left */}
          <div className="-mt-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-3 py-1 text-sm text-muted-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-medx-teal" />
              Patient-owned • Doctor-ready
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-medx-navy md:text-5xl">
              Your medical history, organized — ready for any doctor in{" "}
              <span className="relative inline-block">
                <span className="relative z-10">10 seconds</span>
                <span className="absolute inset-x-0 -bottom-1 h-3 rounded-lg bg-medx-gold/35" />
              </span>
              .
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Upload reports, prescriptions, scans, or WhatsApp files. MEDXERN turns them into a
              clear timeline doctors can understand instantly.{" "}
              <span className="text-medx-navy/70">No more searching. No more repeating your story.</span>
            </p>

            <div className="mt-8">
              <Button
                asChild
                className="rounded-xl bg-medx-teal px-6 py-5 text-white shadow-sm hover:bg-medx-teal/90"
              >
                <Link href="/signup">Create my MEDXERN ID</Link>
              </Button>

              <p className="mt-3 text-xs text-muted-foreground">Free to start. Takes under a minute.</p>
            </div>
          </div>

          {/* Right */}
          <div className="relative">
            <TimelinePreview state="doctorReady" />
          </div>
        </div>
      </div>
    </section>
  );
}
