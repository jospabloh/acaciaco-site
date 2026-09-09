import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getClientKey, isRateLimited } from "./_ratelimit";
import { resolveRegimenClave } from "./_facturaValidation";

// Reads a customer-uploaded CSF or ticket photo with Claude vision and
// returns whatever it can confidently make out, so the invoice form can
// pre-fill itself. This is a convenience layer only — every field it returns
// stays editable on the form, and any failure here (bad file, no API key,
// model error, rate limit) degrades to "the customer fills it in by hand"
// rather than blocking the request.

const MAX_DATA_URL_LEN = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Haiku is plenty for reading a printed/handwritten receipt or CSF against a
// fixed schema, and it's a fraction of Opus's cost for a high-volume
// convenience feature — Sonnet is the fallback if Haiku errors out or the
// account doesn't have access to it.
const PRIMARY_MODEL = "claude-haiku-4-5";
const FALLBACK_MODEL = "claude-sonnet-5";

const FORMAS_PAGO = ["Efectivo", "Tarjeta de débito", "Tarjeta de crédito", "Transferencia"] as const;

interface RegimenRow {
  clave: string;
  descripcion: string;
  vigente: boolean;
}

// Fills in each régimen's clave from its description when the CSF didn't
// print one, and DROPS any row we can't tie to a real catalog clave. Dropping
// matters as much as filling: an entry with no clave becomes an
// <option value=""> on the form, which the customer can select but can never
// submit — that is the exact dead end this whole flow had to be fixed for.
// If nothing survives, the form keeps its own full catalog to pick from.
function withClaves(regimenes: RegimenRow[] | null | undefined): RegimenRow[] {
  if (!Array.isArray(regimenes)) return [];
  const resolved: RegimenRow[] = [];
  for (const r of regimenes) {
    const clave = resolveRegimenClave(r?.clave, r?.descripcion);
    if (!clave) {
      console.warn("factura-extract: unresolvable régimen on a CSF", JSON.stringify(r?.descripcion || ""));
      continue;
    }
    resolved.push({ clave, descripcion: r.descripcion, vigente: r.vigente });
  }
  return resolved;
}

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
  monto: z.number().nullable().describe("'Gran Total' / final total charged, as a plain number without currency symbols"),
  subtotal: z
    .number()
    .nullable()
    .describe(
      "Subtotal before tax, ONLY if printed verbatim on the receipt (e.g. a 'Subtotal' line). Do not calculate " +
        "or estimate this yourself from the total — leave it null if there's no explicit subtotal line.",
    ),
  forma_pago: z.enum(FORMAS_PAGO).nullable(),
  folio_ticket: z
    .string()
    .nullable()
    .describe(
      "The point-of-sale transaction ID — commonly labeled 'Movimiento' on Mexican POS receipts, but also seen " +
        "as 'Folio', 'Ticket #' or 'Transacción'. Combined with the date this uniquely identifies the sale.",
    ),
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

    const apiKey = process.env.ANTHROPIC_API_KEY_Roseta;
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
      const csfParams = {
        max_tokens: 2000,
        system:
          "Extraes datos de una Constancia de Situación Fiscal (CSF) mexicana emitida por el SAT. " +
          "Lee la tabla de 'Regímenes' completa, incluyendo filas con fecha de fin (ya no vigentes). " +
          "Si un dato no es legible o no aparece, devuélvelo como null en vez de inventarlo.",
        messages: [
          {
            role: "user" as const,
            content: [block, { type: "text" as const, text: "Extrae los datos de esta Constancia de Situación Fiscal." }],
          },
        ],
        output_format: betaZodOutputFormat(CsfSchema),
      };
      let response;
      try {
        response = await client.beta.messages.parse({ ...csfParams, model: PRIMARY_MODEL });
      } catch (err) {
        console.error(`${PRIMARY_MODEL} failed for CSF extraction, falling back to ${FALLBACK_MODEL}`, err);
        response = await client.beta.messages.parse({ ...csfParams, model: FALLBACK_MODEL });
      }
      const data = response.parsed_output;
      if (!data || !data.es_csf) {
        return res.status(200).json({ ok: false, error: "no_match" });
      }
      // A persona moral's CSF prints the régimen description without its
      // clave, so Claude returns `clave: ""`. Fill it in HERE, before the
      // response leaves the server: the form builds its <option value> out of
      // this, so an empty clave becomes an option nothing can submit — and
      // doing it server-side fixes browsers still running a cached factura.js,
      // which a client-only fix cannot reach.
      return res.status(200).json({ ok: true, kind, data: { ...data, regimenes: withClaves(data.regimenes) } });
    }

    const ticketParams = {
      max_tokens: 1000,
      system:
        "Extraes datos de un ticket o recibo de compra mexicano (cafetería). " +
        "Si un dato no es legible o no aparece, devuélvelo como null en vez de inventarlo.",
      messages: [
        {
          role: "user" as const,
          content: [block, { type: "text" as const, text: "Extrae los datos de este ticket de compra." }],
        },
      ],
      output_format: betaZodOutputFormat(TicketSchema),
    };
    let response;
    try {
      response = await client.beta.messages.parse({ ...ticketParams, model: PRIMARY_MODEL });
    } catch (err) {
      console.error(`${PRIMARY_MODEL} failed for ticket extraction, falling back to ${FALLBACK_MODEL}`, err);
      response = await client.beta.messages.parse({ ...ticketParams, model: FALLBACK_MODEL });
    }
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
