import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  businessHoursElapsed,
  COL,
  cell,
  ESTATUS_SUCURSAL_INCORRECTA,
  fallbackFacturacionTimestamp,
  fallbackSolicitudTimestamp,
  FACTURA_BUSINESS_HOURS_PER_DAY,
  FACTURA_SLA_BUSINESS_DAYS,
  FACTURA_SLA_BUSINESS_HOURS,
  FICO_3C_SUCURSAL,
  fmtMoney,
  isWithinDays,
  NOTIFY_EMAILS,
  OTHER_BRANCH_CONTACTS,
  plainAmount,
  publicSolicitud,
  findRowNumber,
  resendEmailUrl,
  SOLICITUDES_RANGE,
} from "../api/roseta/_facturaRows.ts";

// A row shaped exactly like factura-submit.ts writes it, extended to V.
function row(over: Record<string, string> = {}): string[] {
  const r = [
    "RF-20260801-AB12", "2026-08-01", "XAXX010101000", "Juan Pérez",
    "612", "G03", "20000", "juan@ejemplo.com", "4490000000", "UAA",
    "2026-07-31", "348.00", "Efectivo", "MOV-991",
    "Pendiente", "", "300.00", "48.00", "", "", "",
    "2026-08-01T15:30:00.000Z",
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

test("plainAmount da un número simple sin símbolo ni MXN, para copiar y pegar", () => {
  assert.equal(plainAmount("348"), "348.00");
  assert.equal(plainAmount("300.5"), "300.50");
  assert.equal(plainAmount("no-es-numero"), "no-es-numero");
  assert.equal(plainAmount(""), "");
});

test("plainAmount nunca incluye $ ni MXN", () => {
  const out = plainAmount("1234.5");
  assert.equal(out.includes("$"), false);
  assert.equal(out.toUpperCase().includes("MXN"), false);
});

test("NOTIFY_EMAILS trae las dos direcciones internas de Roseta", () => {
  assert.deepEqual(NOTIFY_EMAILS, ["roseta.cafeteria@gmail.com", "roseta@acaciaco.com.mx"]);
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

// Business hours are Mon–Fri 7:00–18:00 Mexico City time (fixed UTC-6, no
// DST since 2022), so local HH:00 is UTC (HH+6):00 on the same calendar day.

test("businessHoursElapsed da 0 para el mismo instante", () => {
  assert.equal(businessHoursElapsed("2026-08-03T13:00:00.000Z", "2026-08-03T13:00:00.000Z"), 0);
});

test("businessHoursElapsed cuenta horas parciales dentro de un mismo día", () => {
  // lunes 7:00 a 10:00 local → 3 horas
  assert.equal(businessHoursElapsed("2026-08-03T13:00:00.000Z", "2026-08-03T16:00:00.000Z"), 3);
});

test("businessHoursElapsed no acredita un día completo a una solicitud tardía", () => {
  // lunes 17:00 (1 hora antes del cierre) a martes 8:00 local → 1h lunes + 1h martes = 2
  assert.equal(businessHoursElapsed("2026-08-03T23:00:00.000Z", "2026-08-04T14:00:00.000Z"), 2);
});

test("businessHoursElapsed salta el fin de semana", () => {
  // viernes 17:00 a lunes 8:00 local → 1h viernes + 1h lunes = 2 (sáb/dom no cuentan)
  assert.equal(businessHoursElapsed("2026-08-07T23:00:00.000Z", "2026-08-10T14:00:00.000Z"), 2);
});

test("businessHoursElapsed suma varios días hábiles completos", () => {
  // lunes 7:00 a viernes 7:00 local → 4 días × 11h = 44
  assert.equal(businessHoursElapsed("2026-08-03T13:00:00.000Z", "2026-08-07T13:00:00.000Z"), 44);
});

test("businessHoursElapsed salta un feriado (Navidad) igual que el fin de semana", () => {
  // jueves 24 17:00 a lunes 28 8:00 local → 1h jue + 0 (vie 25 feriado, sáb/dom) + 1h lun = 2
  assert.equal(businessHoursElapsed("2026-12-24T23:00:00.000Z", "2026-12-28T14:00:00.000Z"), 2);
});

test("businessHoursElapsed da 0 si `to` es anterior o igual a `from`", () => {
  assert.equal(businessHoursElapsed("2026-08-05T13:00:00.000Z", "2026-08-01T13:00:00.000Z"), 0);
  assert.equal(businessHoursElapsed("2026-08-05T13:00:00.000Z", "2026-08-05T13:00:00.000Z"), 0);
});

test("businessHoursElapsed da 0 con fechas vacías o malformadas, en vez de lanzar", () => {
  assert.equal(businessHoursElapsed("", "2026-08-05T13:00:00.000Z"), 0);
  assert.equal(businessHoursElapsed("2026-08-01T13:00:00.000Z", ""), 0);
  assert.equal(businessHoursElapsed("no-es-fecha", "2026-08-05T13:00:00.000Z"), 0);
});

test("FACTURA_SLA_BUSINESS_DAYS es 3, la promesa que se hace en toda la página pública", () => {
  assert.equal(FACTURA_SLA_BUSINESS_DAYS, 3);
});

test("FACTURA_SLA_BUSINESS_HOURS son 3 días × 11 horas hábiles (7:00–18:00) = 33", () => {
  assert.equal(FACTURA_BUSINESS_HOURS_PER_DAY, 11);
  assert.equal(FACTURA_SLA_BUSINESS_HOURS, 33);
});

test("fallbackSolicitudTimestamp asume la apertura (7:00 local) del día de la fecha", () => {
  assert.equal(fallbackSolicitudTimestamp("2026-09-19"), "2026-09-19T13:00:00.000Z");
});

test("fallbackFacturacionTimestamp asume el cierre (18:00 local) del día de la fecha", () => {
  assert.equal(fallbackFacturacionTimestamp("2026-09-19"), "2026-09-20T00:00:00.000Z");
});

test("los fallback de timestamp dan cadena vacía con una fecha vacía o malformada", () => {
  assert.equal(fallbackSolicitudTimestamp(""), "");
  assert.equal(fallbackSolicitudTimestamp("no-es-fecha"), "");
  assert.equal(fallbackFacturacionTimestamp(""), "");
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
  const s = publicSolicitud(row()) as unknown as Record<string, string>;
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

test("el rango cubre hasta la columna V", () => {
  assert.equal(SOLICITUDES_RANGE, "Solicitudes!A:V");
});

test("resendEmailUrl arma la URL del dashboard", () => {
  assert.equal(resendEmailUrl("abc-123"), "https://resend.com/emails/abc-123");
});

test("resendEmailUrl escapa lo que reciba", () => {
  assert.equal(resendEmailUrl(" a/b "), "https://resend.com/emails/a%2Fb");
});

// The Resend id points at a delivery record with the customer's address in
// it; it is operator-only and must never reach the public lookup.
test("publicSolicitud no expone el ID de Resend", () => {
  const r = row({ RESEND_ID: "re_secreto_123" });
  const blob = JSON.stringify(publicSolicitud(r));
  assert.equal(blob.includes("re_secreto_123"), false);
  assert.equal("resend_url" in publicSolicitud(r), false);
});

test("FICO_3C_SUCURSAL es la única sucursal que este sistema factura", () => {
  assert.equal(FICO_3C_SUCURSAL, "Fico 3C (Tres Centurias)");
});

test("OTHER_BRANCH_CONTACTS trae los dos contactos en formato internacional", () => {
  assert.deepEqual(OTHER_BRANCH_CONTACTS, {
    "Plaza Universidad": "+52 449 386 2108",
    UAA: "+52 449 305 3349",
  });
});

test("OTHER_BRANCH_CONTACTS no incluye Fico 3C ni Otra", () => {
  assert.equal(FICO_3C_SUCURSAL in OTHER_BRANCH_CONTACTS, false);
  assert.equal("Otra" in OTHER_BRANCH_CONTACTS, false);
});

test("ESTATUS_SUCURSAL_INCORRECTA es el estatus terminal que usa el redirect", () => {
  assert.equal(ESTATUS_SUCURSAL_INCORRECTA, "Sucursal incorrecta");
});

// Same guarantee tests/facturaValidation.test.ts gives the régimen/uso
// dropdowns: an option the redirect can't resolve to a real contact — or a
// contact whose branch name doesn't match any option — can't silently drift
// apart from what the customer actually sees.
test("las sucursales del select y OTHER_BRANCH_CONTACTS no se separaron", () => {
  const html = readFileSync(new URL("../roseta/factura/index.html", import.meta.url), "utf8");
  const select = /<select[^>]*id="sucursal"[^>]*>([\s\S]*?)<\/select>/.exec(html);
  assert.ok(select, `no <select id="sucursal"> in roseta/factura/index.html`);
  const options = [...select[1].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);

  assert.deepEqual(options.sort(), ["Fico 3C (Tres Centurias)", "Otra", "Plaza Universidad", "UAA"]);
  assert.ok(options.includes(FICO_3C_SUCURSAL));
  for (const sucursal of Object.keys(OTHER_BRANCH_CONTACTS)) {
    assert.ok(options.includes(sucursal), `OTHER_BRANCH_CONTACTS tiene "${sucursal}", que no es una opción del select`);
  }
});
