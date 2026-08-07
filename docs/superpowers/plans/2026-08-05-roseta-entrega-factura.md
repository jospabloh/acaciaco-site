# Roseta · Entrega de la factura al cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Roseta entregue el CFDI (PDF + XML) al cliente desde un panel interno con un clic, y que la consulta pública por RFC devuelva todas las solicitudes de los últimos 30 días en vez de una sola.

**Architecture:** Toda la lógica pura (índices de columnas, ventana de fechas, validación de archivos, comparación de contraseña) vive en módulos `api/roseta/_*.ts` con prefijo de guión bajo — Vercel ignora esos archivos al construir funciones, y son testeables sin I/O. Los endpoints quedan delgados: orquestan Sheets + Resend y delegan las decisiones a esos módulos. El disparador del envío es un clic en el panel, no un cron.

**Tech Stack:** TypeScript sobre `@vercel/node`, `googleapis` (Sheets v4), `resend`, HTML/CSS/JS vanilla en el front (sin framework, igual que el resto del sitio), y `node:test` como runner —incluido en Node 22, cero dependencias nuevas—.

**Spec:** `docs/superpowers/specs/2026-08-05-roseta-notificacion-factura-design.md`

## Global Constraints

- **Node 22+.** `node --test` ejecuta `.ts` directamente por type-stripping nativo; no se añade transpilador ni dependencias de test.
- **Los tests van en `tests/`, nunca dentro de `api/`.** Vercel convierte cada archivo de `api/` en una función serverless; sólo los que empiezan con `_` quedan exentos.
- **Las columnas O y P del Sheet no se mueven.** Roseta las edita a mano. Las nuevas son **S (`Notificado el`)** y **T (`Archivos enviados`)**, confirmadas libres en el Sheet real.
- **Rango del Sheet:** `Solicitudes!A:T` (antes `A:R` / `A:P`).
- **Formatos:** `Fecha de facturación` en `YYYY-MM-DD`; `Notificado el` en ISO 8601 completo.
- **CSP** (`vercel.json`): `script-src 'self' 'unsafe-inline'` — sin CDNs nuevos. `connect-src 'self' https:`.
- **Secretos sin prefijo público.** `ROSETA_ADMIN_PASSWORD` es server-only.
- **La consulta pública nunca expone** correo, razón social, código postal ni teléfono.
- **Idioma:** comentarios e identificadores en inglés (convención del repo); todo texto visible al usuario en español.
- **Commits:** frecuentes, uno por tarea como mínimo.

---

### Task 1: Test harness + helpers puros de filas

**Files:**
- Create: `api/roseta/_facturaRows.ts`
- Create: `tests/facturaRows.test.ts`
- Modify: `package.json` (añadir bloque `scripts`)

**Interfaces:**
- Consumes: nada.
- Produces: `COL`, `SOLICITUDES_RANGE`, `cell(row, idx): string`, `fmtMoney(v: string): string`, `isWithinDays(fecha: string, days: number, today: string): boolean`, `publicSolicitud(row: string[]): PublicSolicitud`, `findRowNumber(rows: string[][], folio: string): number`, `todayISO(): string`.

- [ ] **Step 1: Añadir el script de test**

En `package.json`, añadir la clave `scripts` antes de `dependencies`:

```json
{
  "scripts": {
    "test": "node --test \"tests/**/*.test.ts\""
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.70.0",
    "@vercel/node": "^5.5.28",
    "googleapis": "^171.1.0",
    "resend": "^6.18.1",
    "zod": "^4.0.0"
  }
}
```

- [ ] **Step 2: Escribir los tests que fallan**

Crear `tests/facturaRows.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COL,
  cell,
  fmtMoney,
  isWithinDays,
  publicSolicitud,
  findRowNumber,
} from "../api/roseta/_facturaRows.ts";

// A row shaped exactly like factura-submit.ts writes it, extended to T.
function row(over: Record<string, string> = {}): string[] {
  const r = [
    "RF-20260801-AB12", "2026-08-01", "XAXX010101000", "Juan Pérez",
    "612", "G03", "20000", "juan@ejemplo.com", "4490000000", "UAA",
    "2026-07-31", "348.00", "Efectivo", "MOV-991",
    "Pendiente", "", "300.00", "48.00", "", "",
  ];
  for (const [k, v] of Object.entries(over)) r[COL[k as keyof typeof COL]] = v;
  return r;
}

test("cell devuelve cadena vacía para índices ausentes", () => {
  assert.equal(cell(["a"], 5), "");
  assert.equal(cell(["a", " b "], 1), "b");
});

test("fmtMoney formatea números y deja pasar lo no numérico", () => {
  assert.equal(fmtMoney("348"), "$348.00 MXN");
  assert.equal(fmtMoney("no-es-numero"), "no-es-numero");
});

test("isWithinDays acepta una fecha dentro de la ventana", () => {
  assert.equal(isWithinDays("2026-07-20", 30, "2026-08-05"), true);
});

test("isWithinDays rechaza una fecha fuera de la ventana", () => {
  assert.equal(isWithinDays("2026-06-01", 30, "2026-08-05"), false);
});

test("isWithinDays incluye el borde exacto de la ventana", () => {
  assert.equal(isWithinDays("2026-07-06", 30, "2026-08-05"), true);
});

test("isWithinDays muestra filas con fecha vacía o malformada", () => {
  assert.equal(isWithinDays("", 30, "2026-08-05"), true);
  assert.equal(isWithinDays("no-es-fecha", 30, "2026-08-05"), true);
});

test("isWithinDays muestra fechas futuras en vez de esconderlas", () => {
  assert.equal(isWithinDays("2026-09-01", 30, "2026-08-05"), true);
});

test("publicSolicitud expone sólo los campos públicos", () => {
  const s = publicSolicitud(row());
  assert.deepEqual(s, {
    folio: "RF-20260801-AB12",
    fecha_solicitud: "2026-08-01",
    sucursal: "UAA",
    monto: "$348.00 MXN",
    estatus: "Pendiente",
    fecha_facturacion: "",
    notificado_el: "",
  });
});

test("publicSolicitud nunca filtra datos personales", () => {
  const s = publicSolicitud(row()) as Record<string, string>;
  for (const leaked of ["juan@ejemplo.com", "Juan Pérez", "20000", "4490000000"]) {
    assert.equal(
      Object.values(s).includes(leaked), false,
      `publicSolicitud filtró ${leaked}`,
    );
  }
});

test("publicSolicitud asume Pendiente cuando la columna está vacía", () => {
  assert.equal(publicSolicitud(row({ ESTATUS: "" })).estatus, "Pendiente");
});

test("findRowNumber devuelve el número de fila 1-based del Sheet", () => {
  const rows = [["Folio"], row(), row({ FOLIO: "RF-20260802-CD34" })];
  assert.equal(findRowNumber(rows, "RF-20260802-CD34"), 3);
});

test("findRowNumber ignora el encabezado y no distingue mayúsculas", () => {
  const rows = [["Folio"], row()];
  assert.equal(findRowNumber(rows, "rf-20260801-ab12"), 2);
});

test("findRowNumber devuelve -1 si el folio no existe", () => {
  assert.equal(findRowNumber([["Folio"], row()], "RF-NOPE"), -1);
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '../api/roseta/_facturaRows.ts'`

- [ ] **Step 4: Escribir la implementación**

Crear `api/roseta/_facturaRows.ts`:

```ts
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
} as const;

export const SOLICITUDES_RANGE = "Solicitudes!A:T";
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
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS — `# pass 13`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add package.json api/roseta/_facturaRows.ts tests/facturaRows.test.ts
git commit -m "Add tested pure helpers for the Solicitudes sheet rows"
```

---

### Task 2: Validación del PDF y el XML

**Files:**
- Create: `api/roseta/_cfdiFiles.ts`
- Create: `tests/cfdiFiles.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `CfdiFile { filename: string; content: string }`, `parseCfdiFile(f: unknown, kind: "pdf" | "xml"): CfdiFile | null`, `MAX_COMBINED_B64_LEN`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/cfdiFiles.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCfdiFile, MAX_COMBINED_B64_LEN } from "../api/roseta/_cfdiFiles.ts";

function dataUrl(mime: string, body: string): string {
  return `data:${mime};base64,${Buffer.from(body, "latin1").toString("base64")}`;
}

const PDF = { name: "factura.pdf", dataUrl: dataUrl("application/pdf", "%PDF-1.7\nbody") };
const XML = { name: "factura.xml", dataUrl: dataUrl("application/xml", '<?xml version="1.0"?><cfdi:Comprobante/>') };

test("acepta un PDF con la firma correcta", () => {
  const f = parseCfdiFile(PDF, "pdf");
  assert.equal(f?.filename, "factura.pdf");
  assert.ok(f?.content.length);
});

test("acepta un XML con declaración", () => {
  assert.equal(parseCfdiFile(XML, "xml")?.filename, "factura.xml");
});

test("acepta un XML sin declaración pero que abre con etiqueta", () => {
  const f = { name: "cfdi.xml", dataUrl: dataUrl("application/xml", "<cfdi:Comprobante/>") };
  assert.ok(parseCfdiFile(f, "xml"));
});

test("rechaza un PDF cuyo contenido no es PDF", () => {
  const fake = { name: "factura.pdf", dataUrl: dataUrl("application/pdf", "GIF89a not a pdf") };
  assert.equal(parseCfdiFile(fake, "pdf"), null);
});

test("rechaza un XML cuyo contenido no es XML", () => {
  const fake = { name: "factura.xml", dataUrl: dataUrl("application/xml", "%PDF-1.7") };
  assert.equal(parseCfdiFile(fake, "xml"), null);
});

test("rechaza una extensión que no corresponde", () => {
  assert.equal(parseCfdiFile({ name: "factura.txt", dataUrl: PDF.dataUrl }, "pdf"), null);
});

test("rechaza un PDF donde se espera un XML", () => {
  assert.equal(parseCfdiFile(PDF, "xml"), null);
});

test("rechaza entradas vacías o mal formadas", () => {
  assert.equal(parseCfdiFile(null, "pdf"), null);
  assert.equal(parseCfdiFile({}, "pdf"), null);
  assert.equal(parseCfdiFile({ name: "a.pdf", dataUrl: "no-es-data-url" }, "pdf"), null);
});

test("rechaza un archivo que excede el tope de tamaño", () => {
  const huge = { name: "factura.pdf", dataUrl: `data:application/pdf;base64,${"A".repeat(MAX_COMBINED_B64_LEN + 1)}` };
  assert.equal(parseCfdiFile(huge, "pdf"), null);
});

test("la extensión no distingue mayúsculas", () => {
  assert.ok(parseCfdiFile({ name: "FACTURA.PDF", dataUrl: PDF.dataUrl }, "pdf"));
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '../api/roseta/_cfdiFiles.ts'`

- [ ] **Step 3: Escribir la implementación**

Crear `api/roseta/_cfdiFiles.ts`:

```ts
// Validation for the CFDI files Roseta uploads in the admin panel. A CFDI's
// PDF and XML are small, so the cap is well under Vercel's 4.5MB request-body
// limit — this is a sanity backstop, not a real constraint.
//
// Both the extension AND the first decoded bytes are checked: a renamed file
// is the most likely honest mistake, and mailing the customer a "factura.xml"
// that is really a PDF hands them something they cannot deduct.
export const MAX_COMBINED_B64_LEN = 2 * 1024 * 1024;

export interface CfdiFile {
  filename: string;
  content: string;
}

interface FileField {
  name?: unknown;
  dataUrl?: unknown;
}

function decodeHead(b64: string, bytes: number): string {
  const chunk = b64.slice(0, Math.ceil((bytes * 4) / 3) + 4);
  try {
    return Buffer.from(chunk, "base64").toString("latin1");
  } catch {
    return "";
  }
}

function looksLikePdf(b64: string): boolean {
  return decodeHead(b64, 8).startsWith("%PDF");
}

function looksLikeXml(b64: string): boolean {
  const head = decodeHead(b64, 64).replace(/^\uFEFF/, "").trimStart();
  return head.startsWith("<?xml") || head.startsWith("<");
}

export function parseCfdiFile(f: unknown, kind: "pdf" | "xml"): CfdiFile | null {
  if (!f || typeof f !== "object") return null;
  const field = f as FileField;
  const name = typeof field.name === "string" ? field.name.trim() : "";
  const dataUrl = typeof field.dataUrl === "string" ? field.dataUrl : "";
  if (!name || !dataUrl) return null;
  if (dataUrl.length > MAX_COMBINED_B64_LEN) return null;
  if (!name.toLowerCase().endsWith(`.${kind}`)) return null;

  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const content = match[2];

  const valid = kind === "pdf" ? looksLikePdf(content) : looksLikeXml(content);
  return valid ? { filename: name, content } : null;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add api/roseta/_cfdiFiles.ts tests/cfdiFiles.test.ts
git commit -m "Validate uploaded CFDI files by extension and magic bytes"
```

---

### Task 3: Autenticación del panel

**Files:**
- Create: `api/roseta/_adminAuth.ts`
- Create: `tests/adminAuth.test.ts`

**Interfaces:**
- Consumes: `isRateLimited`, `getClientKey` de `api/roseta/_ratelimit.ts`.
- Produces: `passwordMatches(provided: string, expected: string): boolean`, `ADMIN_HEADER: string`, `requireAdmin(req: VercelRequest): { ok: true } | { ok: false; status: number; error: string }`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/adminAuth.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordMatches, ADMIN_HEADER } from "../api/roseta/_adminAuth.ts";

test("acepta la contraseña correcta", () => {
  assert.equal(passwordMatches("s3creto-largo", "s3creto-largo"), true);
});

test("rechaza una contraseña incorrecta de la misma longitud", () => {
  assert.equal(passwordMatches("s3creto-largX", "s3creto-largo"), false);
});

test("rechaza contraseñas de distinta longitud sin lanzar", () => {
  assert.equal(passwordMatches("corta", "s3creto-largo"), false);
});

test("rechaza cuando la esperada está vacía, para no abrirse al no configurarse", () => {
  assert.equal(passwordMatches("", ""), false);
  assert.equal(passwordMatches("cualquiera", ""), false);
});

test("rechaza entradas no string", () => {
  assert.equal(passwordMatches(undefined as unknown as string, "x"), false);
});

test("el header es minúsculas, como los normaliza Node", () => {
  assert.equal(ADMIN_HEADER, ADMIN_HEADER.toLowerCase());
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '../api/roseta/_adminAuth.ts'`

- [ ] **Step 3: Escribir la implementación**

Crear `api/roseta/_adminAuth.ts`:

```ts
import { createHash, timingSafeEqual } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { getClientKey, isRateLimited } from "./_ratelimit";

// Shared password for the internal panel. Server-only: no public prefix, so
// it can never reach the client bundle. This protects against someone who
// finds the URL, not against someone who already has the password — which is
// proportional to a single-operator workflow, and documented as such.
export const ADMIN_HEADER = "x-roseta-admin";

// Hashing both sides first normalises length, so timingSafeEqual never throws
// on a length mismatch and the comparison leaks nothing through timing.
export function passwordMatches(provided: string, expected: string): boolean {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  if (!expected) return false; // unset env var must fail closed, never open
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export type AdminCheck = { ok: true } | { ok: false; status: number; error: string };

export function requireAdmin(req: VercelRequest): AdminCheck {
  const expected = process.env.ROSETA_ADMIN_PASSWORD || "";
  if (!expected) {
    console.error("ROSETA_ADMIN_PASSWORD not configured");
    return { ok: false, status: 500, error: "El panel no está configurado todavía." };
  }
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
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add api/roseta/_adminAuth.ts tests/adminAuth.test.ts
git commit -m "Add timing-safe shared-password auth for the Roseta admin panel"
```

---

### Task 4: La consulta pública devuelve una lista

**Files:**
- Modify: `api/roseta/factura-status.ts` (reescritura completa del handler)
- Create: `tests/facturaStatusSelect.test.ts`
- Create: `api/roseta/_statusSelect.ts`

**Interfaces:**
- Consumes: `COL`, `publicSolicitud`, `isWithinDays`, `RFC_WINDOW_DAYS`, `cell` de `_facturaRows.ts`.
- Produces: `selectByFolio(rows, folio): PublicSolicitud[]`, `selectByRfc(rows, rfc, today): { solicitudes: PublicSolicitud[]; rfcExists: boolean }`.

La selección se extrae a su propio módulo para poder probarla sin tocar Sheets; el handler queda como orquestación.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/facturaStatusSelect.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { selectByFolio, selectByRfc } from "../api/roseta/_statusSelect.ts";

const HEADER = ["Folio"];
function r(folio: string, fecha: string, rfc: string, estatus = "Pendiente"): string[] {
  return [
    folio, fecha, rfc, "Juan Pérez", "612", "G03", "20000", "juan@ejemplo.com",
    "4490000000", "UAA", "2026-07-31", "348.00", "Efectivo", "MOV-1",
    estatus, "", "300.00", "48.00", "", "",
  ];
}

const ROWS = [
  HEADER,
  r("RF-A", "2026-08-01", "XAXX010101000"),
  r("RF-B", "2026-07-28", "XAXX010101000", "Facturada"),
  r("RF-C", "2026-06-01", "XAXX010101000"),          // fuera de la ventana
  r("RF-D", "2026-08-02", "XEXX010101000"),          // otro RFC
];

test("selectByFolio encuentra el folio sin importar su antigüedad", () => {
  const found = selectByFolio(ROWS, "RF-C");
  assert.equal(found.length, 1);
  assert.equal(found[0].folio, "RF-C");
});

test("selectByFolio no distingue mayúsculas", () => {
  assert.equal(selectByFolio(ROWS, "rf-a").length, 1);
});

test("selectByFolio devuelve vacío para un folio inexistente", () => {
  assert.deepEqual(selectByFolio(ROWS, "RF-NOPE"), []);
});

test("selectByRfc devuelve sólo lo de la ventana de 30 días", () => {
  const { solicitudes } = selectByRfc(ROWS, "XAXX010101000", "2026-08-05");
  assert.deepEqual(solicitudes.map((s) => s.folio), ["RF-A", "RF-B"]);
});

test("selectByRfc ordena de la más reciente a la más antigua", () => {
  const { solicitudes } = selectByRfc(ROWS, "XAXX010101000", "2026-08-05");
  assert.equal(solicitudes[0].folio, "RF-A");
});

test("selectByRfc distingue 'no existe' de 'nada en la ventana'", () => {
  const vacio = selectByRfc(ROWS, "XAXX010101000", "2026-10-01");
  assert.equal(vacio.solicitudes.length, 0);
  assert.equal(vacio.rfcExists, true);

  const inexistente = selectByRfc(ROWS, "XQQQ010101000", "2026-08-05");
  assert.equal(inexistente.solicitudes.length, 0);
  assert.equal(inexistente.rfcExists, false);
});

test("selectByRfc no filtra datos personales", () => {
  const { solicitudes } = selectByRfc(ROWS, "XAXX010101000", "2026-08-05");
  const blob = JSON.stringify(solicitudes);
  for (const leaked of ["juan@ejemplo.com", "Juan Pérez", "4490000000"]) {
    assert.equal(blob.includes(leaked), false, `se filtró ${leaked}`);
  }
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module '../api/roseta/_statusSelect.ts'`

- [ ] **Step 3: Escribir el módulo de selección**

Crear `api/roseta/_statusSelect.ts`:

```ts
import { COL, cell, isWithinDays, publicSolicitud, RFC_WINDOW_DAYS } from "./_facturaRows";
import type { PublicSolicitud } from "./_facturaRows";

// A folio is a direct reference to one request, so it is never time-boxed —
// hiding someone's own request because it is old would be absurd. The window
// applies only to the RFC listing.
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
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS — `# fail 0`

- [ ] **Step 5: Reescribir el handler**

Reemplazar el contenido completo de `api/roseta/factura-status.ts`:

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getValues } from "./_sheets";
import { getClientKey, isRateLimited } from "./_ratelimit";
import { RFC_WINDOW_DAYS, SOLICITUDES_RANGE, todayISO } from "./_facturaRows";
import { selectByFolio, selectByRfc } from "./_statusSelect";

const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ found: false, error: "GET only" });
    }

    if (isRateLimited("factura-status:" + getClientKey(req), 60_000, 20)) {
      return res.status(429).json({ found: false, error: "Demasiadas solicitudes, intenta de nuevo en un minuto." });
    }

    const query = String(req.query.query || "").trim().toUpperCase();
    if (!query) {
      return res.status(400).json({ found: false, error: "Ingresa un folio o RFC." });
    }

    const rows = await getValues(SOLICITUDES_RANGE);

    if (query.startsWith("RF-")) {
      const solicitudes = selectByFolio(rows, query);
      return res.status(200).json({ found: solicitudes.length > 0, solicitudes });
    }

    if (RFC_RE.test(query)) {
      const { solicitudes, rfcExists } = selectByRfc(rows, query, todayISO());
      return res.status(200).json({
        found: solicitudes.length > 0,
        solicitudes,
        rfc_exists: rfcExists,
        window_days: RFC_WINDOW_DAYS,
      });
    }

    return res.status(400).json({ found: false, error: "Ingresa un folio (RF-...) o un RFC válido." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ found: false, error: "No se pudo consultar el estatus en este momento." });
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add api/roseta/_statusSelect.ts api/roseta/factura-status.ts tests/facturaStatusSelect.test.ts
git commit -m "Return every request from the last 30 days when looking up by RFC"
```

---

### Task 5: La página de estatus renderiza la lista

**Files:**
- Modify: `roseta/factura/estatus/index.html` (bloque `<style>`, el marcado del resultado y el `<script>` final)

> Los tres reemplazos se anclan por contenido, no por número de línea: cada paso mueve las líneas siguientes, así que buscar el fragmento es lo único fiable.

**Interfaces:**
- Consumes: la respuesta `{found, solicitudes[], rfc_exists, window_days}` de la Task 4.
- Produces: nada para otras tareas.

> Aplicar la skill `frontend-design` al decidir jerarquía visual y espaciado. Las variables (`--primary`, `--roseta-blush`, `--border`, `--text-muted`) y las clases del sitio (`.btn`, `.eyebrow`, `.section`) ya existen en `/styles/base.css`; no introducir dependencias ni fuentes nuevas — la CSP las bloquearía.

- [ ] **Step 1: Sustituir los estilos del resultado**

En `roseta/factura/estatus/index.html`, reemplazar el bloque de reglas CSS que empieza en `.es-result{display:none;` y termina en `.es-result dd{font-weight:600;}` (ocho reglas consecutivas, todas con prefijo `.es-result`/`.es-badge`) por:

```css
    .es-results{display:none;margin-top:1.6rem;border-top:1px solid var(--border);padding-top:1.6rem;}
    .es-results.show{display:block;}
    .es-count{font-size:.82rem;color:var(--text-muted);margin:0 0 1rem;}
    .es-item{border:1px solid var(--border);border-radius:.9rem;padding:1.1rem 1.2rem;margin-bottom:.9rem;background:var(--bg-card);}
    .es-item:last-child{margin-bottom:0;}
    .es-item-head{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;}
    .es-folio{font-family:'Space Grotesk',monospace;font-weight:700;letter-spacing:.02em;font-size:.95rem;}
    .es-badge{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .85rem;border-radius:99px;font-size:.78rem;font-weight:700;white-space:nowrap;}
    .es-badge.pendiente{background:#FFF3D6;color:#8A5A00;}
    .es-badge.facturada{background:#DCFCE7;color:#0a7;}
    .es-item dl{display:grid;grid-template-columns:auto 1fr;gap:.35rem 1rem;margin:.9rem 0 0;font-size:.88rem;}
    .es-item dt{color:var(--text-muted);}
    .es-item dd{margin:0;font-weight:600;}
    .es-sent{margin:.9rem 0 0;font-size:.84rem;color:#0a7;font-weight:600;}
```

- [ ] **Step 2: Sustituir el marcado del resultado**

Reemplazar el `<div class="es-result" id="es-result">` completo —con sus hijos `<span id="es-badge">` y `<dl id="es-data">`— por:

```html
          <div class="es-results" id="es-results">
            <p class="es-count" id="es-count"></p>
            <div id="es-list"></div>
          </div>
```

- [ ] **Step 3: Sustituir el script**

Reemplazar el `<script>` inline completo —el último del archivo, el que abre con `(function () {` y define `labelFor`— por:

```html
  <script>
  (function () {
    var form = document.getElementById('es-form');
    var statusEl = document.getElementById('es-status');
    var resultsEl = document.getElementById('es-results');
    var countEl = document.getElementById('es-count');
    var listEl = document.getElementById('es-list');
    var input = document.getElementById('es-query');

    var LABELS = {
      fecha_solicitud: 'Solicitada el',
      sucursal: 'Sucursal',
      monto: 'Monto',
      fecha_facturacion: 'Facturada el'
    };
    var ORDER = ['fecha_solicitud', 'sucursal', 'monto', 'fecha_facturacion'];

    function itemNode(s) {
      var item = document.createElement('article');
      item.className = 'es-item';

      var head = document.createElement('div');
      head.className = 'es-item-head';
      var folio = document.createElement('span');
      folio.className = 'es-folio';
      folio.textContent = s.folio;
      var badge = document.createElement('span');
      var facturada = s.estatus === 'Facturada';
      badge.className = 'es-badge ' + (facturada ? 'facturada' : 'pendiente');
      badge.textContent = facturada ? '✓ Facturada' : '⏳ Pendiente';
      head.appendChild(folio);
      head.appendChild(badge);
      item.appendChild(head);

      var dl = document.createElement('dl');
      ORDER.forEach(function (key) {
        if (!s[key]) return;
        var dt = document.createElement('dt');
        dt.textContent = LABELS[key];
        var dd = document.createElement('dd');
        dd.textContent = s[key];
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      item.appendChild(dl);

      if (s.notificado_el) {
        var sent = document.createElement('p');
        sent.className = 'es-sent';
        sent.textContent = '✉ Te la enviamos por correo el ' + s.notificado_el.slice(0, 10) + '.';
        item.appendChild(sent);
      }
      return item;
    }

    function render(json) {
      var list = json.solicitudes || [];
      listEl.innerHTML = '';
      list.forEach(function (s) { listEl.appendChild(itemNode(s)); });
      countEl.textContent = list.length === 1
        ? '1 solicitud encontrada.'
        : list.length + ' solicitudes encontradas.';
      resultsEl.classList.add('show');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      resultsEl.classList.remove('show');
      statusEl.className = '';
      statusEl.textContent = 'Buscando…';
      fetch('/api/roseta/factura-status?query=' + encodeURIComponent(q))
        .then(function (r) { return r.json().then(function (json) { return { ok: r.ok, json: json }; }); })
        .then(function (res) {
          var json = res.json || {};
          if (res.ok && json.found) {
            statusEl.textContent = '';
            render(json);
            return;
          }
          statusEl.className = 'error';
          if (res.ok && json.rfc_exists) {
            statusEl.textContent = 'Encontramos solicitudes con ese RFC, pero ninguna de los últimos '
              + (json.window_days || 30) + ' días — búscala con tu folio si es más antigua.';
          } else {
            statusEl.textContent = 'No encontramos una solicitud con ese dato. Verifica tu folio o RFC, o escríbenos a roseta.cafeteria@gmail.com.';
          }
        })
        .catch(function () {
          statusEl.className = 'error';
          statusEl.textContent = 'No se pudo consultar el estatus. Intenta de nuevo en un momento.';
        });
    });

    try {
      var params = new URLSearchParams(window.location.search);
      var folio = params.get('folio');
      if (folio) { input.value = folio; form.dispatchEvent(new Event('submit')); }
    } catch (e) {}
  })();
  </script>
```

- [ ] **Step 4: Verificar en el navegador**

Run: `npx vercel dev` y abrir `http://localhost:3000/roseta/factura/estatus`
Expected: con un RFC que tenga varias solicitudes recientes en el Sheet de prueba, se listan todas con su badge; con un RFC cuya única solicitud es de hace 60 días, aparece el mensaje de la ventana de 30 días.

- [ ] **Step 5: Commit**

```bash
git add roseta/factura/estatus/index.html
git commit -m "Render the full 30-day request history on the status page"
```

---

### Task 6: Endpoint de listado del panel

**Files:**
- Create: `api/roseta/factura-admin-list.ts`

**Interfaces:**
- Consumes: `requireAdmin` de `_adminAuth.ts`; `COL`, `cell`, `SOLICITUDES_RANGE` de `_facturaRows.ts`; `getValues` de `_sheets.ts`.
- Produces: `GET /api/roseta/factura-admin-list?filtro=pendientes|facturadas|todas` → `{ ok: true, solicitudes: AdminSolicitud[] }`. Cada `AdminSolicitud` trae: `folio, fecha_solicitud, rfc, razon_social, regimen_fiscal, uso_cfdi, codigo_postal, email, telefono, sucursal, fecha_consumo, monto, subtotal, iva, forma_pago, folio_ticket, estatus, fecha_facturacion, notificado_el, archivos`.

- [ ] **Step 1: Escribir el endpoint**

Crear `api/roseta/factura-admin-list.ts`:

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getValues } from "./_sheets";
import { requireAdmin } from "./_adminAuth";
import { COL, cell, SOLICITUDES_RANGE } from "./_facturaRows";

// Unlike the public status lookup, this one is authenticated and returns the
// full fiscal record — Roseta needs it to key the invoice into her stamping
// software without switching windows.
function adminSolicitud(row: string[]) {
  return {
    folio: cell(row, COL.FOLIO),
    fecha_solicitud: cell(row, COL.FECHA_SOLICITUD),
    rfc: cell(row, COL.RFC),
    razon_social: cell(row, COL.RAZON_SOCIAL),
    regimen_fiscal: cell(row, COL.REGIMEN),
    uso_cfdi: cell(row, COL.USO_CFDI),
    codigo_postal: cell(row, COL.CODIGO_POSTAL),
    email: cell(row, COL.EMAIL),
    telefono: cell(row, COL.TELEFONO),
    sucursal: cell(row, COL.SUCURSAL),
    fecha_consumo: cell(row, COL.FECHA_CONSUMO),
    monto: cell(row, COL.MONTO),
    subtotal: cell(row, COL.SUBTOTAL),
    iva: cell(row, COL.IVA),
    forma_pago: cell(row, COL.FORMA_PAGO),
    folio_ticket: cell(row, COL.FOLIO_TICKET),
    estatus: cell(row, COL.ESTATUS) || "Pendiente",
    fecha_facturacion: cell(row, COL.FECHA_FACTURACION),
    notificado_el: cell(row, COL.NOTIFICADO_EL),
    archivos: cell(row, COL.ARCHIVOS),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "GET only" });
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    // Reads the whole tab and filters in memory, same as the other Roseta
    // endpoints. Comfortable at the current volume; paginating is a later,
    // isolated change to this file if the tab ever grows enough to matter.
    const rows = await getValues(SOLICITUDES_RANGE);
    const filtro = String(req.query.filtro || "pendientes");
    const all = rows.slice(1).filter((row) => cell(row, COL.FOLIO));

    const solicitudes = all
      .filter((row) => {
        const estatus = (cell(row, COL.ESTATUS) || "Pendiente").toLowerCase();
        if (filtro === "facturadas") return estatus === "facturada";
        if (filtro === "todas") return true;
        return estatus !== "facturada";
      })
      .map(adminSolicitud)
      .reverse(); // rows are appended chronologically; newest first

    return res.status(200).json({ ok: true, solicitudes });
  } catch (err) {
    console.error("factura-admin-list failed", err);
    // Surfaced as an error, never as an empty list — "no pending requests"
    // and "the Sheet is unreachable" must not look the same to Roseta.
    return res.status(502).json({ ok: false, error: "No se pudo leer el Sheet. Intenta de nuevo." });
  }
}
```

- [ ] **Step 2: Verificar la autenticación**

Run:
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/roseta/factura-admin-list'
curl -s -H 'x-roseta-admin: LA_CONTRASEÑA' 'http://localhost:3000/api/roseta/factura-admin-list' | head -c 200
```
Expected: `401` en la primera; JSON con `"ok":true` en la segunda.

- [ ] **Step 3: Commit**

```bash
git add api/roseta/factura-admin-list.ts
git commit -m "Add authenticated listing endpoint for the Roseta admin panel"
```

---

### Task 7: Endpoint de envío del CFDI

**Files:**
- Create: `api/roseta/factura-admin-send.ts`

**Interfaces:**
- Consumes: `requireAdmin`; `parseCfdiFile`; `COL`, `cell`, `findRowNumber`, `SOLICITUDES_RANGE`, `todayISO`; `getValues`, `updateRow` de `_sheets.ts`.
- Produces: `POST /api/roseta/factura-admin-send` con `{ folio, pdf: {name, dataUrl}, xml: {name, dataUrl} }` → `{ ok: true }` o `{ ok: true, warning: string }`.

- [ ] **Step 1: Escribir el endpoint**

Crear `api/roseta/factura-admin-send.ts`:

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";
import { getValues, updateRow } from "./_sheets";
import { requireAdmin } from "./_adminAuth";
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

    async function writeBookkeeping(): Promise<void> {
      const fresh = await getValues(SOLICITUDES_RANGE);
      const freshRow = findRowNumber(fresh, folio);
      if (freshRow < 0) throw new Error(`folio ${folio} disappeared from the sheet`);
      await updateRow(`Solicitudes!O${freshRow}:P${freshRow}`, ["Facturada", todayISO()]);
      await updateRow(`Solicitudes!S${freshRow}:T${freshRow}`, [notificadoEl, archivos]);
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
```

- [ ] **Step 2: Verificar el camino feliz y los rechazos**

Run: con `npx vercel dev` corriendo y un Sheet de prueba,
```bash
# folio inexistente
curl -s -X POST localhost:3000/api/roseta/factura-admin-send \
  -H 'content-type: application/json' -H 'x-roseta-admin: LA_CONTRASEÑA' \
  -d '{"folio":"RF-NOPE","pdf":{"name":"a.pdf","dataUrl":"data:application/pdf;base64,JVBERi0xLjc="},"xml":{"name":"a.xml","dataUrl":"data:application/xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIj8+"}}'
```
Expected: `{"ok":false,"error":"No existe una solicitud con el folio RF-NOPE."}`

Repetir con un folio real del Sheet de prueba y verificar que llega el correo con **dos** adjuntos y que las columnas O, P, S y T quedan escritas.

- [ ] **Step 3: Commit**

```bash
git add api/roseta/factura-admin-send.ts
git commit -m "Deliver the CFDI to the customer and record the send"
```

---

### Task 8: El panel

**Files:**
- Create: `roseta/factura/admin/index.html`
- Create: `roseta/factura/admin/admin.js`

**Interfaces:**
- Consumes: `GET /api/roseta/factura-admin-list` y `POST /api/roseta/factura-admin-send` de las tareas 6 y 7.
- Produces: nada para otras tareas.

> Aplicar la skill `frontend-design`. Reutilizar `/styles/base.css` y las variables de marca de Roseta (`--primary: #9E1B2A`, `--roseta-blush: #F1DCD6`, `--roseta-ink: #3C0B12`) tal como lo hacen `roseta/factura/index.html` y `roseta/factura/estatus/index.html`. Sin CDNs ni fuentes nuevas: la CSP de `vercel.json` sólo permite `'self'`, Google Fonts, unpkg y jsdelivr.

> **Esta tarea es la única del plan que no trae el código completo, y es deliberado.** El resto de las tareas lo trae porque su forma correcta ya está decidida. El panel no: su maquetación es precisamente lo que `frontend-design` tiene que resolver, y congelarla aquí convertiría esa skill en decoración. Lo que sí queda cerrado es el contrato —los endpoints de las tareas 6 y 7, con sus campos exactos— y los doce requisitos de abajo, todos comprobables en el navegador. Quien implemente esta tarea decide el diseño; no decide el comportamiento.

Requisitos funcionales del panel, todos verificables:

1. `<meta name="robots" content="noindex, nofollow">` y **sin enlaces** desde ninguna página pública.
2. Pantalla de contraseña; al validarla se guarda en `sessionStorage` bajo `roseta-admin-key` y se manda en el header `x-roseta-admin` en cada petición.
3. Un `401` en cualquier petición borra la clave guardada y devuelve a la pantalla de contraseña.
4. Filtros `Pendientes` (por defecto) / `Facturadas` / `Todas`.
5. Cada fila muestra folio, fecha, RFC, razón social, monto, sucursal y estatus.
6. Al abrir una fila: los datos fiscales completos (RFC, razón social, régimen, uso de CFDI, código postal, correo), botón de **copiar el RFC**, subtotal e IVA, y las dos zonas de carga.
7. El botón de enviar permanece deshabilitado hasta que **ambos** archivos estén cargados; el texto explica por qué se piden los dos.
8. Los archivos se leen con `FileReader.readAsDataURL` y se mandan como `{name, dataUrl}`.
9. Una solicitud con `notificado_el` se marca como enviada y su botón dice **"Reenviar"**, con `confirm()` explícito antes de mandar.
10. Al terminar: mensaje de éxito con el correo de destino; si la respuesta trae `warning`, se muestra en tono de advertencia y **no** se ofrece reintentar.
11. Tras un envío exitoso se recarga la lista.
12. Usable a 360 px de ancho.

- [ ] **Step 1: Construir el panel**

Crear `roseta/factura/admin/index.html` siguiendo la estructura de `roseta/factura/estatus/index.html` (mismo `<head>`, mismo bootstrap de tema, misma cabecera y pie), con: una `<section>` de acceso con el campo de contraseña, una `<section>` del panel con los filtros y el contenedor de la lista, y `<script src="/roseta/factura/admin/admin.js" defer></script>`.

Crear `roseta/factura/admin/admin.js` implementando los 12 requisitos anteriores. Patrones a seguir del código existente: IIFE con `'use strict'`, `var`, sin dependencias externas, y construcción del DOM con `createElement`/`textContent` —nunca `innerHTML` con datos del Sheet— como ya se hace en el script de la página de estatus.

- [ ] **Step 2: Verificar con Playwright**

Levantar `npx vercel dev` y, con la skill `webapp-testing`, comprobar en el navegador:
- contraseña incorrecta → mensaje de error, no entra;
- contraseña correcta → aparece la lista de pendientes;
- el botón de enviar está deshabilitado con un solo archivo cargado y se habilita con los dos;
- una solicitud ya notificada muestra "Reenviar" y pide confirmación;
- el panel se ve bien a 360 px.

Capturar pantallas del panel en escritorio y móvil.

- [ ] **Step 3: Commit**

```bash
git add roseta/factura/admin/
git commit -m "Add the internal panel Roseta uses to deliver invoices"
```

---

### Task 9: Documentación y verificación final

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Documentar la variable de entorno**

Añadir al final de la sección `--- Roseta Café ---` de `.env.example`:

```
# Contraseña del panel interno /roseta/factura/admin, donde Roseta sube el PDF
# y el XML del CFDI y los envía al cliente. Sin prefijo público: debe quedarse
# del lado del servidor. Usa una cadena larga y aleatoria.
ROSETA_ADMIN_PASSWORD=
```

- [ ] **Step 2: Documentar el flujo en el README**

En `README.md`, extender la viñeta de `api/roseta/` para mencionar el panel, el endpoint de entrega y las columnas S/T del Sheet, y añadir bajo "Local development":

```markdown
Run the unit tests for the Roseta invoice helpers:

```bash
npm test
```
```

- [ ] **Step 3: Correr la verificación completa**

Run: `npm test`
Expected: PASS, `# fail 0`

Recorrer la matriz de verificación del spec contra el Sheet de prueba:

| Caso | Esperado |
|---|---|
| Contraseña incorrecta | 401 |
| Contraseña correcta | Carga la lista |
| Envío feliz | Correo con **ambos** adjuntos; `O=Facturada`, `P` con fecha, `S` con hora, `T` con nombres |
| Solicitud ya notificada | Pide confirmación antes de reenviar |
| `RESEND_API_KEY` inválida | El Sheet no se modifica; sigue `Pendiente` |
| Folio inexistente | 400 |
| Archivo que no es PDF ni XML | 400 |
| RFC con 3 solicitudes en 30 días y 1 de hace 60 | Salen 3 |
| Folio de hace 60 días | Sí lo encuentra |
| Panel y estatus a 360 px | Usables |

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md
git commit -m "Document the admin panel env var and the test command"
```

---

## Notas de ejecución

- **`ROSETA_ADMIN_PASSWORD` hay que darla de alta en Vercel** (Production y Preview) antes de que el panel sirva en el deploy. Sin ella los endpoints responden 500 a propósito, nunca abiertos.
- **Las columnas S y T deben tener encabezado** en el Sheet real (`Notificado el`, `Archivos enviados`). El código no lo exige, pero sin encabezado la pestaña queda confusa para quien la lea.
- **Desviación respecto al spec:** el spec decía que este trabajo no introducía infraestructura de pruebas. Las tareas 1-4 sí añaden `node:test` con un `npm test`. Es cero dependencias nuevas —el runner viene en Node 22— y hace que los pasos de TDD sean reales en vez de decorativos. Si se prefiere no tener `scripts.test` en el repo, se puede omitir la Task 1 Step 1 y correr `node --test tests/` a mano; el resto del plan no cambia.
