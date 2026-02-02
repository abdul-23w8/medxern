// src/app/share/[shareId]/not-found.tsx

import Link from "next/link";

export default function ShareNotFound() {
  return (
    <main className="min-h-screen bg-[#050609] text-white">
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <div className="text-2xl font-semibold">
            Link not found
          </div>

          <p className="mt-3 text-sm text-white/70">
            This shared medical summary does not exist, has expired,
            or was disabled by the patient.
          </p>

          <div className="mt-6 space-y-3">
            <div className="text-xs text-white/50">
              Possible reasons:
            </div>
            <ul className="list-disc space-y-1 pl-5 text-left text-xs text-white/60">
              <li>The QR code is invalid or expired</li>
              <li>The report was deleted</li>
              <li>The share link was revoked</li>
              <li>The patient hasn’t uploaded reports yet</li>
            </ul>
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/10 px-5 py-2 text-sm font-medium text-white/90 hover:bg-white/20"
            >
              Go back to home
            </Link>
          </div>
        </div>

        <div className="mt-8 text-xs text-white/40">
          MEDXERN · Secure medical sharing
        </div>
      </div>
    </main>
  );
}
