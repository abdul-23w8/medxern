import pdfParse from "pdf-parse";
import { aiExtractFromImageBase64, aiExtractFromText, type ExtractedReportAI } from "./openai";

export async function extractAndAnalyze(params: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}): Promise<{ ai: ExtractedReportAI; extractedText?: string }> {
  const { buffer, contentType, fileName } = params;

  // Images → Vision extraction
  if (contentType.startsWith("image/")) {
    const base64 = buffer.toString("base64");
    const ai = await aiExtractFromImageBase64({ base64, mimeType: contentType, fileName });
    return { ai };
  }

  // PDFs → try text extraction
  if (contentType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    const text = (parsed.text || "").trim();

    // If we got meaningful text, use text extraction
    if (text.length >= 200) {
      const ai = await aiExtractFromText({ text, fileName, hint: "PDF text extraction" });
      // store truncated text (optional)
      return { ai, extractedText: text.slice(0, 20000) };
    }

    // If likely scanned PDF, we can still do a conservative fallback:
    // For demo, mark as scan with low confidence using whatever text we got.
    const hintText = text.length > 0 ? text : "Scanned/low-text PDF; text extraction returned little content.";
    const ai = await aiExtractFromText({
      text: hintText,
      fileName,
      hint: "Low-text/scanned PDF fallback (consider adding PDF→image rendering later)"
    });
    return { ai, extractedText: hintText.slice(0, 5000) };
  }

  // Unknown file type: just store minimal
  const ai = await aiExtractFromText({
    text: `Unsupported/unknown file type: ${contentType}. File name: ${fileName}.`,
    fileName,
    hint: "Unknown file type"
  });

  return { ai };
}
