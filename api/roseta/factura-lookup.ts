import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getValues } from "./_sheets";
import { getClientKey, isRateLimited } from "./_ratelimit";

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

// Column order matches the ClientesRFC tab written by factura-submit.ts:
// RFC, RazonSocial, RegimenFiscal, UsoCFDI, CP, Email, Telefono, Actualizado
const COLS = ["rfc", "razon_social", "regimen_fiscal", "uso_cfdi", "codigo_postal", "email", "telefono"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ found: false, error: "GET only" });
    }

    if (isRateLimited("factura-lookup:" + getClientKey(req), 60_000, 30)) {
      return res.status(429).json({ found: false, error: "Demasiadas solicitudes." });
    }

    const rfc = String(req.query.rfc || "").trim().toUpperCase();
    if (!RFC_RE.test(rfc)) {
      return res.status(400).json({ found: false, error: "RFC inválido." });
    }

    const rows = await getValues("ClientesRFC!A:H");
    const match = rows.find((r, i) => i > 0 && (r[0] || "").toUpperCase() === rfc);
    if (!match) {
      return res.status(200).json({ found: false });
    }

    const data: Record<string, string> = {};
    COLS.forEach((key, idx) => {
      if (key === "rfc") return;
      if (match[idx]) data[key] = match[idx];
    });

    return res.status(200).json({ found: true, data });
  } catch (err) {
    console.error(err);
    // A lookup failure shouldn't block the customer from filling the form
    // manually — report "not found" rather than surfacing a hard error.
    return res.status(200).json({ found: false });
  }
}
