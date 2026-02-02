/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/share/[shareId]/page.tsx
import { notFound } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { DoctorSnapshot } from "@/lib/reports/reportTypes";

// If you already have shadcn/ui cards, you can swap these for your own UI.
// Keeping it dependency-free and clean.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white/80">{title}</div>
      <div className="mt-3 text-sm text-white/90">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/80">
      {children}
    </span>
  );
}

type PublicShare = {
  patientId: string;
  active?: boolean;
  mode?: string;
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  // 1) Resolve share -> patientId
  const shareRef = doc(db, `publicShares/${shareId}`);
  const shareSnap = await getDoc(shareRef);

  if (!shareSnap.exists()) return notFound();
  const share = shareSnap.data() as PublicShare;

  if (share.active === false) return notFound();
  if (!share.patientId) return notFound();

  const patientId = share.patientId;

  // 2) Load doctor snapshot
  const snapRef = doc(db, `users/${patientId}/doctorSnapshot/current`);
  const snap = await getDoc(snapRef);

  if (!snap.exists()) {
    // Share exists but snapshot not generated yet (upload still processing)
    return (
      <main className="min-h-screen bg-[#050609] text-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">
              MEDXERN — Doctor Snapshot
            </div>
            <div className="mt-2 text-sm text-white/70">
              Patient ID: <span className="font-medium">{patientId}</span>
            </div>

            <div className="mt-6 text-sm text-white/80">
              Snapshot is being generated… Please refresh in a moment.
            </div>

            <div className="mt-4 text-xs text-white/60">
              (This happens automatically after the patient uploads reports.)
            </div>
          </div>
        </div>
      </main>
    );
  }

  const data = snap.data() as DoctorSnapshot;

  const updatedAt =
    // Firestore Timestamp has toDate()
    (data.updatedAt as any)?.toDate?.()?.toLocaleString?.() ??
    (typeof data.updatedAt === "string" ? data.updatedAt : null);

  return (
    <main className="min-h-screen bg-[#050609] text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xl font-semibold">
                MEDXERN — Doctor Snapshot
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/70">
                <Pill>Public demo link</Pill>
                <span className="text-white/40">•</span>
                <span>
                  Patient ID: <span className="font-medium">{patientId}</span>
                </span>
                {updatedAt ? (
                  <>
                    <span className="text-white/40">•</span>
                    <span>Updated: {updatedAt}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="text-xs text-white/60">
              Quick read: ~2–3 minutes
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="At-a-glance overview">
            {data.overview?.length ? (
              <ul className="list-disc space-y-2 pl-5">
                {data.overview.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : (
              <div className="text-white/60">No overview generated yet.</div>
            )}
          </Section>

          <Section title="Active medications">
            {data.activeMedications?.length ? (
              <ul className="list-disc space-y-2 pl-5">
                {data.activeMedications.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            ) : (
              <div className="text-white/60">No active medications found.</div>
            )}
          </Section>

          <Section title="Conditions">
            {data.conditions?.length ? (
              <div className="flex flex-wrap gap-2">
                {data.conditions.map((c, i) => (
                  <Pill key={i}>{c}</Pill>
                ))}
              </div>
            ) : (
              <div className="text-white/60">No conditions found.</div>
            )}
          </Section>

          <Section title="Allergies">
            {data.allergies?.length ? (
              <div className="flex flex-wrap gap-2">
                {data.allergies.map((a, i) => (
                  <Pill key={i}>{a}</Pill>
                ))}
              </div>
            ) : (
              <div className="text-white/60">No known allergies listed.</div>
            )}
          </Section>

          <Section title="Notable / abnormal labs">
            {data.abnormalLabs?.length ? (
              <div className="space-y-2">
                {data.abnormalLabs.map((l, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <Pill>{l.flag}</Pill>
                    <span className="font-medium">{l.test}</span>
                    <span className="text-white/70">
                      {l.value}
                      {l.unit ? ` ${l.unit}` : ""}
                    </span>
                    {l.date ? (
                      <span className="text-white/50">({l.date})</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/60">No abnormal labs detected.</div>
            )}
          </Section>

          <Section title="Timeline (newest first)">
            {data.timeline?.length ? (
              <div className="space-y-3">
                {data.timeline.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill>{t.type}</Pill>
                      <div className="font-medium">{t.title}</div>
                      {t.date ? (
                        <div className="text-xs text-white/60">{t.date}</div>
                      ) : null}
                    </div>
                    <div className="mt-2 text-white/80">{t.summary}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/60">No timeline entries yet.</div>
            )}
          </Section>
        </div>

        {/* Originals */}
        <div className="mt-6">
          <Section title="Original reports">
            {data.reportRefs?.length ? (
              <div className="space-y-2">
                {data.reportRefs.map((r, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.fileName}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/60">
                        {r.reportType ? <Pill>{r.reportType}</Pill> : null}
                        {r.reportDate ? <span>{r.reportDate}</span> : null}
                      </div>
                    </div>

                    {r.publicUrl ? (
                      <a
                        className="mt-2 inline-flex w-fit items-center justify-center rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90 hover:bg-white/15 sm:mt-0"
                        href={r.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : (
                      <div className="text-xs text-white/50">
                        No public URL
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/60">
                No original reports linked yet.
              </div>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-white/40">
          Demo link • Generated from uploaded medical reports
        </div>
      </div>
    </main>
  );
}
