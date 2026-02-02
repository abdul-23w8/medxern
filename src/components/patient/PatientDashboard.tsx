import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Stethoscope,
  Share2,
  ShieldCheck,
  Bot,
  HeartPulse,
  CalendarClock,
  Cpu,
  type LucideIcon,
} from "lucide-react";

type Report = {
  id: string;
  name: string;
  category: "Lab" | "Imaging" | "Prescription" | "Other";
  date: string; // mock string for now
};

type ActivityItem = {
  id: string;
  label: string;
  time: string;
};

const mockReports: Report[] = [
  { id: "r1", name: "CBC + Lipid Profile", category: "Lab", date: "Jan 12, 2026" },
  { id: "r2", name: "Chest X-Ray", category: "Imaging", date: "Jan 05, 2026" },
  {
    id: "r3",
    name: "Prescription (General Physician)",
    category: "Prescription",
    date: "Dec 28, 2025",
  },
];

const mockActivity: ActivityItem[] = [
  { id: "a1", label: "Report uploaded: CBC + Lipid Profile", time: "Today • 11:10 AM" },
  { id: "a2", label: "Records shared with Dr. Rao", time: "Yesterday • 6:40 PM" },
  { id: "a3", label: "Clinic viewed your history", time: "Jan 13 • 2:15 PM" },
  { id: "a4", label: "Report uploaded: Chest X-Ray", time: "Jan 05 • 9:02 AM" },
  { id: "a5", label: "MEDXERN ID created", time: "Dec 28 • 4:21 PM" },
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs text-muted-foreground shadow-sm ring-1 ring-black/5 backdrop-blur">
      {children}
    </span>
  );
}

function CardShell({
  title,
  children,
  rightSlot,
}: {
  title: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:shadow-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-medx-navy">{title}</h2>
        {rightSlot}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  subtext,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-medx-teal/15 text-medx-teal ring-1 ring-medx-teal/15">
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-sm font-medium text-medx-navy">{title}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-2xl font-semibold text-medx-navy">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
      </div>
    </div>
  );
}

export default function PatientDashboard() {
  // mock “stats” derived from mock data
  const reportsStored = String(mockReports.length);
  const doctorsConnected = "0"; // mock; later from backend
  const recordsShared = "0"; // mock
  const alerts = "None";

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-medx-navy">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Your health records are private, organized, and ready when you need them.
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          title="Reports Stored"
          value={reportsStored}
          subtext="Last upload 5 days ago"
        />
        <StatCard
          icon={Stethoscope}
          title="Doctors Connected"
          value={doctorsConnected}
          subtext="Access controlled by you"
        />
        <StatCard
          icon={Share2}
          title="Records Shared"
          value={recordsShared}
          subtext="View sharing history"
        />
        <StatCard
          icon={ShieldCheck}
          title="Health Alerts"
          value={alerts}
          subtext="No critical issues detected"
        />
      </div>

      {/* Main grid (Hero + right column) */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Health Snapshot */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-medx-teal/15 via-white to-medx-gold/15 p-6 shadow-sm ring-1 ring-black/5 lg:col-span-2 transition hover:shadow-md">
          {/* Soft blobs */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-medx-teal/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-medx-gold/25 blur-3xl" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-medx-navy">Health Snapshot</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This snapshot reflects your uploaded medical records.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Pill>Last updated: 8 days ago</Pill>
                <Pill>Records ready to share</Pill>
              </div>
            </div>

            {/* Placeholder visual area */}
            <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5">
              <div className="text-center">
                <HeartPulse className="mx-auto h-8 w-8 text-medx-teal" />
                <p className="mt-2 text-sm font-medium text-medx-navy">
                  Calm visual placeholder
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Replace with anatomical/abstract illustration later
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <CardShell title="Quick Actions">
          <div className="grid gap-2">
            <Button className="justify-between shadow-sm" asChild>
              <Link href="/patient/reports">
                Manage reports <FileText className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant="secondary"
              className="justify-between bg-white/80 ring-1 ring-black/5 hover:bg-medx-teal/10"
              asChild
            >
              <Link href="/patient/assistant">
                Open AI Assistant <Bot className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant="secondary"
              className="justify-between bg-white/80 ring-1 ring-black/5 hover:bg-medx-teal/10"
              asChild
            >
              <Link href="/patient/devices">
                Connect a device <Cpu className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant="secondary"
              className="justify-between bg-white/80 ring-1 ring-black/5 hover:bg-medx-teal/10"
              asChild
            >
              <Link href="/patient/appointments">
                Book appointment <CalendarClock className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardShell>
      </div>

      {/* Bottom grid */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recent Reports */}
        <CardShell
          title="Recent Reports"
          rightSlot={
            <Button variant="ghost" size="sm" asChild className="hover:bg-medx-teal/10">
              <Link href="/patient/reports">View all</Link>
            </Button>
          }
        >
          <div className="space-y-3">
            {mockReports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/70 p-3 ring-1 ring-black/5 transition hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-medx-navy">{r.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.category} • {r.date}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled
                  className="bg-white/80 ring-1 ring-black/5"
                >
                  Download
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Download is mocked for now.</p>
          </div>
        </CardShell>

        {/* Recent Activity */}
        <CardShell title="Recent Activity">
          <div className="space-y-3">
            {mockActivity.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3">
                <p className="text-sm text-medx-navy">{a.label}</p>
                <p className="shrink-0 text-xs text-muted-foreground">{a.time}</p>
              </div>
            ))}
          </div>
        </CardShell>
      </div>
    </div>
  );
}
