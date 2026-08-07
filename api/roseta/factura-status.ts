import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getValues } from "./_sheets";
import { getClientKey, isRateLimited } from "./_ratelimit";
import {
  RFC_WINDOW_DAYS,
  SOLICITUDES_RANGE,
  selectByFolio,
  selectByRfc,
  todayISO,
} from "./_facturaRows";

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

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

    const rows = await getValues(SOLICITUDES_RANGE);

    // A folio is looked up exactly and without a time window; an RFC returns
    // every request inside the window, newest first.
    if (query.startsWith("RF-")) {
      const solicitudes = selectByFolio(rows, query);
      return res.status(200).json({ found: solicitudes.length > 0, solicitudes });
    }

    if (RFC_RE.test(query)) {
      const { solicitudes, rfcExists } = selectByRfc(rows, query, todayISO());
      return res.status(200).json({
        found: solicitudes.length > 0,
        solicitudes,
        rfc_exists: rfcExists,
        window_days: RFC_WINDOW_DAYS,
      });
    }

    return res.status(400).json({ found: false, error: "Ingresa un folio (RF-...) o un RFC válido." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ found: false, error: "No se pudo consultar el estatus en este momento." });
  }
}
