"use client";

import React from "react";
import PatientSidebar from "@/components/patient/PatientSidebar";
import PatientTopbar from "@/components/patient/PatientTopbar";

export default function PatientShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-medx-teal/10 text-foreground">
      {/* Full-width app shell (sidebar pinned to left) */}
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <aside className="hidden w-[280px] shrink-0 lg:block">
          <PatientSidebar />
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Keep content centered, not the sidebar */}
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-4">
            <PatientTopbar />

            {/* Page content surface (adds subtle depth like the inspo) */}
            <main className="min-w-0 rounded-3xl bg-white/50 p-4 ring-1 ring-black/5">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
