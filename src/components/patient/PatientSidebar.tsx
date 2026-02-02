"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  Cpu,
  Bot,
  CalendarClock,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/patient", icon: LayoutDashboard },
  { label: "Reports", href: "/patient/reports", icon: FileText },
  { label: "Devices", href: "/patient/devices", icon: Cpu },
  { label: "AI Assistant", href: "/patient/assistant", icon: Bot },
  { label: "Appointments", href: "/patient/appointments", icon: CalendarClock },
  { label: "Emergency", href: "/patient/emergency", icon: AlertTriangle },
];

function isActive(pathname: string, href: string) {
  if (href === "/patient") return pathname === "/patient";
  return pathname.startsWith(href);
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={[
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        active
          ? "bg-white/70 text-medx-navy shadow-sm ring-1 ring-medx-teal/15"
          : "text-muted-foreground hover:bg-black/5 hover:text-medx-navy",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-xl transition",
          active
            ? "bg-medx-teal/15 text-medx-teal ring-1 ring-medx-teal/10"
            : "bg-transparent text-muted-foreground group-hover:text-medx-navy",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function PatientSidebar() {
  return (
    <div className="sticky top-0 flex h-screen flex-col border-r border-black/5 bg-gradient-to-b from-medx-teal/10 via-white to-medx-gold/10 p-5">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-medx-teal/15">
          <span className="text-sm font-semibold text-medx-teal">M</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-medx-navy">MEDXERN</p>
          <p className="text-xs text-muted-foreground">Patient Portal</p>
        </div>
      </div>

      <Separator className="my-5" />

      {/* Main */}
      <div className="flex-1">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Main</p>
        <nav className="space-y-1">
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="pt-4">
        <Separator className="my-4" />
        <Link
          href="/patient/help"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-black/5 hover:text-medx-navy"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/50 ring-1 ring-black/5">
            <HelpCircle className="h-4 w-4" />
          </span>
          Help Center
        </Link>
        <p className="mt-3 px-3 text-xs text-muted-foreground">v0.1 (UI shell)</p>
      </div>
    </div>
  );
}
