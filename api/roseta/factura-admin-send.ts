import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { getValues, updateRow } from "./_sheets";
import { requireAdmin } from "./_adminGuard";
import { parseCfdiFile } from "./_cfdiFiles";
import { COL, cell, findRowNumber, SOLICITUDES_RANGE, todayISO } from "./_facturaRows";

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

    // 2) Bookkeeping. Re-read the row and confirm the folio still matches
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
