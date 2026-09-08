/**
 * VolleyPal — drop-in Apps Script for attaching the VolleyPal webhook to a
 * REGISTRATION Google Form that ALREADY EXISTS (imported from last year,
 * built by a co-organizer, etc.). Sends each submission to /api/form-webhook
 * with form_type: "registration" so it lands in the `registrations` table.
 *
 * When to use this vs createForm.gs:
 *   - Someone else already built the registration form → use THIS file.
 *   - You need to build a fresh registration form from scratch → use
 *     createForm.gs (creates form + attaches this exact webhook).
 *
 * Sibling file: attachWaiverWebhook.gs does the same trick for the waiver
 * form (sends form_type: "waiver" instead).
 *
 * What the form should ask for (webhook is tolerant on titles — case-
 * insensitive `includes` match — so exact wording doesn't matter):
 *   - 姓名 / Name  (required — the only always-present identifier)
 *   - Email        (strongly recommended — dedup / waiver-match key)
 *   - 生日 / Birthday
 *   - 性別 / Gender
 *   - 國籍 / Nationality  (needed for the non-TW quota; missing → default TW)
 *   - 場上位置 / Position
 *   - MBTI, 電話, etc. (optional, saved to raw_form_payload for admin reference)
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
 *   6. To smoke-test without a real submission, run testOnFormSubmit — it
 *      POSTs a mock event. Check Supabase `registrations` afterwards.
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
  Logger.log('Registration webhook trigger installed on form: ' + form.getTitle());
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
    // Explicit even though 'registration' is the webhook default — makes it
    // obvious in Executions log and future-proofs against a default change.
    form_type: 'registration',
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
  Logger.log('form-webhook failed after 3 attempts: ' + lastErr);
  Logger.log('payload was: ' + JSON.stringify(payload));
}

function testOnFormSubmit() {
  // Fixed email is the shared test key across all four scripts. Running
  // this + a waiver-side testOnFormSubmit produces a fully-waitlisted
  // "測試球員" that admin can confirm to move onto the active roster.
  // To reset between runs, delete the row from Supabase.
  var fakeEvent = {
    namedValues: {
      '姓名':     ['測試球員'],
      'Email':    ['test-player@example.com'],
      '電話':     ['0900000000'],
      '生日':     ['1990/06/15'],
      '性別':     ['女'],
      '國籍':     ['台灣'],
      '場上位置': ['舉球員 (Setter)']
    }
  };
  onFormSubmit(fakeEvent);
  Logger.log(
    'testOnFormSubmit done — check Supabase `registrations` (email=test-player@example.com). ' +
    'is_active=false, waiver_signed_at=null until waiver test + admin confirm.'
  );
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
