// api/_soporteValidation.ts
// Pure validation for Soporte a Apps (api/soporte-apps.ts). No imports, so
// `node --test` can load this directly — same reasoning as
// api/roseta/_adminAuth.ts: the request-shaped code that needs _ratelimit
// lives in the handler, not here.

export const KNOWN_APPS = [
  "Puntos+", "FlowFin", "StockFlow", "Rumbo", "LIUMA",
  "CateqHub", "RADAR", "CtrlHQ", "KitchOps",
] as const;

export type SoporteType = "soporte" | "mejora" | "idea";

export interface SoporteSubmission {
  name: string;
  email: string;
  appInterest: string | null; // null → "Otra idea / app nueva"
  type: SoporteType;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  data?: SoporteSubmission;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// The client sends the sentinel "__idea__" for "Otra idea / app nueva" (see
// soporte.html) — this is the one place that sentinel is interpreted.
export function validateSoporteSubmission(body: Record<string, unknown>): ValidationResult {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const rawApp = String(body.app_interest ?? "").trim();
  const rawType = String(body.type ?? "").trim();

  if (!required(name) || name.length > 200) return { ok: false, error: "Nombre inválido." };
  if (!EMAIL_RE.test(email) || email.length > 255) return { ok: false, error: "Correo inválido." };
  if (!required(message) || message.length > 4000) return { ok: false, error: "Escribe tu mensaje (máx. 4000 caracteres)." };

  const isIdea = rawApp === "__idea__";
  const appInterest = isIdea ? null : rawApp;

  if (!isIdea && !(KNOWN_APPS as readonly string[]).includes(appInterest as string)) {
    return { ok: false, error: "Elige una app válida." };
  }

  // The invariant the spec's decisions table describes: type is fixed to
  // "idea" when there's no real app, and must be soporte/mejora otherwise —
  // enforced here too, not just by hiding the selector client-side.
  if (isIdea) {
    if (rawType !== "" && rawType !== "idea") return { ok: false, error: "Tipo inválido para una idea nueva." };
    return { ok: true, data: { name, email, appInterest: null, type: "idea", message } };
  }
  if (rawType !== "soporte" && rawType !== "mejora") {
    return { ok: false, error: "Elige Soporte o Mejora." };
  }
  return { ok: true, data: { name, email, appInterest, type: rawType, message } };
}
