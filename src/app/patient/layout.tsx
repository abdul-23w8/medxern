import React from "react";
import PatientShell from "@/components/patient/PatientShell";
import PatientUIProvider from "@/providers/PatientUIProvider";
import UploadModal from "@/components/upload/UploadModal";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PatientUIProvider>
      <PatientShell>{children}</PatientShell>

      {/* Global, single source of truth for Upload */}
      <UploadModal />
    </PatientUIProvider>
  );
}
