/**
 * @OnlyCurrentDoc
 *
 * Story Sprout — webinar sign-up handler (Google Apps Script).
 *
 * Appends each sign-up to the spreadsheet AND emails both organizers. Because
 * Apps Script sends mail as the Google account that owns this script, no
 * third-party email service is needed.
 *
 * The @OnlyCurrentDoc annotation above matters: without it Apps Script asks for
 * access to ALL your spreadsheets. With it, the consent screen asks only for
 * this one document plus permission to send mail as you.
 *
 * On first authorization Google shows "Google hasn't verified this app". That is
 * expected for any unverified script and does not mean anything is wrong — you
 * are the developer it names. Click Advanced → "Go to … (unsafe)" → Allow.
 * Only you ever see this screen; visitors to the website never touch Google
 * sign-in.
 *
 * ─── Setup ────────────────────────────────────────────────────────────────
 *  1. Open the spreadsheet:
 *     https://docs.google.com/spreadsheets/d/1w6L0jwd2UWUYTqnRdl4_Q75Eay-M-AhTma-85RYHKpo/edit
 *  2. Extensions → Apps Script. Delete the placeholder, paste this file, Save.
 *     Rename the project (top left) to "Story Sprout sign-ups" so the consent
 *     screen and your Google account's permissions list are readable later.
 *  3. Edit SHARED_TOKEN below to a long random string of your own.
 *  4. Deploy → New deployment → type "Web app"
 *       Execute as:      Me
 *       Who has access:  Anyone
 *     Authorize when prompted (it needs permission to edit the sheet and send
 *     mail as you). Copy the /exec URL it gives you.
 *  5. In Cloudflare → Workers & Pages → story-sprout → Settings → Variables:
 *       SIGNUP_SCRIPT_URL   = the /exec URL
 *       SIGNUP_SCRIPT_TOKEN = the same string as SHARED_TOKEN
 *
 * Re-deploy (Deploy → Manage deployments → edit → Version: New) after any edit,
 * or the old code keeps running.
 */

// Must match SIGNUP_SCRIPT_TOKEN in Cloudflare. Anyone who learns this URL
// could otherwise post rows into your sheet.
var SHARED_TOKEN = 'CHANGE-ME-to-a-long-random-string';

var NOTIFY = ['lzhang688@gmail.com', 'kmi.aistorybooks@gmail.com'];
var SHEET_NAME = 'Signups';
var HEADERS = ['Timestamp', 'Session', 'Name', 'Email', 'Organization', 'Emailed'];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (!SHARED_TOKEN || body.token !== SHARED_TOKEN) {
      return respond({ error: 'unauthorized' });
    }

    var name = String(body.name || '').trim();
    var email = String(body.email || '').trim();
    var org = String(body.org || '').trim();
    var sessionLabel = String(body.sessionLabel || body.sessionId || '').trim();

    if (!name || !email) return respond({ error: 'missing name or email' });

    // 1. Record it. This is the part that must not be lost.
    var sheet = getSheet();
    var stamp = new Date();
    sheet.appendRow([stamp, sessionLabel, name, email, org, 'no']);
    var row = sheet.getLastRow();

    // 2. Notify. Best effort — the row is already saved.
    var emailed = false;
    try {
      MailApp.sendEmail({
        to: NOTIFY.join(','),
        replyTo: email,
        subject: 'Webinar sign-up: ' + name + ' — ' + sessionLabel,
        htmlBody:
          '<p><strong>' + escapeHtml(name) + '</strong> signed up for a Story Sprout training webinar.</p>' +
          '<table cellpadding="6" style="border-collapse:collapse">' +
          '<tr><td><strong>Session</strong></td><td>' + escapeHtml(sessionLabel) + '</td></tr>' +
          '<tr><td><strong>Name</strong></td><td>' + escapeHtml(name) + '</td></tr>' +
          '<tr><td><strong>Email</strong></td><td>' + escapeHtml(email) + '</td></tr>' +
          (org ? '<tr><td><strong>Organization</strong></td><td>' + escapeHtml(org) + '</td></tr>' : '') +
          '</table>' +
          '<p style="color:#666">Row ' + row + ' of the sign-up sheet.</p>'
      });
      emailed = true;
      sheet.getRange(row, 6).setValue('yes');
    } catch (mailErr) {
      // Leave "no" in the Emailed column so it can be found and followed up.
      console.error('mail failed: ' + mailErr);
    }

    return respond({ ok: true, stored: true, emailed: emailed, row: row });
  } catch (err) {
    console.error(err);
    return respond({ error: String(err) });
  }
}

/** Lets you confirm the deployment is live by opening the URL in a browser. */
function doGet() {
  return respond({ ok: true, service: 'story-sprout-signup' });
}

function getSheet() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = doc.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
