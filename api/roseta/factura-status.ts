import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getValues } from "./_sheets";
import { getClientKey, isRateLimited } from "./_ratelimit";

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

// Column order in the Solicitudes tab, written by factura-submit.ts:
// Folio, FechaSolicitud, RFC, RazonSocial, RegimenFiscal, UsoCFDI, CP,
// Email, Telefono, Sucursal, FechaConsumo, Monto, FormaPago, FolioTicket,
// Estatus, FechaFacturacion
const FOLIO = 0, FECHA_SOLICITUD = 1, RFC = 2, SUCURSAL = 9, MONTO = 11, ESTATUS = 14, FECHA_FACTURACION = 15;

function fmtMoney(v: string): string {
  const n = Number(v);
  return isFinite(n) ? `$${n.toFixed(2)} MXN` : v;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ found: false, error: "GET only" });
    }

    if (isRateLimited("factura-status:" + getClientKey(req), 60_000, 20)) {
      return res.status(429).json({ found: false, error: "Demasiadas solicitudes, intenta de nuevo en un minuto." });
    }

    const query = String(req.query.query || "").trim().toUpperCase();
    if (!query) {
      return res.status(400).json({ found: false, error: "Ingresa un folio o RFC." });
    }

    const rows = await getValues("Solicitudes!A:P");
    const data = rows.slice(1); // drop header

    let match: string[] | undefined;
    if (query.startsWith("RF-")) {
      match = data.find((r) => (r[FOLIO] || "").toUpperCase() === query);
    } else if (RFC_RE.test(query)) {
      // Most recent request for that RFC — rows are appended chronologically.
      for (let i = data.length - 1; i >= 0; i--) {
        if ((data[i][RFC] || "").toUpperCase() === query) { match = data[i]; break; }
      }
    } else {
      return res.status(400).json({ found: false, error: "Ingresa un folio (RF-...) o un RFC válido." });
    }

    if (!match) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json({
      found: true,
      folio: match[FOLIO] || "",
      fecha_solicitud: match[FECHA_SOLICITUD] || "",
      sucursal: match[SUCURSAL] || "",
      monto: match[MONTO] ? fmtMoney(match[MONTO]) : "",
      estatus: match[ESTATUS] || "Pendiente",
      fecha_facturacion: match[FECHA_FACTURACION] || "",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ found: false, error: "No se pudo consultar el estatus en este momento." });
  }
}
