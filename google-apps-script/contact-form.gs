/**
 * Famies contact form -> Google Sheet.
 *
 * Standalone Apps Script (script.google.com -> New project). Appends each
 * submission from famies.app/contact to the "Contact" tab of the Famies sheet,
 * creating the tab and its header row on first use. Kept separate from the
 * skapa-event script so the two forms can't break each other.
 *
 * Deploy: Deploy -> New deployment -> Web app,
 *   Execute as: Me, Who has access: Anyone.
 * Paste the /exec URL into CONTACT_SHEET_URL in src/app/contact/page.js.
 */

const SPREADSHEET_ID = '1Jfi8SIy12ZSKMD6TvlV4fMbMcdYJQVTgXRiPajTkpdY';
const SHEET_NAME = 'Contact';
const TIMEZONE = 'Europe/Stockholm';

// [header, payload key] — header text is what shows in row 1 of the tab.
const COLUMNS = [
  ['Timestamp', null],
  ['Name', 'name'],
  ['Email', 'email'],
  ['Subject', 'subject'],
  ['Message', 'message'],
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getSheet_();
    const timestamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    const row = COLUMNS.map(([, key]) => (key ? clean_(data[key]) : timestamp));
    sheet.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    const headers = COLUMNS.map(([header]) => header);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Strings only, trimmed, and neutralise formula injection (=, +, -, @).
function clean_(value) {
  const s = String(value == null ? '' : value).trim().slice(0, 5000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
