// Pure helpers over the Solicitudes tab. No I/O — everything here is
// unit-testable, and the endpoints stay thin orchestration.
//
// Column order is written by factura-submit.ts. Estatus (O) and Fecha de
// facturación (P) are edited by hand in the Sheet, so nothing may shift
// them: new columns are appended strictly after R.
export const COL = {
  FOLIO: 0,
  FECHA_SOLICITUD: 1,
  RFC: 2,
  RAZON_SOCIAL: 3,
  REGIMEN: 4,
  USO_CFDI: 5,
  CODIGO_POSTAL: 6,
  EMAIL: 7,
  TELEFONO: 8,
  SUCURSAL: 9,
  FECHA_CONSUMO: 10,
  MONTO: 11,
  FORMA_PAGO: 12,
  FOLIO_TICKET: 13,
  ESTATUS: 14,
  FECHA_FACTURACION: 15,
  SUBTOTAL: 16,
  IVA: 17,
  NOTIFICADO_EL: 18,
  ARCHIVOS: 19,
  RESEND_ID: 20,
} as const;

export const SOLICITUDES_RANGE = "Solicitudes!A:U";

// Resend's dashboard URL for a single email. Kept here so the panel and any
// future consumer agree on it, and so there is one place to fix if Resend
// ever changes the path.
export function resendEmailUrl(id: string): string {
  return `https://resend.com/emails/${encodeURIComponent(String(id || "").trim())}`;
}
export const RFC_WINDOW_DAYS = 30;

export interface PublicSolicitud {
  folio: string;
  fecha_solicitud: string;
  sucursal: string;
  monto: string;
  estatus: string;
  fecha_facturacion: string;
  notificado_el: string;
}

export function cell(row: string[] | undefined, idx: number): string {
  const v = row && row[idx];
  return v == null ? "" : String(v).trim();
}

export function fmtMoney(v: string): string {
  const n = Number(v);
  return v !== "" && Number.isFinite(n) ? `$${n.toFixed(2)} MXN` : v;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// A row whose date is missing, malformed or in the future is shown rather
// than hidden — it is the customer's own request, and a data anomaly is a
// worse reason to hide it than to display it.
export function isWithinDays(fecha: string, days: number, today: string): boolean {
  const from = Date.parse(`${String(fecha || "").trim()}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return true;
  const elapsed = to - from;
  if (elapsed < 0) return true;
  return elapsed <= days * 86_400_000;
}

// Deliberately narrow: email, razón social, código postal and teléfono are
// NOT included. An individual's RFC is derivable from their name and date of
// birth, so the public lookup must stay poor in personal data.
export function publicSolicitud(row: string[]): PublicSolicitud {
  return {
    folio: cell(row, COL.FOLIO),
    fecha_solicitud: cell(row, COL.FECHA_SOLICITUD),
    sucursal: cell(row, COL.SUCURSAL),
    monto: fmtMoney(cell(row, COL.MONTO)),
    estatus: cell(row, COL.ESTATUS) || "Pendiente",
    fecha_facturacion: cell(row, COL.FECHA_FACTURACION),
    notificado_el: cell(row, COL.NOTIFICADO_EL),
  };
}

// `rows` includes the header at index 0 and Sheets rows are 1-based, so the
// sheet row number for rows[i] is i + 1. Returns -1 when not found.
export function findRowNumber(rows: string[][], folio: string): number {
  const target = String(folio || "").trim().toUpperCase();
  if (!target) return -1;
  for (let i = 1; i < rows.length; i++) {
    if (cell(rows[i], COL.FOLIO).toUpperCase() === target) return i + 1;
  }
  return -1;
}

// A folio is a direct reference to one request, so it is never time-boxed —
// hiding someone's own request because it is old would be absurd. The window
// applies only to the RFC listing below.
export function selectByFolio(rows: string[][], folio: string): PublicSolicitud[] {
  const target = String(folio || "").trim().toUpperCase();
  const hit = rows.find((row, i) => i > 0 && cell(row, COL.FOLIO).toUpperCase() === target);
  return hit ? [publicSolicitud(hit)] : [];
}

// `rfcExists` lets the page tell "we have nothing for that RFC" apart from
// "we have older requests but none in the window" — the difference between a
// dead end and a useful instruction.
export function selectByRfc(
  rows: string[][],
  rfc: string,
  today: string,
): { solicitudes: PublicSolicitud[]; rfcExists: boolean } {
  const target = String(rfc || "").trim().toUpperCase();
  const mine = rows.filter((row, i) => i > 0 && cell(row, COL.RFC).toUpperCase() === target);
  const inWindow = mine.filter((row) =>
    isWithinDays(cell(row, COL.FECHA_SOLICITUD), RFC_WINDOW_DAYS, today),
  );
  inWindow.sort((a, b) =>
    cell(b, COL.FECHA_SOLICITUD).localeCompare(cell(a, COL.FECHA_SOLICITUD)),
  );
  return { solicitudes: inWindow.map(publicSolicitud), rfcExists: mine.length > 0 };
}
