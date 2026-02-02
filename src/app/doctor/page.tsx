import Link from "next/link";

export default function DoctorDashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-medx-gold/10">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-3xl border border-border bg-white/80 p-8 shadow-sm backdrop-blur">
          <div className="text-sm text-muted-foreground">Doctor dashboard</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-medx-navy">
            Doctor View
          </h1>
          <p className="mt-3 text-muted-foreground">
            Temporary dashboard. Next we’ll build: scan QR, view timeline, open originals.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl bg-medx-teal px-5 py-2.5 text-sm font-medium text-white hover:bg-medx-teal/90"
            >
              Go to landing
            </Link>

            <Link
              href="/patient"
              className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-medium text-medx-navy hover:bg-medx-navy/5"
            >
              View patient dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
