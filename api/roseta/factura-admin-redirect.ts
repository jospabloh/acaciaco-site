import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { getValues, updateRow } from "./_sheets";
import { requireAdmin } from "./_adminGuard";
import {
  COL,
  cell,
  ESTATUS_SUCURSAL_INCORRECTA,
  FICO_3C_SUCURSAL,
  findRowNumber,
  OTHER_BRANCH_CONTACTS,
  SOLICITUDES_RANGE,
} from "./_facturaRows";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// The one thing this endpoint ever sends: a short redirect, never an
// invoice. The contact paragraph is the only part that varies by branch — a
// known one gets its direct number, an unrecognized one (the "Otra" option,
// or a future branch OTHER_BRANCH_CONTACTS hasn't caught up to yet) gets a
// generic pointer instead of a guessed number.
function redirectHtml(row: string[], folio: string): string {
  const razonSocial = cell(row, COL.RAZON_SOCIAL);
  const sucursal = cell(row, COL.SUCURSAL);
  const contacto = OTHER_BRANCH_CONTACTS[sucursal];
  const facts: [string, string][] = [
    ["Folio", folio],
    ["Sucursal", sucursal],
    ["Fecha de consumo", cell(row, COL.FECHA_CONSUMO)],
  ];
  return (
    `<h2>Tu ticket es de otra sucursal</h2>` +
    `<p>Hola ${escapeHtml(razonSocial)}, tu solicitud de factura (folio <strong>${escapeHtml(folio)}</strong>) corresponde a un consumo en <strong>Roseta ${escapeHtml(sucursal)}</strong>. Este sistema en línea sólo procesa las facturas de <strong>Roseta ${escapeHtml(FICO_3C_SUCURSAL)}</strong>.</p>` +
    `<table cellpadding="6" cellspacing="0" border="0">` +
    facts.map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("") +
    `</table>` +
    (contacto
      ? `<p style="margin-top:16px;">Para facturar tu consumo en ${escapeHtml(sucursal)}, contáctalos directamente al <strong>${escapeHtml(contacto)}</strong>.</p>`
      : `<p style="margin-top:16px;">Para facturar tu consumo, contacta directamente a la sucursal de Roseta Café donde hiciste tu compra.</p>`) +
    `<p>¿Dudas? Responde a este correo o escríbenos por WhatsApp al 449 895 8291.</p>` +
    `<p style="margin-top:16px;color:#888;font-size:12px;">Roseta Café · Sitio operado por ACACIA</p>`
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    const body = req.body || {};
    const folio = String(body.folio || "").trim().toUpperCase();
    if (!folio) return res.status(400).json({ ok: false, error: "Falta el folio." });

    const rows = await getValues(SOLICITUDES_RANGE);
    const rowNumber = findRowNumber(rows, folio);
    if (rowNumber < 0) {
      return res.status(400).json({ ok: false, error: `No existe una solicitud con el folio ${folio}.` });
    }
    const row = rows[rowNumber - 1];

    // Never trust the button alone — a Fico 3C row has nothing to redirect.
    const sucursal = cell(row, COL.SUCURSAL);
    if (sucursal === FICO_3C_SUCURSAL) {
      return res.status(400).json({ ok: false, error: `${folio} ya es de ${FICO_3C_SUCURSAL} — no hace falta avisar nada.` });
    }

    // The recipient always comes from the Sheet, never from the request
    // body — same rule as factura-admin-send.ts.
    const email = cell(row, COL.EMAIL);
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: `La solicitud ${folio} no tiene un correo válido registrado.` });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY not configured");
      return res.status(500).json({ ok: false, error: "El envío de correo no está configurado todavía." });
    }
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || "Roseta Café <facturacion@acaciaco.com.mx>";

    // 1) The email is the point of this endpoint, so it goes first. If it
    // fails, nothing is written and the request stays exactly as it was.
    const sent = await resend.emails.send({
      from,
      to: [email],
      replyTo: "roseta.cafeteria@gmail.com",
      subject: `Tu ticket es de otra sucursal de Roseta Café · ${folio}`,
      html: redirectHtml(row, folio),
    });

    if (sent.error) {
      console.error("Resend error (branch redirect)", sent.error);
      return res.status(502).json({ ok: false, error: "No se pudo enviar el correo. Intenta de nuevo." });
    }

    // 2) Bookkeeping. Re-read the row and confirm the folio still matches
    // before writing — same reasoning as factura-admin-send.ts: a row
    // inserted or deleted by hand mid-request can shift the index.
    const notificadoEl = new Date().toISOString();
    const resendId = sent.data?.id || "";

    async function writeBookkeeping(): Promise<void> {
      const fresh = await getValues(SOLICITUDES_RANGE);
      const freshRow = findRowNumber(fresh, folio);
      if (freshRow < 0) throw new Error(`folio ${folio} disappeared from the sheet`);
      // P stays empty on purpose: nothing was invoiced, so there is no
      // fecha de facturación to record.
      await updateRow(`Solicitudes!O${freshRow}:P${freshRow}`, [ESTATUS_SUCURSAL_INCORRECTA, ""]);
      await updateRow(`Solicitudes!S${freshRow}:U${freshRow}`, [notificadoEl, "Aviso de sucursal", resendId]);
    }

    try {
      await writeBookkeeping();
    } catch (first) {
      console.error("Sheets bookkeeping failed, retrying once", first);
      try {
        await writeBookkeeping();
      } catch (second) {
        console.error("Sheets bookkeeping failed after retry", second);
        // The customer already has the redirect, so this is a success with
        // a caveat — same shape as factura-admin-send.ts's own warning.
        return res.status(200).json({
          ok: true,
          email,
          sucursal,
          warning: `El correo salió correctamente a ${email}, pero no pude marcar ${folio} como "${ESTATUS_SUCURSAL_INCORRECTA}" — márcalo a mano en el Sheet.`,
        });
      }
    }

    return res.status(200).json({ ok: true, email, sucursal });
  } catch (err) {
    console.error("factura-admin-redirect failed", err);
    return res.status(500).json({ ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." });
  }
}
