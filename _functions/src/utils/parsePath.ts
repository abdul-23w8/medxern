export type ParsedReportPath = {
  patientId: string;
  reportId: string;
  extension: string | null;
};

export function parseReportUploadPath(objectName: string): ParsedReportPath | null {
  // Expect: reports/{patientId}/{reportId}.{ext}
  const parts = objectName.split("/");
  if (parts.length < 3) return null;
  if (parts[0] !== "reports") return null;

  const patientId = parts[1];
  const fileName = parts.slice(2).join("/"); // allow nested, but we still parse basename
  const base = fileName.split("/").pop() || fileName;

  const dot = base.lastIndexOf(".");
  const reportId = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : null;

  if (!patientId || !reportId) return null;
  return { patientId, reportId, extension };
}
