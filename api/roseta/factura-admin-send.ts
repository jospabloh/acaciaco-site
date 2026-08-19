import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { getValues, updateRow } from "./_sheets";
import { requireAdmin } from "./_adminGuard";
import { parseCfdiFile } from "./_cfdiFiles";
import { COL, cell, findRowNumber, NOTIFY_EMAILS, plainAmount, SOLICITUDES_RANGE, todayISO } from "./_facturaRows";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function invoiceHtml(row: string[], folio: string): string {
  const facts: [string, string][] = [
    ["Folio", folio],
    ["Fecha de consumo", cell(row, COL.FECHA_CONSUMO)],
    ["Sucursal", cell(row, COL.SUCURSAL)],
    ["Monto", `$${cell(row, COL.MONTO)} MXN`],
  ];
  return (
    `<h2>Tu factura ya está lista</h2>` +
    `<p>Hola ${escapeHtml(cell(row, COL.RAZON_SOCIAL))}, adjuntamos la factura de tu consumo en Roseta Café.</p>` +
    `<table cellpadding="6" cellspacing="0" border="0">` +
    facts.map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("") +
    `</table>` +
    `<p style="margin-top:16px;"><strong>Conserva el archivo XML</strong>: ése es el comprobante fiscal válido ante el SAT. El PDF es sólo su representación impresa.</p>` +
    `<p>¿Algo no cuadra? Responde a este correo o escríbenos por WhatsApp al 449 895 8291.</p>` +
    `<p style="margin-top:16px;color:#888;font-size:12px;">Roseta Café · Sitio operado por ACACIA</p>`
  );
}

// Roseta requests the invoice by mail (factura-submit.ts's NOTIFY_EMAILS
// send) but until now was never told once it actually went out to the
// customer — the only way to know was to reopen the panel and check. This
// closes that loop with a short confirmation to the same addresses.
//
// The amount is deliberately plain — "###.##", no "$", no "MXN" — because
// this mail exists for Roseta to paste straight into her stamping or
// bookkeeping software, the same reason the admin panel's own "Copiar"
// buttons hand back a bare number instead of the human-readable $X.XX MXN.
function staffNotificationHtml(row: string[], folio: string, toEmail: string, archivos: string, notificadoEl: string): string {
  const facts: [string, string][] = [
    ["Folio", folio],
    ["Cliente", cell(row, COL.RAZON_SOCIAL)],
    ["RFC", cell(row, COL.RFC)],
    ["Enviada a", toEmail],
    ["Sucursal", cell(row, COL.SUCURSAL)],
    ["Fecha de consumo", cell(row, COL.FECHA_CONSUMO)],
    ["Monto", plainAmount(cell(row, COL.MONTO))],
    ["Archivos enviados", archivos],
    ["Notificado el", notificadoEl.slice(0, 10)],
  ];
  return (
    `<h2>Factura enviada al cliente</h2>` +
    `<p>La factura de la solicitud <strong>${escapeHtml(folio)}</strong> ya se envió al cliente. Esto es sólo un aviso, no requiere ninguna acción.</p>` +
    `<table cellpadding="6" cellspacing="0" border="0">` +
    facts.map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("") +
    `</table>` +
    `<p style="margin-top:16px;color:#888;font-size:12px;">Roseta Café · Notificación automática de acaciaco.com.mx</p>`
  );
}

// Best-effort: the customer's copy is the actual deliverable and already
// went out by the time this is called, so a failure here must never turn
// into a failed request or a warning that implies the invoice itself is at
// risk — Roseta simply won't get this particular heads-up and can still see
// the send recorded in the panel.
async function sendStaffNotification(
  resendClient: Resend,
  from: string,
  row: string[],
  folio: string,
  toEmail: string,
  archivos: string,
  notificadoEl: string,
): Promise<void> {
  try {
    const result = await resendClient.emails.send({
      from,
      to: NOTIFY_EMAILS,
      subject: `Factura enviada al cliente · ${folio}`,
      html: staffNotificationHtml(row, folio, toEmail, archivos, notificadoEl),
    });
    if (result.error) console.error("Resend error (staff notification)", result.error);
  } catch (err) {
    console.error("Staff notification email failed", err);
  }
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

    const pdf = parseCfdiFile(body.pdf, "pdf");
    const xml = parseCfdiFile(body.xml, "xml");
    if (!pdf || !xml) {
      return res.status(400).json({
        ok: false,
        error: "Adjunta el PDF y el XML de la factura. El XML es el comprobante fiscal válido, así que ambos son obligatorios.",
      });
    }

    const rows = await getValues(SOLICITUDES_RANGE);
    const rowNumber = findRowNumber(rows, folio);
    if (rowNumber < 0) {
      return res.status(400).json({ ok: false, error: `No existe una solicitud con el folio ${folio}.` });
    }
    const row = rows[rowNumber - 1];

    // The recipient always comes from the Sheet, never from the request body:
    // even with a leaked password this endpoint cannot mail arbitrary files to
    // an arbitrary address, only a registered customer's own invoice.
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

    // 1) The email is the deliverable, so it goes first. If it fails, nothing
    // is written and the request stays Pendiente — the status page must never
    // claim "Facturada" for an invoice the customer never received.
    const sent = await resend.emails.send({
      from,
      to: [email],
      replyTo: "roseta.cafeteria@gmail.com",
      subject: `Tu factura de Roseta Café ya está lista · ${folio}`,
      html: invoiceHtml(row, folio),
      attachments: [
        { filename: pdf.filename, content: pdf.content },
        { filename: xml.filename, content: xml.content },
      ],
    });

    if (sent.error) {
      console.error("Resend error (invoice delivery)", sent.error);
      return res.status(502).json({ ok: false, error: "No se pudo enviar el correo. La solicitud sigue pendiente; intenta de nuevo." });
    }

    // 2) Bookkeeping prep. Re-read the row and confirm the folio still matches
    // before writing: if Roseta inserted or deleted rows by hand while this
    // ran, the index could have shifted, and marking someone else's request
    // "Facturada" is an expensive mistake for a cheap check.
    const archivos = `${pdf.filename}, ${xml.filename}`;
    const notificadoEl = new Date().toISOString();
    // Resend's id for this message. Storing it is what lets the panel link
    // straight to the delivery record — whether it landed, bounced or is
    // still queued is Resend's to answer, and this is the pointer to the
    // answer. Never surfaced publicly.
    const resendId = sent.data?.id || "";

    // 2.5) Tell Roseta it went out. Fires regardless of how bookkeeping below
    // turns out — the customer's mail already succeeded, which is the only
    // thing this notification is reporting.
    await sendStaffNotification(resend, from, row, folio, email, archivos, notificadoEl);

    async function writeBookkeeping(): Promise<void> {
      const fresh = await getValues(SOLICITUDES_RANGE);
      const freshRow = findRowNumber(fresh, folio);
      if (freshRow < 0) throw new Error(`folio ${folio} disappeared from the sheet`);
      await updateRow(`Solicitudes!O${freshRow}:P${freshRow}`, ["Facturada", todayISO()]);
      await updateRow(`Solicitudes!S${freshRow}:U${freshRow}`, [notificadoEl, archivos, resendId]);
    }

    try {
      await writeBookkeeping();
    } catch (first) {
      console.error("Sheets bookkeeping failed, retrying once", first);
      try {
        await writeBookkeeping();
      } catch (second) {
        console.error("Sheets bookkeeping failed after retry", second);
        // The customer already has the invoice, so this is a success with a
        // caveat. Deliberately does NOT invite a resend — that would send a
        // second copy.
        return res.status(200).json({
          ok: true,
          email,
          warning: `El correo salió correctamente a ${email}, pero no pude marcar ${folio} como Facturada — márcala a mano en el Sheet. No vuelvas a enviar: el cliente ya tiene su factura.`,
        });
      }
    }

    return res.status(200).json({ ok: true, email, notificado_el: notificadoEl });
  } catch (err) {
    console.error("factura-admin-send failed", err);
    return res.status(500).json({ ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." });
  }
}
