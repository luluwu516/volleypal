/**
 * VolleyPal — one-shot Apps Script to create a canonical WAIVER Google Form
 * and wire it to the VolleyPal /api/form-webhook endpoint with
 * `form_type: "waiver"`.
 *
 * Use this ONLY when the venue does not supply their own waiver form. If
 * they do, use `attachWaiverWebhook.gs` on their form instead.
 *
 * Setup (parallels createForm.gs):
 *   1. Open https://script.google.com → New project
 *   2. Paste this whole file as Code.gs
 *   3. File → Project properties → Script properties, add:
 *        SUPABASE_WEBHOOK_URL = https://<your-app>.vercel.app/api/form-webhook
 *        SHARED_SECRET        = (same as FORM_WEBHOOK_SHARED_SECRET in Vercel)
 *        TOURNAMENT_ID        = <uuid of the current tournament row>
 *   4. Save (name it "VolleyPal Waiver Form")
 *   5. Select function: createVolleyPalWaiverForm → Run
 *   6. Check Executions log for the public + edit URLs
 *
 * The webhook matches waivers to registrations by EMAIL. This form asks
 * for email + name only; the actual waiver text lives in the form
 * description as a required checkbox item. Tweak WAIVER_TEXT below.
 */

var FORM_TITLE = 'VolleyPal 免責同意書 (Waiver)';
var WAIVER_TEXT =
  '本人瞭解排球活動的相關風險,包括但不限於扭傷、拉傷、碰撞、跌倒等運動傷害。' +
  '本人自願承擔參加本次賽事之風險,並同意不追究主辦方、場地方及其他參與者之責任。' +
  '本人確認提供之個人資料為真實,並同意主辦方為賽事所需之目的處理與使用。';

function createVolleyPalWaiverForm() {
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

  var form = FormApp.create(FORM_TITLE);
  form.setDescription(
        '請完整閱讀以下條款,並在最後勾選「我已閱讀並同意」以完成簽署。\n\n' +
        WAIVER_TEXT
      )
      .setCollectEmail(false)
      .setLimitOneResponsePerUser(false)
      .setAllowResponseEdits(true)
      .setShowLinkToRespondAgain(false);

  // 姓名
  form.addTextItem()
      .setTitle('姓名')
      .setHelpText('請填寫與報名表相同的姓名')
      .setRequired(true);

  // Email — the match key
  var emailRegex = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';
  form.addTextItem()
      .setTitle('Email')
      .setHelpText('請填寫與報名表相同的 email,系統會依此對照')
      .setRequired(true)
      .setValidation(
        FormApp.createTextValidation()
          .setHelpText('請輸入有效的 email 地址')
          .requireTextMatchesPattern(emailRegex)
          .build()
      );

  // Waiver agreement — required checkbox
  form.addCheckboxItem()
      .setTitle('簽署')
      .setHelpText('必須勾選')
      .setChoiceValues(['我已閱讀並同意上述 waiver 條款'])
      .setRequired(true);

  removeExistingFormTriggers_(form);
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  var ss = SpreadsheetApp.create(FORM_TITLE + ' — 回應');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  props.setProperty('RESPONSES_SHEET_ID', ss.getId());

  Logger.log('=== VolleyPal waiver form created ===');
  Logger.log('Public URL: ' + form.getPublishedUrl());
  Logger.log('Short URL:  ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('Edit URL:   ' + form.getEditUrl());
  Logger.log('Sheet URL:  ' + ss.getUrl());
}

function removeExistingFormTriggers_(form) {
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
  logError_(payload, lastErr);
}

function testOnFormSubmit() {
  // Fixed email matches the registration script's testOnFormSubmit — running
  // both scripts in sequence produces a fully-waitlisted test player without
  // hitting the orphan waiver path.
  var fakeEvent = {
    namedValues: {
      '姓名':   ['測試球員'],
      'Email':  ['test-player@example.com'],
      '簽署':   ['我已閱讀並同意上述 waiver 條款']
    }
  };
  onFormSubmit(fakeEvent);
  Logger.log('testOnFormSubmit done — inspect Supabase registrations.waiver_signed_at or pending_waivers.');
}

function logError_(payload, message) {
  try {
    var ss = getResponsesSheet_();
    if (!ss) {
      Logger.log('logError_: no spreadsheet available');
      return;
    }
    var sheet = ss.getSheetByName('_errors') || ss.insertSheet('_errors');
    sheet.appendRow([new Date(), message, JSON.stringify(payload)]);
  } catch (e) {
    Logger.log('error logging failed: ' + e);
  }
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

function getResponsesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty(
    'RESPONSES_SHEET_ID',
  );
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { Logger.log(e); }
  }
  return null;
}
