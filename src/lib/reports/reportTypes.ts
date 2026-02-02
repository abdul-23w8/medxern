/* eslint-disable @typescript-eslint/no-explicit-any */

// -------------------------------
// Core enums
// -------------------------------

export type ReportStatus =
  | "uploaded"
  | "processing"
  | "processed"
  | "error";

export type ReportType =
  | "lab"
  | "prescription"
  | "discharge"
  | "scan"
  | "other";

// -------------------------------
// AI-extracted structure
// -------------------------------

export type ReportAI = {
  reportType: ReportType;
  reportDate: string | null; // YYYY-MM-DD
  provider: {
    name: string | null;
    hospital: string | null;
  } | null;

  summaryBullets: string[];
  keyFindings: string[];

  diagnoses: string[];
  symptoms: string[];

  medications: Array<{
    name: string;
    dose: string | null;
    frequency: string | null;
    duration: string | null;
  }>;

  allergies: string[];
  procedures: string[];

  labs: Array<{
    test: string;
    value: string;
    unit: string | null;
    refRange: string | null;
    flag: "H" | "L" | "N" | "?";
  }>;

  confidence: number; // 0 → 1
};

// -------------------------------
// Firestore Report Document
// -------------------------------

export type ReportDoc = {
  /** Identity */
  fileName: string;
  storagePath: string;

  /** File metadata */
  contentType: string;
  size: number;

  /** Classification */
  reportType: ReportType;
  providerName?: string;
  reportDate?: string | null;

  /** Status */
  status: ReportStatus;
  error?: string | null;

  /** AI results */
  ai?: ReportAI | null;

  /** Optional extracted text */
  extractedText?: string | null;

  /** Timestamps */
  uploadedAt?: any; // Firestore Timestamp
  processedAt?: any;
  updatedAt?: any;
};

// -------------------------------
// Doctor snapshot (aggregated view)
// -------------------------------

export type DoctorSnapshot = {
  updatedAt?: any;

  overview: string[];
  activeMedications: string[];
  conditions: string[];
  allergies: string[];

  abnormalLabs: Array<{
    date: string | null;
    test: string;
    value: string;
    unit: string | null;
    flag: "H" | "L" | "N" | "?";
  }>;

  timeline: Array<{
    date: string | null;
    type: string;
    title: string;
    summary: string;
  }>;

  reportRefs?: Array<{
    reportId: string;
    fileName: string;
    reportType?: ReportType;
    reportDate?: string | null;
    publicUrl?: string;
  }>;
};

// -------------------------------
// Public share document
// -------------------------------

export type PublicShareDoc = {
  patientId: string;
  createdAt?: any;
  active?: boolean;
  mode?: "public_demo" | "private" | string;
};
