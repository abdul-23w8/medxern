"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, User, Search, Plus } from "lucide-react";
import { usePatientUI } from "@/hooks/usePatientUI";

export default function PatientTopbar() {
  const { openUpload } = usePatientUI();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-gradient-to-r from-white via-white to-medx-teal/10 px-4 py-3 shadow-md backdrop-blur">
      {/* Left: global search */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your health records, doctors, activity…"
            className="bg-white/80 pl-9 ring-1 ring-black/5 focus-visible:ring-medx-teal/30"
          />
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Upload (global quick action) */}
        <Button
          variant="secondary"
          size="sm"
          onClick={openUpload}
          className="hidden sm:inline-flex bg-white/80 shadow-sm ring-1 ring-black/5 hover:bg-medx-teal/10"
        >
          <Plus className="mr-2 h-4 w-4" />
          Upload
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="text-muted-foreground hover:bg-black/5 hover:text-medx-navy"
        >
          <Bell className="h-5 w-5" />
        </Button>

        {/* ✅ Profile → /patient/profile (correct route) */}
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label="Profile"
          className="rounded-full text-muted-foreground hover:bg-black/5 hover:text-medx-navy"
        >
          <Link href="/patient/profile">
            <User className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
