// Validation for the CFDI files Roseta uploads in the admin panel. A CFDI's
// PDF and XML are small, so the cap is well under Vercel's 4.5MB request-body
// limit — this is a sanity backstop, not a real constraint.
//
// Both the extension AND the first decoded bytes are checked: a renamed file
// is the most likely honest mistake, and mailing the customer a "factura.xml"
// that is really a PDF hands them something they cannot deduct.
export const MAX_COMBINED_B64_LEN = 2 * 1024 * 1024;

export interface CfdiFile {
  filename: string;
  content: string;
}

interface FileField {
  name?: unknown;
  dataUrl?: unknown;
}

function decodeHead(b64: string, bytes: number): string {
  const chunk = b64.slice(0, Math.ceil((bytes * 4) / 3) + 4);
  try {
    return Buffer.from(chunk, "base64").toString("latin1");
  } catch {
    return "";
  }
}

function looksLikePdf(b64: string): boolean {
  return decodeHead(b64, 8).startsWith("%PDF");
}

function looksLikeXml(b64: string): boolean {
  const head = decodeHead(b64, 64).replace(/^\uFEFF/, "").trimStart();
  return head.startsWith("<?xml") || head.startsWith("<");
}

export function parseCfdiFile(f: unknown, kind: "pdf" | "xml"): CfdiFile | null {
  if (!f || typeof f !== "object") return null;
  const field = f as FileField;
  const name = typeof field.name === "string" ? field.name.trim() : "";
  const dataUrl = typeof field.dataUrl === "string" ? field.dataUrl : "";
  if (!name || !dataUrl) return null;
  if (dataUrl.length > MAX_COMBINED_B64_LEN) return null;
  if (!name.toLowerCase().endsWith(`.${kind}`)) return null;

  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const content = match[2];

  const valid = kind === "pdf" ? looksLikePdf(content) : looksLikeXml(content);
  return valid ? { filename: name, content } : null;
}
