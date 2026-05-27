/**
 * Google Apps Script for VolleyPal registration form.
 *
 * Setup:
 *   1. Open your Google Form → ⋮ menu → Script editor
 *   2. Paste this file as Code.gs
 *   3. File → Project properties → Script properties:
 *        SUPABASE_WEBHOOK_URL = https://<your-app>.vercel.app/api/form-webhook
 *        SHARED_SECRET        = <same value as FORM_WEBHOOK_SHARED_SECRET in Vercel>
 *        TOURNAMENT_ID        = <uuid of the current tournament in Supabase>
 *   4. Triggers (clock icon) → Add Trigger:
 *        function = onFormSubmit
 *        event source = From form
 *        event type = On form submit
 *
 * Failed posts are logged to a tab called "_errors" in the linked spreadsheet.
 */

function onFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_WEBHOOK_URL');
  var secret = props.getProperty('SHARED_SECRET');
  var tournamentId = props.getProperty('TOURNAMENT_ID');
  if (!url || !secret || !tournamentId) {
    throw new Error('Missing script properties');
  }

  var responses = e.namedValues || {};
  var payload = {
    tournament_id: tournamentId,
    submitted_at: new Date().toISOString(),
    responses: responses,
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var lastErr = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var res = UrlFetchApp.fetch(url, options);
      var code = res.getResponseCode();
      if (code >= 200 && code < 300) return;
      lastErr = 'HTTP ' + code + ': ' + res.getContentText();
    } catch (err) {
      lastErr = String(err);
    }
    Utilities.sleep(1000 * (attempt + 1));
  }
  logError_(payload, lastErr);
}

function logError_(payload, message) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('_errors') || ss.insertSheet('_errors');
    sheet.appendRow([new Date(), message, JSON.stringify(payload)]);
  } catch (e) {
    Logger.log('error logging failed: ' + e);
  }
}
