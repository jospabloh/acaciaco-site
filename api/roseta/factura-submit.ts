import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { appendRow, getValues, sanitizeCell, updateRow } from "./_sheets";
import { getClientKey, isRateLimited } from "./_ratelimit";
import { SOLICITUDES_RANGE } from "./_facturaRows";

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CP_RE = /^\d{5}$/;
// Hard ceiling on the base64 payload we accept for a single attachment —
// generous compared to the client's own (tighter) budget, just a backstop.
const MAX_DATA_URL_LEN = 6 * 1024 * 1024;

const NOTIFY_EMAILS = ["roseta.cafeteria@gmail.com", "roseta@acaciaco.com.mx"];

interface FileField {
  name?: string;
  type?: string;
  dataUrl?: string;
}

function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseDataUrl(f: FileField | null | undefined): { filename: string; content: string } | null {
  if (!f || !f.dataUrl) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(f.dataUrl);
  if (!match) return null;
  if (f.dataUrl.length > MAX_DATA_URL_LEN) return null;
  return { filename: f.name || "archivo", content: match[2] };
}

function makeFolio(): string {
  const now = new Date();
  const ymd =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RF-${ymd}-${rand}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// The customer only ever saw an on-screen confirmation, never an actual
// email — this sends them one too, separate from (and much shorter than)
// the internal notification Roseta's team gets, since it must never leak
// internal-only fields like the estimated subtotal. Best-effort: a failure
// here doesn't fail the request, the customer already has the on-screen
// confirmation and their folio either way.
async function sendClientConfirmationEmail(
  resendClient: Resend | null,
  from: string,
  toEmail: string,
  folio: string,
  isDuplicate: boolean,
): Promise<void> {
  if (!resendClient) return;
  const statusUrl = `https://acaciaco.com.mx/roseta/factura/estatus?folio=${encodeURIComponent(folio)}`;
  const html =
    `<h2>${isDuplicate ? "Ya teníamos tu solicitud" : "¡Recibimos tu solicitud de factura!"}</h2>` +
    `<p>${
      isDuplicate
        ? "Ya teníamos registrada tu solicitud de factura para este mismo consumo — no hace falta enviarla de nuevo."
        : "Confirmamos que recibimos tu solicitud de factura de Roseta Café."
    }</p>` +
    `<p>Deberías recibirla en este correo en un máximo de <strong>3 días hábiles</strong>.</p>` +
    `<p>Folio: <strong>${escapeHtml(folio)}</strong></p>` +
    `<p>Puedes consultar el estatus de tu solicitud aquí: <a href="${statusUrl}">${statusUrl}</a></p>` +
    `<p>¿Dudas? Responde a este correo o escríbenos por WhatsApp al 449 895 8291.</p>` +
    `<p style="margin-top:16px;color:#888;font-size:12px;">Roseta Café · Sitio operado por ACACIA</p>`;
  try {
    const result = await resendClient.emails.send({
      from,
      to: [toEmail],
      replyTo: NOTIFY_EMAILS[0],
      subject: isDuplicate ? "Ya teníamos tu solicitud de factura · Roseta Café" : "Recibimos tu solicitud de factura · Roseta Café",
      html,
    });
    if (result.error) console.error("Resend error (client confirmation)", result.error);
  } catch (err) {
    console.error("Client confirmation email failed", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    if (isRateLimited("factura-submit:" + getClientKey(req), 60_000, 8)) {
      return res.status(429).json({ ok: false, error: "Demasiadas solicitudes, intenta de nuevo en un minuto." });
    }

    const body = req.body || {};

    // Honeypot: real users never fill this hidden field. Respond as if it
    // worked so bots don't learn the check exists, but do nothing further.
    if (required(body.website)) {
      return res.status(200).json({ ok: true, folio: makeFolio() });
    }

    const rfc = String(body.rfc || "").trim().toUpperCase();
    const razonSocial = String(body.razon_social || "").trim();
    const regimenFiscal = String(body.regimen_fiscal || "").trim();
    const usoCfdi = String(body.uso_cfdi || "").trim();
    const codigoPostal = String(body.codigo_postal || "").trim();
    const email = String(body.email || "").trim();
    const telefono = String(body.telefono || "").trim();
    const sucursal = String(body.sucursal || "").trim();
    const fechaConsumo = String(body.fecha_consumo || "").trim();
    const monto = String(body.monto || "").trim();
    const formaPago = String(body.forma_pago || "").trim();
    const folioTicket = String(body.folio_ticket || "").trim();
    const sinMovimiento = body.sin_movimiento === true;

    if (
      !RFC_RE.test(rfc) ||
      !required(razonSocial) ||
      !required(regimenFiscal) ||
      !required(usoCfdi) ||
      !CP_RE.test(codigoPostal) ||
      !EMAIL_RE.test(email) ||
      !required(sucursal) ||
      !required(fechaConsumo) ||
      !required(formaPago) ||
      !(Number(monto) > 0) ||
      (!required(folioTicket) && !sinMovimiento)
    ) {
      return res.status(400).json({ ok: false, error: "Revisa los datos del formulario, algo no es válido." });
    }

    // Without a ticket photo there's no "Movimiento" number to uniquely
    // identify the sale, so RFC + fecha de consumo + monto + correo is the
    // best available stand-in — if this exact combination was already
    // submitted, treat it as the same consumption rather than creating a
    // second entry. Fails open (no dedup) on a lookup error, since blocking
    // a genuinely new request is worse than an occasional duplicate row.
    let existingSolicitudes: string[][] = [];
    try {
      existingSolicitudes = await getValues(SOLICITUDES_RANGE);
    } catch (err) {
      console.error("Solicitudes lookup (dup-check) failed", err);
    }
    const dupRow = existingSolicitudes.find(
      (r, i) =>
        i > 0 &&
        (r[2] || "").toUpperCase() === rfc &&
        (r[10] || "") === fechaConsumo &&
        Number(r[11]) === Number(monto) &&
        (r[7] || "").toLowerCase() === email.toLowerCase(),
    );
    if (dupRow) {
      const dupApiKey = process.env.RESEND_API_KEY;
      const dupFrom = process.env.RESEND_FROM_EMAIL || "Roseta Café <facturacion@acaciaco.com.mx>";
      await sendClientConfirmationEmail(dupApiKey ? new Resend(dupApiKey) : null, dupFrom, email, dupRow[0], true);
      return res.status(200).json({ ok: true, folio: dupRow[0], duplicate: true });
    }

    // Roseta can reuse a CSF she already has on file, so returning customers
    // don't need to re-upload one — but that's only trustworthy if *we*
    // verify the RFC is actually known, not a flag the client could send.
    // A lookup failure fails safe (treated as unknown) so an outage can't
    // silently waive the requirement for a genuinely new customer.
    let existingClientRows: string[][] = [];
    let isKnownRfc = false;
    try {
      existingClientRows = await getValues("ClientesRFC!A:H");
      isKnownRfc = existingClientRows.some((r, i) => i > 0 && (r[0] || "").toUpperCase() === rfc);
    } catch (err) {
      console.error("ClientesRFC lookup failed", err);
    }

    const csf = parseDataUrl(body.csf);
    if (!csf && !isKnownRfc) {
      return res.status(400).json({ ok: false, error: "Adjunta tu Constancia de Situación Fiscal vigente (máx. 3 MB)." });
    }
    const ticket = parseDataUrl(body.ticket);

    // Subtotal (before IVA) is internal-only — Roseta's team sees it in the
    // email, the customer never does. Trust an amount Claude read straight
    // off the ticket only if it's plausible for a 16% IVA total; otherwise
    // derive it from the total, both rounded to the cent.
    const montoNum = Number(monto);
    const extractedSubtotal = Number(body.ticket_subtotal);
    let subtotal: number;
    let subtotalSource: string;
    if (
      Number.isFinite(extractedSubtotal) &&
      extractedSubtotal > 0 &&
      extractedSubtotal < montoNum &&
      Math.abs(montoNum - extractedSubtotal * 1.16) < 2
    ) {
      subtotal = Math.round(extractedSubtotal * 100) / 100;
      subtotalSource = "del ticket";
    } else {
      subtotal = Math.round((montoNum / 1.16) * 100) / 100;
      subtotalSource = "estimado, IVA 16%";
    }
    const iva = Math.round((montoNum - subtotal) * 100) / 100;

    const folio = makeFolio();
    const fechaSolicitud = new Date().toISOString().slice(0, 10);

    // 1) Send the email — this is the actual deliverable the client is
    // waiting on, so a failure here is a real failure of the request.
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY not configured");
      return res.status(500).json({ ok: false, error: "El envío de correo no está configurado todavía. Escríbenos a roseta.cafeteria@gmail.com." });
    }
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM_EMAIL || "Roseta Café <facturacion@acaciaco.com.mx>";

    const rows: [string, string][] = [
      ["Folio", folio],
      ["Fecha de solicitud", fechaSolicitud],
      ["RFC", rfc],
      ["Razón social / Nombre", razonSocial],
      ["Régimen fiscal", regimenFiscal],
      ["Uso de CFDI", usoCfdi],
      ["Código postal fiscal", codigoPostal],
      ["Correo del cliente", email],
      ["Teléfono", telefono || "—"],
      ["Sucursal", sucursal],
      ["Fecha de consumo", fechaConsumo],
      ["Monto del ticket", `$${monto} MXN`],
      ["Subtotal (antes de IVA)", `$${subtotal.toFixed(2)} MXN (${subtotalSource})`],
      ["IVA", `$${iva.toFixed(2)} MXN`],
      ["Forma de pago", formaPago],
      ["Movimiento / folio de ticket", folioTicket || (sinMovimiento ? "No cuenta con él — identificar por RFC + fecha + monto + correo" : "—")],
    ];
    const html =
      `<h2>Factura por consumo solicitada</h2>` +
      `<p>Nueva solicitud de factura recibida desde acaciaco.com.mx/roseta/factura.</p>` +
      `<table cellpadding="6" cellspacing="0" border="0">` +
      rows.map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`).join("") +
      `</table>` +
      (ticket ? `` : `<p><em>El cliente no adjuntó foto del ticket.</em></p>`) +
      (csf ? `` : `<p><em>Cliente recurrente — no se adjuntó una CSF nueva, ya contamos con la suya de una solicitud anterior (RFC ${escapeHtml(rfc)}).</em></p>`) +
      `<p style="margin-top:16px;color:#888;font-size:12px;">Se le indicó al cliente que recibirá su factura en un máximo de 3 días hábiles.</p>`;

    const attachments: { filename: string; content: string }[] = [];
    if (csf) attachments.push({ filename: csf.filename, content: csf.content });
    if (ticket) attachments.push({ filename: ticket.filename, content: ticket.content });

    const sendResult = await resend.emails.send({
      from,
      to: NOTIFY_EMAILS,
      replyTo: email,
      subject: "Factura por consumo solicitada",
      html,
      attachments,
    });

    if (sendResult.error) {
      console.error("Resend error", sendResult.error);
      return res.status(502).json({ ok: false, error: "No se pudo enviar tu solicitud, intenta de nuevo en un momento." });
    }

    await sendClientConfirmationEmail(resend, from, email, folio, false);

    // 2) Best-effort bookkeeping in Sheets — powers the public status lookup
    // and RFC autofill, but must never block the email that already went out.
    try {
      // Estatus (O) and Fecha de facturación (P) stay exactly where they've
      // always been — Roseta edits Estatus by hand, so those columns must
      // never shift. Subtotal/IVA are appended strictly after them (Q, R),
      // and the delivery bookkeeping after those (S, T).
      //
      // The range spans the full table (A:T) even though the last two cells
      // are empty: appending a shorter range than the table occupies leaves
      // Sheets to guess the table bounds. Empty S/T is exactly right for a
      // new request — it has not been mailed to the customer yet, and
      // factura-admin-send.ts fills them in when it is.
      await appendRow(SOLICITUDES_RANGE, [
        folio,
        fechaSolicitud,
        rfc,
        sanitizeCell(razonSocial),
        regimenFiscal,
        usoCfdi,
        codigoPostal,
        email,
        telefono,
        sucursal,
        fechaConsumo,
        monto,
        formaPago,
        sanitizeCell(folioTicket),
        "Pendiente",
        "",
        subtotal.toFixed(2),
        iva.toFixed(2),
        "", // S · Notificado el — filled in when the CFDI is mailed
        "", // T · Archivos enviados
      ]);
    } catch (err) {
      console.error("Sheets append (Solicitudes) failed", err);
    }

    try {
      const rowIndex = existingClientRows.findIndex((r, i) => i > 0 && (r[0] || "").toUpperCase() === rfc);
      const clientRow = [
        rfc,
        sanitizeCell(razonSocial),
        regimenFiscal,
        usoCfdi,
        codigoPostal,
        email,
        telefono,
        fechaSolicitud,
      ];
      if (rowIndex > 0) {
        await updateRow(`ClientesRFC!A${rowIndex + 1}:H${rowIndex + 1}`, clientRow);
      } else {
        await appendRow("ClientesRFC!A:H", clientRow);
      }
    } catch (err) {
      console.error("Sheets upsert (ClientesRFC) failed", err);
    }

    return res.status(200).json({ ok: true, folio });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." });
  }
}
