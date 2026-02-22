declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  };

  function pdf(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdf;
}
