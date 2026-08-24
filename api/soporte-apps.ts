// api/soporte-apps.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { getClientKey, isRateLimited } from "./_ratelimit";
import { validateSoporteSubmission } from "./_soporteValidation";

function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const TYPE_LABEL: Record<string, string> = { soporte: "Soporte", mejora: "Mejora", idea: "Idea / app nueva" };

interface SubmissionData {
  name: string;
  email: string;
  appInterest: string | null;
  type: string;
  message: string;
}

async function sendInternalAlert(resend: Resend, from: string, data: SubmissionData): Promise<void> {
  const to = (process.env.SUPPORT_APPS_NOTIFY_EMAIL || "soporte@acaciaco.com.mx,h.josepablo@gmail.com")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const html =
    `<h2>${TYPE_LABEL[data.type] ?? data.type} — Soporte a Apps</h2>` +
    `<p><strong>App:</strong> ${escapeHtml(data.appInterest ?? "— (idea / app nueva)")}</p>` +
    `<p><strong>Nombre:</strong> ${escapeHtml(data.name)}</p>` +
    `<p><strong>Correo:</strong> ${escapeHtml(data.email)}</p>` +
    `<p><strong>Mensaje:</strong></p><p>${escapeHtml(data.message).replace(/\n/g, "<br/>")}</p>`;
  const result = await resend.emails.send({
    from, to, replyTo: data.email,
    subject: `${TYPE_LABEL[data.type] ?? data.type}${data.appInterest ? " · " + data.appInterest : ""} — acaciaco.com.mx/soporte`,
    html,
  });
  if (result.error) console.error("Resend error (internal alert)", result.error);
}

async function sendConfirmationEmail(resend: Resend, from: string, data: SubmissionData): Promise<void> {
  const typeLabel = data.type === "idea" ? "idea" : (TYPE_LABEL[data.type] ?? data.type).toLowerCase();
  const html =
    `<h2>¡Recibimos tu solicitud!</h2>` +
    `<p>Hola ${escapeHtml(data.name)}, confirmamos que recibimos tu ${typeLabel}.</p>` +
    `<p>Te contactamos en menos de 24 horas hábiles.</p>` +
    `<p>¿Dudas mientras tanto? Responde a este correo o escríbenos por WhatsApp al 449 895 8291.</p>` +
    `<p style="margin-top:16px;color:#888;font-size:12px;">ACACIA · acaciaco.com.mx</p>`;
  try {
    const result = await resend.emails.send({
      from, to: [data.email],
      subject: "Recibimos tu solicitud · ACACIA",
      html,
    });
    if (result.error) console.error("Resend error (confirmation)", result.error);
  } catch (err) {
    console.error("Confirmation email failed", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    if (isRateLimited("soporte-apps:" + getClientKey(req), 60 * 60_000, 5)) {
      return res.status(429).json({ ok: false, error: "Demasiadas solicitudes, intenta de nuevo más tarde." });
    }

    const body = req.body || {};

    // Honeypot: real visitors never fill this hidden field. Respond as if it
    // worked so a bot doesn't learn the check exists, but do nothing further
    // — no ingest call, no email.
    if (required(body.website)) {
      return res.status(200).json({ ok: true });
    }

    const validation = validateSoporteSubmission(body);
    if (!validation.ok || !validation.data) {
      return res.status(400).json({ ok: false, error: validation.error || "Revisa los datos del formulario." });
    }
    const data = validation.data;

    // 1) Persist in Mission Control FIRST — this is what "que cada app vea
    // sus tickets" depends on. If this fails, no email goes out either:
    // there would be nothing for either message to confirm. This is the
    // inverse of api/roseta/factura-submit.ts's mail-first order, on purpose
    // — see the spec's "Orden escritura/correo" decision.
    const ingestUrl = process.env.MISSION_CONTROL_INGEST_URL || "https://control.acaciaco.com.mx/api/ingest/lead";
    const ingestSecret = process.env.INGEST_LEAD_SECRET;
    let ingestOk = false;
    try {
      const ingestRes = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(ingestSecret ? { "x-lead-secret": ingestSecret } : {}),
        },
        body: JSON.stringify({
          source: "acaciaco.com.mx/soporte",
          name: data.name,
          email: data.email,
          app_interest: data.appInterest,
          type: data.type,
          message: data.message,
        }),
      });
      ingestOk = ingestRes.ok;
      if (!ingestOk) console.error("Mission Control ingest failed", ingestRes.status, await ingestRes.text());
    } catch (err) {
      console.error("Mission Control ingest request failed", err);
    }
    if (!ingestOk) {
      return res.status(502).json({ ok: false, error: "No se pudo enviar tu solicitud, intenta de nuevo en un momento." });
    }

    // 2) Only now the two emails — best-effort each, but their failure must
    // never look like the request itself failed: the submission is already
    // saved in Mission Control by this point.
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      const from = process.env.SOPORTE_RESEND_FROM_EMAIL || "ACACIA <soporte@acaciaco.com.mx>";
      try {
        await sendInternalAlert(resend, from, data);
      } catch (err) {
        console.error("Internal alert email failed", err);
      }
      await sendConfirmationEmail(resend, from, data);
    } else {
      console.error("RESEND_API_KEY not configured — Soporte a Apps submission saved but no email sent");
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." });
  }
}
