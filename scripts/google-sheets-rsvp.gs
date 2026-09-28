/**
 * Google Apps Script that receives RSVPs from the wedding site and appends
 * each one as a row in this spreadsheet.
 *
 * One-time setup:
 *  1. Create a Google Sheet (e.g. "Cathul RSVPs").
 *  2. Extensions → Apps Script. Replace everything in Code.gs with this file.
 *  3. Change SECRET below to a long random string (keep it private).
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as: Me
 *       Who has access: Anyone
 *     Authorize when asked, then copy the Web app URL (ends in /exec).
 *  5. On Vercel (Project Settings → Environment Variables) and in .env.local:
 *       GOOGLE_SHEETS_WEBHOOK_URL    = the /exec URL
 *       GOOGLE_SHEETS_WEBHOOK_SECRET = the same SECRET as below
 *     then redeploy the site.
 *
 * If you edit this script later, use Deploy → Manage deployments → Edit →
 * Version: New version, so the /exec URL stays the same.
 */

const SECRET = "change-me-to-a-long-random-string";
const SHEET_NAME = "RSVPs";
const HEADERS = ["Submitted At", "Name", "Phone", "Attending", "Events", "Message"];

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "Invalid JSON" });
  }

  if (data.secret !== SECRET) {
    return json({ ok: false, error: "Unauthorized" });
  }

  // Two guests submitting at the same moment must not race for the same row.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet();
    sheet.appendRow([
      data.submittedAt ? new Date(data.submittedAt) : new Date(),
      asText(data.name),
      asText(data.phone),
      data.attending === "yes" ? "Yes" : "No",
      asText((data.events || []).join(", ")),
      asText(data.message),
    ]);
  } finally {
    lock.releaseLock();
  }

  return json({ ok: true });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat("dd mmm yyyy, h:mm am/pm");
  }
  return sheet;
}

// Guest input is stored as plain text: a leading ' stops Sheets from treating
// "+91 98…" as a number or "=something" as a formula.
function asText(value) {
  const s = String(value == null ? "" : value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
