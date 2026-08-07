import type { VercelRequest } from "@vercel/node";
import { ADMIN_HEADER, passwordMatches } from "./_adminAuth";
import { getClientKey, isRateLimited } from "./_ratelimit";

export type AdminCheck = { ok: true } | { ok: false; status: number; error: string };

// Every admin endpoint starts with this. Failing closed on an unconfigured
// password is the point: a missing env var must never leave the panel open.
export function requireAdmin(req: VercelRequest): AdminCheck {
  const expected = process.env.ROSETA_ADMIN_PASSWORD || "";
  if (!expected) {
    console.error("ROSETA_ADMIN_PASSWORD not configured");
    return { ok: false, status: 500, error: "El panel no está configurado todavía." };
  }
  // Best-effort brute-force brake: the limiter is per-lambda and in-memory,
  // same as the public endpoints use, so it slows an attacker rather than
  // stopping one.
  if (isRateLimited("factura-admin-auth:" + getClientKey(req), 60_000, 10)) {
    return { ok: false, status: 429, error: "Demasiados intentos, espera un minuto." };
  }
  const header = req.headers[ADMIN_HEADER];
  const provided = Array.isArray(header) ? header[0] : header || "";
  if (!passwordMatches(provided, expected)) {
    return { ok: false, status: 401, error: "Contraseña incorrecta." };
  }
  return { ok: true };
}
