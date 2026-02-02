// src/app/patient/page.tsx

import PatientDashboard from "@/components/patient/PatientDashboard";

export const metadata = {
  title: "Patient Dashboard • MedXern",
  description: "View your medical records, reports, and health summary",
};

export default function PatientPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <PatientDashboard />
    </main>
  );
}
