import { google } from "googleapis";

// Shared Google Sheets helper for the Roseta factura endpoints. Reuses the
// same service account already configured for api/sheets/append.ts — just a
// different spreadsheet, dedicated to Roseta's invoice requests.

function getAuth() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
  const creds = JSON.parse(saJson);
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export function getSpreadsheetId(): string {
  const id = process.env.ROSETA_FACTURA_SPREADSHEET_ID;
  if (!id) throw new Error("Missing ROSETA_FACTURA_SPREADSHEET_ID");
  return id;
}

export async function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export async function getValues(range: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range,
  });
  return (res.data.values as string[][]) || [];
}

export async function appendRow(range: string, values: unknown[]): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

export async function updateRow(range: string, values: unknown[]): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

// Classic spreadsheet formula-injection prefixes — same guard used by
// api/sheets/append.ts, applied here since these rows come from the public.
const FORMULA_PREFIXES = ["=", "+", "-", "@"];

export function sanitizeCell(v: unknown): string {
  const s = v == null ? "" : String(v).trim();
  if (s && FORMULA_PREFIXES.includes(s[0])) return "'" + s;
  return s;
}
