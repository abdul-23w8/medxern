// src/components/landing/CTA.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, QrCode, Clock3 } from "lucide-react";

export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-medx-teal/5 to-medx-teal/15">
      {/* soft premium background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-medx-teal/20 blur-3xl" />
        <div className="absolute -bottom-32 right-[-120px] h-80 w-80 rounded-full bg-medx-gold/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] [background-image:radial-gradient(#0f172a_1px,transparent_1px)] [background-size:18px_18px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="rounded-[2.5rem] border border-border bg-white/80 p-10 shadow-xl backdrop-blur md:p-14">
          <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-sm text-muted-foreground shadow-sm">
                <ShieldCheck className="h-4 w-4 text-medx-teal" />
                Patient-owned • Doctor-ready
              </div>

              <h2 className="mt-5 text-3xl font-bold tracking-tight text-medx-navy md:text-4xl">
                Create your MEDXERN ID in{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">minutes</span>
                  <span className="absolute inset-x-0 -bottom-1 h-3 rounded-lg bg-medx-gold/35" />
                </span>
                .
              </h2>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                Upload your first report and get a clean medical timeline you can use for life — across clinics,
                hospitals, and emergencies.
              </p>

              <div className="mt-8">
                <Button
                  asChild
                  className="h-11 rounded-xl bg-medx-teal px-6 text-white shadow-sm hover:bg-medx-teal/90"
                >
                  <Link href="/signup">
                    Create my MEDXERN ID
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <div className="mt-3 text-xs text-muted-foreground">
                  Free to start • Under a minute • No credit card
                </div>
              </div>
            </div>

            {/* Right – trust panel */}
            <div className="rounded-3xl border border-border bg-white/70 p-6 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-medx-navy">
                Why people choose MEDXERN
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-medx-teal/10 text-medx-teal ring-1 ring-medx-teal/20">
                    <QrCode className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    One ID works across any doctor
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-medx-gold/20 text-medx-navy ring-1 ring-medx-gold/25">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Timeline ready in seconds
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-medx-orange/10 text-medx-navy ring-1 ring-medx-orange/20">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    You control who can view it
                  </div>
                </div>
              </div>

              <div className="mt-5 text-xs text-muted-foreground">
                No hospital or insurance account required.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
