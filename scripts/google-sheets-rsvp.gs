/**
 * Google Apps Script that receives RSVPs and wishes from the wedding site
 * and appends each one as a row in this spreadsheet — RSVPs on the "RSVPs"
 * tab, wishes on the "Wishes" tab (with a "Hidden" column the site keeps up
 * to date when a wish is hidden from the wall).
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
 *
 * Updating from the RSVP-only version: paste this file over the old one but
 * KEEP your existing SECRET line, then deploy a new version as above. Until
 * you do, the site's wishes are simply not copied here (the old script
 * rejects them) — nothing is lost, they're all in the database.
 */

const SECRET = "change-me-to-a-long-random-string";
const SHEET_NAME = "RSVPs";
const HEADERS = ["Submitted At", "Name", "Phone", "Attending", "Events", "Message"];
const WISHES_SHEET_NAME = "Wishes";
const WISH_HEADERS = ["Submitted At", "Name", "Wish", "Who can see it", "Came from", "Hidden", "Wish ID"];
const WISH_ID_COLUMN = 7;
const WISH_HIDDEN_COLUMN = 6;

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "Invalid JSON" });
  }

  // Wishes authenticate with `auth`, RSVPs with `secret`.
  if ((data.kind ? data.auth : data.secret) !== SECRET) {
    return json({ ok: false, error: "Unauthorized" });
  }

  // Two guests submitting at the same moment must not race for the same row.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (data.kind === "wish") {
      getWishesSheet().appendRow([
        data.createdAt ? new Date(data.createdAt) : new Date(),
        asText(data.name),
        asText(data.message),
        data.visibility === "private" ? "Only the couple" : "Everyone",
        data.source === "rsvp" ? "RSVP form" : "Wishes wall",
        "",
        asText(data.id),
      ]);
      return json({ ok: true });
    }
    if (data.kind === "wish-hidden") {
      const sheet = getWishesSheet();
      const last = sheet.getLastRow();
      if (last > 1) {
        const ids = sheet.getRange(2, WISH_ID_COLUMN, last - 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(data.id)) {
            sheet.getRange(i + 2, WISH_HIDDEN_COLUMN).setValue(data.hidden ? "Hidden" : "");
            break;
          }
        }
      }
      return json({ ok: true });
    }

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

function getWishesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(WISHES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(WISHES_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(WISH_HEADERS);
    sheet.getRange(1, 1, 1, WISH_HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.getRange("A:A").setNumberFormat("dd mmm yyyy, h:mm am/pm");
    sheet.getRange("C:C").setWrap(true);
    sheet.setColumnWidth(3, 420);
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
