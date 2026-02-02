"use client";

import { useContext } from "react";
import { PatientUIContext } from "@/providers/PatientUIProvider";

export function usePatientUI() {
  const ctx = useContext(PatientUIContext);
  if (!ctx) {
    throw new Error("usePatientUI must be used inside <PatientUIProvider /> (patient layout).");
  }
  return ctx;
}
