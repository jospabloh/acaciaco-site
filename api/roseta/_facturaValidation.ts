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

// These two must stay identical to the <option value>s in
// roseta/factura/index.html — tests/facturaValidation.test.ts reads that file
// off disk and fails if they drift, the same guarantee _soporteValidation.ts
// has over soporte.html's app dropdown. Without them the empty clave above
// reaches the Sheet as a blank régimen instead of being caught by name.
export const REGIMEN_CLAVES = [
  "601", "603", "605", "606", "608", "611", "612",
  "614", "616", "621", "622", "625", "626",
];

export const USO_CLAVES = ["G01", "G03", "I08", "P01", "S01", "CP01"];

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
