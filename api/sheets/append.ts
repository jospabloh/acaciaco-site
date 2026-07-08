import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";
import { timingSafeEqual } from "crypto";

// Simple in-memory sliding-window rate limit (same "module-scope cache" pattern
// used by api/exchange-rate.js and api/worldcup.js — persists across warm
// invocations, resets on cold start; good enough for a low-traffic internal
// endpoint, not meant to survive a distributed/serverless fleet at scale).
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 20;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (hits.get(key) || []).filter((ts) => ts > windowStart);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 1000) hits.clear(); // simple guard against unbounded growth
  return recent.length > RATE_LIMIT_MAX;
}

function getClientKey(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const ip = Array.isArray(fwd) ? fwd[0] : (fwd || "").split(",")[0].trim();
  return ip || req.socket?.remoteAddress || "unknown";
}

// Constant-time shared-secret check so a mismatched secret can't be brute-forced
// via response-timing differences.
function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.SHEETS_APPEND_SECRET;
  if (!secret) return false;

  const header = req.headers["authorization"];
  const authHeader = Array.isArray(header) ? header[0] : header || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const apiKeyHeader = req.headers["x-api-key"];
  const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader || "";

  const provided = bearer || apiKey;
  if (!provided) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}

// Classic spreadsheet formula-injection prefixes. Rejecting these (rather than
// relying only on valueInputOption below) keeps the guard explicit and cheap.
const FORMULA_PREFIXES = ["=", "+", "-", "@"];

function hasFormulaInjection(values: unknown[]): boolean {
  return values.some(
    (v) => typeof v === "string" && FORMULA_PREFIXES.includes(v.trim()[0])
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (isRateLimited(getClientKey(req))) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const { values } = req.body || {};
    if (!Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: "values[] required" });
    }

    if (hasFormulaInjection(values)) {
      return res.status(400).json({ error: "values[] must not contain formula-like strings" });
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!spreadsheetId || !saJson) {
      return res.status(500).json({ error: "Missing env vars" });
    }

    const creds = JSON.parse(saJson);

    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Egresos!A:Z",
      // RAW: values are stored literally and never evaluated as formulas
      // (belt-and-suspenders alongside the explicit prefix check above).
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });

    return res.status(200).json({ ok: true, updates: result.data.updates });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
