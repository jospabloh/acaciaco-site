// Field-level validation for a factura request. Deliberately import-free so
// `node --test` can load it directly (see the extensionless-imports gotcha in
// CLAUDE.md) — the submit handler and tests share exactly this logic.
//
// It returns WHICH fields are wrong, not just that something is. A generic
// "algo no es válido" left a real customer stuck on the review screen with no
// field marked and no way forward: their CSF (a persona moral) printed the
// régimen description without its clave, the form built an <option value="">
// for it, and an empty non-placeholder option passes checkValidity() by spec.
// The named field is what lets the client point at it and offer a way out.

export const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CP_RE = /^\d{5}$/;

// The régimen catalog, clave + the label the form shows. Must stay identical
// to the <option>s in roseta/factura/index.html — tests/facturaValidation.test.ts
// reads that file off disk and fails if they drift, the same guarantee
// _soporteValidation.ts has over soporte.html's app dropdown.
export const REGIMEN_CATALOG = [
  { clave: "601", label: "General de Ley Personas Morales" },
  { clave: "603", label: "Personas Morales con Fines no Lucrativos" },
  { clave: "605", label: "Sueldos y Salarios" },
  { clave: "606", label: "Arrendamiento" },
  { clave: "608", label: "Demás ingresos" },
  { clave: "611", label: "Ingresos por Dividendos (socios y accionistas)" },
  { clave: "612", label: "Personas Físicas con Actividades Empresariales y Profesionales" },
  { clave: "614", label: "Ingresos por intereses" },
  { clave: "616", label: "Sin obligaciones fiscales" },
  { clave: "621", label: "Incorporación Fiscal" },
  { clave: "622", label: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { clave: "625", label: "Actividades Empresariales por Plataformas Tecnológicas" },
  { clave: "626", label: "Régimen Simplificado de Confianza (RESICO)" },
];

export const REGIMEN_CLAVES = REGIMEN_CATALOG.map((r) => r.clave);

export const USO_CLAVES = ["G01", "G03", "I08", "P01", "S01", "CP01"];

// --- Recovering a clave the CSF didn't print ------------------------------
//
// A CSF for a persona moral prints the régimen's description but usually NOT
// its clave, so Claude reports `clave: ""` — it can only read what's there.
// This resolves the clave from the description instead.
//
// It lives here, on the server, ON PURPOSE. The first version of this fix put
// the same logic in factura.js only, and a browser holding a cached copy of
// that file bypassed it completely — the customer got the old dead end while
// the deployed server was already fixed. Anything that decides whether a
// request is acceptable has to survive a stale client.

// "de", "por", "y"… appear in half the catalog and carry no signal.
const REGIMEN_STOPWORDS = new Set([
  "de", "del", "la", "las", "los", "el", "y", "e", "a", "al",
  "con", "por", "en", "no", "traves",
]);

export function normalizeRegimen(s: unknown): string {
  return String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^\s*\d{3}\s/, "")        // a "601 · …" option label
    .replace(/^\s*regimen (de )?/, "") // CSFs prefix "Régimen …"
    .trim();
}

function significantWords(key: string): string[] {
  return key.split(" ").filter((w) => w && !REGIMEN_STOPWORDS.has(w));
}

function covers(haystack: string[], needles: string[]): boolean {
  return needles.length > 0 && needles.every((w) => haystack.indexOf(w) !== -1);
}

// Returns a catalog clave, or null. Never a best guess: a description that
// matches two entries resolves to nothing, so the customer picks by hand
// rather than having a wrong régimen chosen for them.
export function resolveRegimenClave(clave: unknown, descripcion: unknown): string | null {
  const given = String(clave == null ? "" : clave).trim();
  if (REGIMEN_CLAVES.indexOf(given) !== -1) return given;

  const key = normalizeRegimen(descripcion);
  if (!key) return null;

  const exact = REGIMEN_CATALOG.filter((c) => normalizeRegimen(c.label) === key);
  if (exact.length === 1) return exact[0].clave;

  // The catalog's wording is abbreviated relative to the SAT's, and not always
  // as a prefix — 625 reads "Actividades Empresariales por Plataformas
  // Tecnológicas" here and "…Actividades Empresariales con ingresos a través de
  // Plataformas Tecnológicas" on a CSF, so neither string contains the other.
  // Compare the significant words instead.
  const words = significantWords(key);
  const loose = REGIMEN_CATALOG.filter((c) => {
    const cw = significantWords(normalizeRegimen(c.label));
    return covers(words, cw) || covers(cw, words);
  });
  return loose.length === 1 ? loose[0].clave : null;
}

// "601 · General de Ley Personas Morales" — what a human reading the request
// needs, since a bare "601" means nothing while you're checking a customer's
// data against their CSF. Accepts a bare clave OR an already-formatted label,
// so it is idempotent and also fixes up rows written before this existed.
//
// Display only. The clave alone is what gets STORED in the ClientesRFC tab,
// because factura-lookup feeds that value straight into the form's
// <select>.value — a label there would silently break the autofill.
export function regimenDisplay(value: unknown): string {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  const clave = resolveRegimenClave(raw, raw);
  const entry = clave ? REGIMEN_CATALOG.find((c) => c.clave === clave) : undefined;
  // An unrecognised value is shown as-is rather than blanked: losing what the
  // customer actually sent would be worse than showing something odd.
  return entry ? `${entry.clave} · ${entry.label}` : raw;
}

export const FIELD_LABELS: Record<string, string> = {
  rfc: "RFC",
  razon_social: "Razón social",
  regimen_fiscal: "Régimen fiscal",
  uso_cfdi: "Uso de CFDI",
  codigo_postal: "Código postal",
  email: "Correo",
  sucursal: "Sucursal",
  fecha_consumo: "Fecha de consumo",
  monto: "Monto",
  forma_pago: "Forma de pago",
  folio_ticket: "Movimiento",
};

export interface SolicitudFields {
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  uso_cfdi: string;
  codigo_postal: string;
  email: string;
  sucursal: string;
  fecha_consumo: string;
  monto: string;
  forma_pago: string;
  folio_ticket: string;
  sin_movimiento: boolean;
}

function filled(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

// Returns the payload keys that are invalid, in the order the customer sees
// them on the form — so "el primero que hay que corregir" is [0].
export function invalidFields(f: SolicitudFields): string[] {
  const bad: string[] = [];
  if (!RFC_RE.test(String(f.rfc || "").trim())) bad.push("rfc");
  if (!filled(f.razon_social)) bad.push("razon_social");
  if (REGIMEN_CLAVES.indexOf(String(f.regimen_fiscal || "").trim()) === -1) bad.push("regimen_fiscal");
  if (USO_CLAVES.indexOf(String(f.uso_cfdi || "").trim()) === -1) bad.push("uso_cfdi");
  if (!CP_RE.test(String(f.codigo_postal || "").trim())) bad.push("codigo_postal");
  if (!EMAIL_RE.test(String(f.email || "").trim())) bad.push("email");
  if (!filled(f.sucursal)) bad.push("sucursal");
  if (!filled(f.fecha_consumo)) bad.push("fecha_consumo");
  if (!(Number(String(f.monto || "").trim()) > 0)) bad.push("monto");
  if (!filled(f.forma_pago)) bad.push("forma_pago");
  if (!filled(f.folio_ticket) && f.sin_movimiento !== true) bad.push("folio_ticket");
  return bad;
}

// Names the offending fields in the message itself, so the text is useful even
// where the client can't act on the `fields` array (an old cached factura.js,
// a copy pasted into a WhatsApp message, a log line).
export function invalidFieldsMessage(fields: string[]): string {
  const labels = fields.map((k) => FIELD_LABELS[k] || k);
  if (labels.length === 0) return "Revisa los datos del formulario, algo no es válido.";
  if (labels.length === 1) return `Revisa este dato: ${labels[0]}.`;
  return `Revisa estos datos: ${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}.`;
}
