declare module "pdf-parse" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
    version: string;
  }

  interface PdfParseOptions {
    pagerender?: (pageData: {
      getTextContent: (options?: unknown) => Promise<{
        items: Array<{ str: string; transform: number[] }>;
      }>;
    }) => Promise<string> | string;
    max?: number;
    version?: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
