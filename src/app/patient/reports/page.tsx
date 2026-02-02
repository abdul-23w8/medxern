// src/app/patient/reports/page.tsx

import ReportsList from "@/components/patient/reports/ReportsList";

export default function ReportsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-black/85">
          Medical Reports
        </h1>
        <p className="mt-1 text-sm text-black/55">
          Upload, manage, and securely share your medical documents with doctors.
        </p>
      </div>

      {/* Reports list */}
      <ReportsList />
    </main>
  );
}
