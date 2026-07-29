import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getClientKey, isRateLimited } from "./_ratelimit";

// Reads a customer-uploaded CSF or ticket photo with Claude vision and
// returns whatever it can confidently make out, so the invoice form can
// pre-fill itself. This is a convenience layer only — every field it returns
// stays editable on the form, and any failure here (bad file, no API key,
// model error, rate limit) degrades to "the customer fills it in by hand"
// rather than blocking the request.

const MAX_DATA_URL_LEN = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const FORMAS_PAGO = ["Efectivo", "Tarjeta de débito", "Tarjeta de crédito", "Transferencia"] as const;

const CsfSchema = z.object({
  es_csf: z
    .boolean()
    .describe("true only if this document is a Mexican SAT Constancia de Situación Fiscal"),
  razon_social: z.string().nullable().describe("Nombre, denominación o razón social, exactly as printed"),
  rfc: z.string().nullable(),
  codigo_postal: z.string().nullable().describe("5-digit CP from the domicilio fiscal section"),
  regimenes: z
    .array(
      z.object({
        clave: z.string().describe("3-digit régimen fiscal code, e.g. 612"),
        descripcion: z.string().describe("régimen label as printed on the CSF"),
        vigente: z
          .boolean()
          .describe("true if this régimen's 'Fecha fin' column is empty/blank (still active), false if it has an end date"),
      }),
    )
    .describe("Every row of the 'Regímenes' table on the CSF, active or not"),
});

const TicketSchema = z.object({
  es_ticket: z.boolean().describe("true only if this image is a purchase receipt/ticket"),
  fecha: z.string().nullable().describe("Purchase date in YYYY-MM-DD format"),
  monto: z.number().nullable().describe("Final total charged, as a plain number without currency symbols"),
  forma_pago: z.enum(FORMAS_PAGO).nullable(),
  folio_ticket: z.string().nullable().describe("Ticket/folio/receipt number if printed"),
});

type Kind = "csf" | "ticket";

interface FileField {
  name?: string;
  type?: string;
  dataUrl?: string;
}

function parseDataUrl(f: FileField | null | undefined): { mediaType: string; base64: string } | null {
  if (!f || !f.dataUrl) return null;
  if (f.dataUrl.length > MAX_DATA_URL_LEN) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(f.dataUrl);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

function contentBlockFor(mediaType: string, base64: string) {
  if (mediaType === "application/pdf") {
    return { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } };
  }
  if (ALLOWED_IMAGE_TYPES.has(mediaType)) {
    return {
      type: "image" as const,
      source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/webp", data: base64 },
    };
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    if (isRateLimited("factura-extract:" + getClientKey(req), 60_000, 20)) {
      return res.status(429).json({ ok: false, error: "Demasiadas solicitudes, intenta de nuevo en un minuto." });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Not configured — fail soft, the client falls back to manual entry.
      return res.status(200).json({ ok: false, error: "not_configured" });
    }

    const body = req.body || {};
    const kind = body.kind as Kind;
    if (kind !== "csf" && kind !== "ticket") {
      return res.status(400).json({ ok: false, error: "kind debe ser 'csf' o 'ticket'." });
    }

    const parsed = parseDataUrl(body.file);
    if (!parsed) {
      return res.status(400).json({ ok: false, error: "Archivo inválido o demasiado pesado." });
    }
    const block = contentBlockFor(parsed.mediaType, parsed.base64);
    if (!block) {
      return res.status(400).json({ ok: false, error: "Formato no soportado. Usa PDF, JPG o PNG." });
    }

    const client = new Anthropic({ apiKey });

    if (kind === "csf") {
      const response = await client.beta.messages.parse({
        model: "claude-opus-5",
        max_tokens: 2000,
        system:
          "Extraes datos de una Constancia de Situación Fiscal (CSF) mexicana emitida por el SAT. " +
          "Lee la tabla de 'Regímenes' completa, incluyendo filas con fecha de fin (ya no vigentes). " +
          "Si un dato no es legible o no aparece, devuélvelo como null en vez de inventarlo.",
        messages: [
          {
            role: "user",
            content: [block, { type: "text", text: "Extrae los datos de esta Constancia de Situación Fiscal." }],
          },
        ],
        output_format: betaZodOutputFormat(CsfSchema),
      });
      const data = response.parsed_output;
      if (!data || !data.es_csf) {
        return res.status(200).json({ ok: false, error: "no_match" });
      }
      return res.status(200).json({ ok: true, kind, data });
    }

    const response = await client.beta.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1000,
      system:
        "Extraes datos de un ticket o recibo de compra mexicano (cafetería). " +
        "Si un dato no es legible o no aparece, devuélvelo como null en vez de inventarlo.",
      messages: [
        {
          role: "user",
          content: [block, { type: "text", text: "Extrae los datos de este ticket de compra." }],
        },
      ],
      output_format: betaZodOutputFormat(TicketSchema),
    });
    const data = response.parsed_output;
    if (!data || !data.es_ticket) {
      return res.status(200).json({ ok: false, error: "no_match" });
    }
    return res.status(200).json({ ok: true, kind, data });
  } catch (err) {
    console.error("factura-extract failed", err);
    // Extraction is a convenience — never surface a hard error to the form.
    return res.status(200).json({ ok: false, error: "extract_failed" });
  }
}
