/**
 * VolleyPal — drop-in Apps Script for attaching the VolleyPal webhook to a
 * Google Form that ALREADY EXISTS (typically supplied by the venue for
 * waiver signing). Sends each submission to /api/form-webhook with
 * form_type: "waiver" so it matches against a registration by email.
 *
 * When to use this vs createWaiverForm.gs:
 *   - Venue gave you a link to their own waiver form → use THIS file.
 *   - You need to build a fresh waiver form from scratch → use
 *     createWaiverForm.gs (creates form + attaches this exact webhook).
 *
 * Requirements for the venue's form:
 *   - Must ask for the participant's EMAIL (the only reliable match key).
 *     Ideally the same email question the registration form asks for.
 *   - Should ask for name (nice-to-have; helps admin manually match orphans).
 *
 * Setup on the existing form:
 *   1. Open the form → 「擴充功能」→ Apps Script (opens a bound script)
 *   2. Paste this whole file into Code.gs (replace anything there)
 *   3. File → Project properties → Script properties, add:
 *        SUPABASE_WEBHOOK_URL = https://<your-app>.vercel.app/api/form-webhook
 *        SHARED_SECRET        = (same as FORM_WEBHOOK_SHARED_SECRET in Vercel)
 *        TOURNAMENT_ID        = <uuid of the current tournament>
 *   4. Save the project.
 *   5. Select function: installTrigger → Run
 *      (approve permission prompt the first time)
 *   6. To smoke-test without a real submission, run testOnFormSubmit —
 *      it POSTs a mock event. Check Supabase `pending_waivers` (or the
 *      matched `registrations` row's waiver_signed_at column).
 *
 * If the form's email question is titled something unusual (e.g. "Contact
 * email"), the webhook's tolerant field-picker will still find it as long
 * as the title contains "email" (case-insensitive).
 */

function installTrigger() {
  var props = PropertiesService.getScriptProperties();
  var required = ['SUPABASE_WEBHOOK_URL', 'SHARED_SECRET', 'TOURNAMENT_ID'];
  for (var i = 0; i < required.length; i++) {
    if (!props.getProperty(required[i])) {
      throw new Error(
        'Missing Script property: ' + required[i] +
        '. Set it via File → Project properties → Script properties before running.'
      );
    }
  }
  // Bound-script context: FormApp.getActiveForm() returns the form this
  // script is attached to. For standalone scripts, use FormApp.openById().
  var form = FormApp.getActiveForm();
  if (!form) {
    throw new Error(
      'No active form. This script must be attached via 「擴充功能 → Apps Script」 ' +
      'on an existing Google Form.'
    );
  }
  removeExistingFormTriggers_(form);
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();
  Logger.log('Waiver-webhook trigger installed on form: ' + form.getTitle());
}

function removeExistingFormTriggers_(form) {
  // Only touch triggers for THIS form so unrelated Apps Script projects in
  // the same account are safe. Passing the wrong form here just no-ops.
  var formId = form.getId();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    if (
      t.getHandlerFunction() === 'onFormSubmit' &&
      t.getTriggerSourceId() === formId
    ) {
      ScriptApp.deleteTrigger(t);
    }
  }
}

function onFormSubmit(e) {
  if (!e) {
    throw new Error(
      'onFormSubmit must be invoked by a form-submit trigger, not Run-in-editor. ' +
      'Submit the live form once, or run `testOnFormSubmit` for a mocked call.'
    );
  }
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_WEBHOOK_URL');
  var secret = props.getProperty('SHARED_SECRET');
  var tournamentId = props.getProperty('TOURNAMENT_ID');
  if (!url || !secret || !tournamentId) {
    throw new Error('Missing script properties');
  }

  var responses = extractResponses_(e);
  var payload = {
    tournament_id: tournamentId,
    submitted_at: new Date().toISOString(),
    form_type: 'waiver',
    responses: responses
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
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
  Logger.log('waiver-webhook failed after 3 attempts: ' + lastErr);
  Logger.log('payload was: ' + JSON.stringify(payload));
}

function testOnFormSubmit() {
  // Fixed email that matches the registration script's testOnFormSubmit so
  // running both in sequence produces a fully-waitlisted test player. If
  // you run the waiver test first, this ends up in pending_waivers and gets
  // consumed when the registration test runs afterwards.
  var fakeEvent = {
    namedValues: {
      '姓名':  ['測試球員'],
      'Email': ['test-player@example.com'],
      '簽署':  ['我已閱讀並同意']
    }
  };
  onFormSubmit(fakeEvent);
  // Response comes back as a 200 from the webhook — Apps Script never
  // learns whether the email matched. To confirm, check Supabase:
  //   select waiver_signed_at from registrations where email='test-player@example.com';
  // If it's populated, match succeeded. If pending_waivers has the row,
  // no matching registration exists yet — run the registration test first.
  Logger.log('testOnFormSubmit done — inspect Supabase to see whether it matched or went to pending_waivers.');
}

function extractResponses_(e) {
  if (e.namedValues) return e.namedValues;
  if (e.response && typeof e.response.getItemResponses === 'function') {
    var out = {};
    var itemResponses = e.response.getItemResponses();
    for (var i = 0; i < itemResponses.length; i++) {
      var ir = itemResponses[i];
      var title = ir.getItem().getTitle();
      var resp = ir.getResponse();
      out[title] = Array.isArray(resp) ? resp.map(String) : [String(resp)];
    }
    return out;
  }
  return {};
}
