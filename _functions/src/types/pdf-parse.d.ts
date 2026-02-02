/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "pdf-parse" {
  type PDFParseResult = {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  };

  function pdfParse(data: Buffer | Uint8Array, options?: any): Promise<PDFParseResult>;
  export default pdfParse;
}
