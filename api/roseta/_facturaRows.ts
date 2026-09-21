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
  // Appended after U, so it never shifts the hand-edited O/P. Column B
  // (Fecha de solicitud) stays a plain date for Roseta to scan in the
  // Sheet; this one carries the full instant so the admin panel's heat bar
  // can count business HOURS, not just whole days. Empty on rows written
  // before this column existed — fallbackSolicitudTimestamp() below covers
  // those.
  HORA_SOLICITUD: 21,
} as const;

export const SOLICITUDES_RANGE = "Solicitudes!A:V";

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

// Amounts that are meant to be pasted straight into Roseta's stamping or
// accounting software, which expects a bare number — no "$", no "MXN".
// Deliberately the inverse trade-off from fmtMoney: that one is for reading,
// this one is for pasting into a field that would choke on currency symbols.
export function plainAmount(v: string): string {
  const n = Number(v);
  return v !== "" && Number.isFinite(n) ? n.toFixed(2) : v;
}

// The internal address for every Roseta invoice-flow notification: new
// requests (factura-submit.ts) and "ya se envió al cliente" confirmations
// (factura-admin-send.ts) both mail here.
export const NOTIFY_EMAILS = ["roseta.cafeteria@gmail.com", "roseta@acaciaco.com.mx"];

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Unlike todayISO(), keeps the time — businessHoursElapsed() needs the
// actual instant, not just the calendar day, to size a partial day.
export function nowISO(): string {
  return new Date().toISOString();
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

// The promise quoted as copy across the site ("recíbela en un máximo de 3
// días hábiles") — this is the only place that number exists as a value
// rather than Spanish text, so the admin panel's heat bar has one threshold
// to compare against.
export const FACTURA_SLA_BUSINESS_DAYS = 3;

// Roseta Café's business hours (Aguascalientes, "Zona Centro" — a fixed
// UTC-6 year-round since Mexico dropped daylight saving nationally in 2022,
// so no DST table is needed here). A whole-day count treats a request filed
// at 5pm the same as one filed at 8am, which isn't fair to whoever files
// early — so the SLA clock runs in business HOURS, not days.
const MX_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;
const BUSINESS_OPEN_HOUR = 7;
const BUSINESS_CLOSE_HOUR = 18;
export const FACTURA_BUSINESS_HOURS_PER_DAY = BUSINESS_CLOSE_HOUR - BUSINESS_OPEN_HOUR; // 11
export const FACTURA_SLA_BUSINESS_HOURS = FACTURA_SLA_BUSINESS_DAYS * FACTURA_BUSINESS_HOURS_PER_DAY; // 33

// An ISO instant for `hour:00` Mexico City time on `dateISO`, as UTC — e.g.
// mxLocalTimeIso("2026-09-19", 7) is 2026-09-19T13:00:00.000Z. Used to
// synthesize a timestamp for data that only ever recorded a date: a legacy
// row with no HORA_SOLICITUD (fallbackSolicitudTimestamp), and P (Fecha de
// facturación), which Roseta always hand-types as a bare date
// (fallbackFacturacionTimestamp). Empty/malformed input reads as "" rather
// than a garbage date, matching the other guards in this file.
function mxLocalTimeIso(dateISO: string, hour: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || "").trim());
  if (!m) return "";
  const [, y, mo, d] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), hour) + MX_UTC_OFFSET_MS).toISOString();
}

// A legacy request row has only a date (Fecha de solicitud) — falls back to
// the start of business hours that day, the least-wrong single guess when
// the real minute was never recorded.
export function fallbackSolicitudTimestamp(fechaSolicitudISO: string): string {
  return mxLocalTimeIso(fechaSolicitudISO, BUSINESS_OPEN_HOUR);
}

// Fecha de facturación is hand-typed by Roseta as a bare date, so the exact
// delivery minute never existed to begin with — falls back to the end of
// business hours that day, the same "assume the full day was used" bias as
// the open-hour fallback above.
export function fallbackFacturacionTimestamp(fechaFacturacionISO: string): string {
  return mxLocalTimeIso(fechaFacturacionISO, BUSINESS_CLOSE_HOUR);
}

// The Nth `weekday` of `monthIndex0` (0 = January) in `year`, as an ISO date.
// Backs the two floating federal holidays below, which are defined by
// weekday-of-month, not a fixed day.
function nthWeekdayOfMonth(year: number, monthIndex0: number, weekday: number, n: number): string {
  let seen = 0;
  const d = new Date(Date.UTC(year, monthIndex0, 1));
  while (true) {
    if (d.getUTCDay() === weekday) {
      seen++;
      if (seen === n) return d.toISOString().slice(0, 10);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

// The mandatory nationwide holidays under LFT Art. 74 — the calendar SAT and
// every Mexican payroll/invoicing system treats as non-hábil. Computed per
// year rather than hardcoded so this never goes stale. Deliberately excludes
// "transmisión del Poder Ejecutivo Federal" (Oct 1, once every six years,
// next in 2030): it's a federal-government handover, not a day a café closes.
function mexicanHolidays(year: number): Set<string> {
  return new Set([
    `${year}-01-01`, // Año Nuevo
    nthWeekdayOfMonth(year, 1, 1, 1), // primer lunes de febrero — Día de la Constitución
    nthWeekdayOfMonth(year, 2, 1, 3), // tercer lunes de marzo — natalicio de Benito Juárez
    `${year}-05-01`, // Día del Trabajo
    `${year}-09-16`, // Día de la Independencia
    nthWeekdayOfMonth(year, 10, 1, 3), // tercer lunes de noviembre — Revolución Mexicana
    `${year}-12-25`, // Navidad
  ]);
}

// Sums the business hours (Mon–Fri, BUSINESS_OPEN_HOUR–BUSINESS_CLOSE_HOUR
// Mexico City time, federal holidays excluded) that fall between `fromISO`
// and `toISO`, as a fractional number of hours. Walks one calendar day at a
// time — from and to are shifted into "fake UTC" by subtracting the fixed MX
// offset, so getUTCDay()/getUTCHours() read Mexico City's wall clock without
// a timezone library — and adds the overlap between each day's business
// window and the [from, to) span. A request outside business hours (say,
// filed at 9pm) contributes nothing until the window next opens, which is
// exactly what makes this fair to an early filer without any special-casing:
// the hours just aren't there to count. A missing/malformed timestamp, or a
// `to` on or before `from`, reads as 0 rather than throwing — same "show it
// anyway" choice as isWithinDays above.
export function businessHoursElapsed(fromISO: string, toISO: string): number {
  const fromUtc = Date.parse(String(fromISO || "").trim());
  const toUtc = Date.parse(String(toISO || "").trim());
  if (!Number.isFinite(fromUtc) || !Number.isFinite(toUtc) || toUtc <= fromUtc) return 0;

  const from = fromUtc - MX_UTC_OFFSET_MS;
  const to = toUtc - MX_UTC_OFFSET_MS;

  let totalMs = 0;
  let holidays: Set<string> | null = null;
  let holidaysYear = NaN;
  let cursor = from;
  while (cursor < to) {
    const date = new Date(cursor);
    const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const dayEnd = dayStart + 86_400_000;
    const segmentEnd = Math.min(to, dayEnd);

    const weekday = date.getUTCDay(); // 0 = Sun, 6 = Sat, in MX local time
    if (weekday !== 0 && weekday !== 6) {
      const year = date.getUTCFullYear();
      if (year !== holidaysYear) {
        holidays = mexicanHolidays(year);
        holidaysYear = year;
      }
      if (!holidays!.has(new Date(dayStart).toISOString().slice(0, 10))) {
        const openMs = dayStart + BUSINESS_OPEN_HOUR * 3_600_000;
        const closeMs = dayStart + BUSINESS_CLOSE_HOUR * 3_600_000;
        const segStart = Math.max(cursor, openMs);
        const segStop = Math.min(segmentEnd, closeMs);
        if (segStop > segStart) totalMs += segStop - segStart;
      }
    }
    cursor = segmentEnd;
  }
  return totalMs / 3_600_000;
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
