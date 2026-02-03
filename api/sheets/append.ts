import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const { values } = req.body || {};
    if (!Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: "values[] required" });
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
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });

    return res.status(200).json({ ok: true, updates: result.data.updates });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
