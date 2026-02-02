/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";
import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(10),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.1-chat-latest")
});

function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Missing/invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}

export type ExtractedReportAI = {
  reportType: "lab" | "prescription" | "discharge" | "scan" | "other";
  reportDate: string | null; // ISO yyyy-mm-dd when possible
  provider: { name: string | null; hospital: string | null } | null;

  summaryBullets: string[]; // 3-6 bullets
  keyFindings: string[]; // optional bullets

  diagnoses: string[];
  symptoms: string[];
  medications: Array<{ name: string; dose: string | null; frequency: string | null; duration: string | null }>;
  allergies: string[];
  procedures: string[];

  labs: Array<{ test: string; value: string; unit: string | null; refRange: string | null; flag: "H" | "L" | "N" | "?" }>;

  confidence: number; // 0..1
};

const extractedReportSchema: z.ZodType<ExtractedReportAI> = z.object({
  reportType: z.enum(["lab", "prescription", "discharge", "scan", "other"]),
  reportDate: z.string().nullable(),
  provider: z
    .object({
      name: z.string().nullable(),
      hospital: z.string().nullable()
    })
    .nullable(),

  summaryBullets: z.array(z.string()).min(1).max(8),
  keyFindings: z.array(z.string()).max(20),

  diagnoses: z.array(z.string()).max(30),
  symptoms: z.array(z.string()).max(30),
  medications: z
    .array(
      z.object({
        name: z.string().min(1),
        dose: z.string().nullable(),
        frequency: z.string().nullable(),
        duration: z.string().nullable()
      })
    )
    .max(50),
  allergies: z.array(z.string()).max(30),
  procedures: z.array(z.string()).max(30),

  labs: z
    .array(
      z.object({
        test: z.string().min(1),
        value: z.string().min(1),
        unit: z.string().nullable(),
        refRange: z.string().nullable(),
        flag: z.enum(["H", "L", "N", "?"])
      })
    )
    .max(300),

  confidence: z.number().min(0).max(1)
});

export type DoctorSnapshot = {
  overview: string[]; // 6-10 bullets max
  activeMedications: string[];
  conditions: string[];
  allergies: string[];
  abnormalLabs: Array<{ date: string | null; test: string; value: string; unit: string | null; flag: "H" | "L" | "N" | "?" }>;
  timeline: Array<{ date: string | null; type: string; title: string; summary: string }>;
};

const doctorSnapshotSchema: z.ZodType<DoctorSnapshot> = z.object({
  overview: z.array(z.string()).min(1).max(12),
  activeMedications: z.array(z.string()).max(50),
  conditions: z.array(z.string()).max(50),
  allergies: z.array(z.string()).max(50),
  abnormalLabs: z
    .array(
      z.object({
        date: z.string().nullable(),
        test: z.string().min(1),
        value: z.string().min(1),
        unit: z.string().nullable(),
        flag: z.enum(["H", "L", "N", "?"])
      })
    )
    .max(100),
  timeline: z
    .array(
      z.object({
        date: z.string().nullable(),
        type: z.string().min(1),
        title: z.string().min(1),
        summary: z.string().min(1)
      })
    )
    .max(60)
});

function getClient() {
  const env = getEnv();
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function getModel() {
  return getEnv().OPENAI_MODEL;
}

function extractFirstJson(text: string): unknown {
  // Try to find the first {...} JSON object in output
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Model output did not contain a JSON object.");
  }
  const slice = text.slice(start, end + 1);
  return JSON.parse(slice);
}

export async function aiExtractFromText(params: { text: string; fileName?: string; hint?: string }): Promise<ExtractedReportAI> {
  const client = getClient();
  const model = getModel();

  const prompt = `
You are a medical document extraction system for a demo app.

Task:
- Extract structured medical information from the document text.
- Be conservative: DO NOT guess. If unknown, use null or empty arrays.
- Keep summaryBullets to 3-6 short bullets for a doctor to read fast.

Return ONLY valid JSON matching this schema:

{
  "reportType": "lab|prescription|discharge|scan|other",
  "reportDate": "YYYY-MM-DD" or null,
  "provider": { "name": string|null, "hospital": string|null } or null,

  "summaryBullets": string[],
  "keyFindings": string[],

  "diagnoses": string[],
  "symptoms": string[],
  "medications": [{ "name": string, "dose": string|null, "frequency": string|null, "duration": string|null }],
  "allergies": string[],
  "procedures": string[],

  "labs": [{ "test": string, "value": string, "unit": string|null, "refRange": string|null, "flag": "H|L|N|?" }],

  "confidence": number (0..1)
}

Input context:
- fileName: ${params.fileName ?? "unknown"}
- hint: ${params.hint ?? "none"}

DOCUMENT TEXT:
${params.text}
`.trim();

  const resp = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }]
      }
    ]
  });

  const outText =
    resp.output_text ??
    (resp.output?.map((o: any) => o?.content?.map((c: any) => c?.text).filter(Boolean).join("\n")).filter(Boolean).join("\n") ?? "");

  const json = extractFirstJson(outText);
  const parsed = extractedReportSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`AI extraction JSON did not match schema: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function aiExtractFromImageBase64(params: {
  base64: string;
  mimeType: string;
  fileName?: string;
}): Promise<ExtractedReportAI> {
  const client = getClient();
  const model = getModel();

  const prompt = `
You are a medical document extraction system for a demo app.

You are given an image of a medical report/prescription/lab report.
Extract structured medical information.
Be conservative: DO NOT guess. If unknown, use null or empty arrays.

Return ONLY valid JSON matching this schema:

{
  "reportType": "lab|prescription|discharge|scan|other",
  "reportDate": "YYYY-MM-DD" or null,
  "provider": { "name": string|null, "hospital": string|null } or null,

  "summaryBullets": string[],
  "keyFindings": string[],

  "diagnoses": string[],
  "symptoms": string[],
  "medications": [{ "name": string, "dose": string|null, "frequency": string|null, "duration": string|null }],
  "allergies": string[],
  "procedures": string[],

  "labs": [{ "test": string, "value": string, "unit": string|null, "refRange": string|null, "flag": "H|L|N|?" }],

  "confidence": number (0..1)
}

fileName: ${params.fileName ?? "unknown"}
`.trim();

  const dataUrl = `data:${params.mimeType};base64,${params.base64}`;

  const resp = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: dataUrl, detail: "auto" }
        ]
      }
    ]
  });

  const outText =
    resp.output_text ??
    (resp.output?.map((o: any) => o?.content?.map((c: any) => c?.text).filter(Boolean).join("\n")).filter(Boolean).join("\n") ?? "");

  const json = extractFirstJson(outText);
  const parsed = extractedReportSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`AI extraction JSON did not match schema: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function aiBuildDoctorSnapshot(params: {
  patientId: string;
  reports: Array<{ reportId: string; fileName: string; uploadedAtISO: string | null; ai: ExtractedReportAI }>;
}): Promise<DoctorSnapshot> {
  const client = getClient();
  const model = getModel();

  const prompt = `
You are generating a "Doctor Snapshot" page for a demo medical app.

Goal:
Doctor should understand patient history in 2-3 minutes.

Given structured extracted data from multiple reports, generate a concise snapshot JSON:

Schema:
{
  "overview": string[] (6-10 bullets max),
  "activeMedications": string[],
  "conditions": string[],
  "allergies": string[],
  "abnormalLabs": [{ "date": string|null, "test": string, "value": string, "unit": string|null, "flag": "H|L|N|?" }],
  "timeline": [{ "date": string|null, "type": string, "title": string, "summary": string }]
}

Rules:
- Don’t invent facts.
- If conflicting info exists, prefer most recent.
- Timeline: newest first, short summaries.
- activeMedications: concise strings like "Metformin 500mg BD".
- abnormalLabs: only include clearly abnormal ("H" or "L") or notable.

INPUT (reports array):
${JSON.stringify(params.reports, null, 2)}
`.trim();

  const resp = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }]
      }
    ]
  });

  const outText =
    resp.output_text ??
    (resp.output?.map((o: any) => o?.content?.map((c: any) => c?.text).filter(Boolean).join("\n")).filter(Boolean).join("\n") ?? "");

  const json = extractFirstJson(outText);
  const parsed = doctorSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Doctor snapshot JSON did not match schema: ${parsed.error.message}`);
  }
  return parsed.data;
}
