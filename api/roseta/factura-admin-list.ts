import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getValues } from "./_sheets";
import { requireAdmin } from "./_adminGuard";
import { COL, cell, resendEmailUrl, SOLICITUDES_RANGE } from "./_facturaRows";
import { regimenDisplay, resolveRegimenClave } from "./_facturaValidation";

// Unlike the public status lookup, this one is authenticated and returns the
// full fiscal record — Roseta needs it to key the invoice into her stamping
// software without switching windows.
function adminSolicitud(row: string[]) {
  return {
    folio: cell(row, COL.FOLIO),
    fecha_solicitud: cell(row, COL.FECHA_SOLICITUD),
    rfc: cell(row, COL.RFC),
    razon_social: cell(row, COL.RAZON_SOCIAL),
    // Two shapes on purpose, the same split as fmtMoney/plainAmount: the
    // panel SHOWS "601 · General de Ley Personas Morales" so Roseta can check
    // it against a CSF, and its "Copiar" button yields the bare "601", which
    // is what her stamping software wants. Rows written before the Sheet
    // stored the name carry a bare clave, so resolving here makes old and new
    // requests read the same.
    regimen_fiscal: regimenDisplay(cell(row, COL.REGIMEN)),
    regimen_clave: resolveRegimenClave(cell(row, COL.REGIMEN), cell(row, COL.REGIMEN)) || cell(row, COL.REGIMEN),
    uso_cfdi: cell(row, COL.USO_CFDI),
    codigo_postal: cell(row, COL.CODIGO_POSTAL),
    email: cell(row, COL.EMAIL),
    telefono: cell(row, COL.TELEFONO),
    sucursal: cell(row, COL.SUCURSAL),
    fecha_consumo: cell(row, COL.FECHA_CONSUMO),
    monto: cell(row, COL.MONTO),
    subtotal: cell(row, COL.SUBTOTAL),
    iva: cell(row, COL.IVA),
    forma_pago: cell(row, COL.FORMA_PAGO),
    folio_ticket: cell(row, COL.FOLIO_TICKET),
    estatus: cell(row, COL.ESTATUS) || "Pendiente",
    fecha_facturacion: cell(row, COL.FECHA_FACTURACION),
    notificado_el: cell(row, COL.NOTIFICADO_EL),
    archivos: cell(row, COL.ARCHIVOS),
    // Built here rather than in the browser so the dashboard path lives in
    // one place. Empty for requests sent before this column existed.
    resend_url: cell(row, COL.RESEND_ID) ? resendEmailUrl(cell(row, COL.RESEND_ID)) : "",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "GET only" });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    // Reads the whole tab and filters in memory, same as the other Roseta
    // endpoints. Comfortable at the current volume; paginating is a later,
    // isolated change to this file if the tab ever grows enough to matter.
    const rows = await getValues(SOLICITUDES_RANGE);
    const filtro = String(req.query.filtro || "pendientes");
    const all = rows.slice(1).filter((row) => cell(row, COL.FOLIO));

    const solicitudes = all
      .filter((row) => {
        const estatus = (cell(row, COL.ESTATUS) || "Pendiente").toLowerCase();
        if (filtro === "facturadas") return estatus === "facturada";
        if (filtro === "todas") return true;
        return estatus !== "facturada";
      })
      .map(adminSolicitud)
      .reverse(); // rows are appended chronologically; newest first

    return res.status(200).json({ ok: true, solicitudes });
  } catch (err) {
    console.error("factura-admin-list failed", err);
    // Surfaced as an error, never as an empty list — "no pending requests"
    // and "the Sheet is unreachable" must not look the same to Roseta.
    return res.status(502).json({ ok: false, error: "No se pudo leer el Sheet. Intenta de nuevo." });
  }
}
