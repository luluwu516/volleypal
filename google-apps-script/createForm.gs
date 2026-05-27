/**
 * VolleyPal — one-shot Apps Script to create the registration Google Form
 * and wire up the onFormSubmit trigger that POSTs each submission to the
 * VolleyPal /api/form-webhook endpoint.
 *
 * One-time setup:
 *   1. Open https://script.google.com → New project
 *   2. Paste this whole file as Code.gs
 *   3. File → Project properties → Script properties, add:
 *        SUPABASE_WEBHOOK_URL = https://<your-app>.vercel.app/api/form-webhook
 *        SHARED_SECRET        = (same value as FORM_WEBHOOK_SHARED_SECRET in Vercel)
 *        TOURNAMENT_ID        = <uuid of the current tournament row in Supabase>
 *   4. Save the project (give it a name like "VolleyPal Form")
 *   5. Select function: createVolleyPalForm → Run
 *      (will prompt for permissions on first run — approve)
 *   6. After it finishes, check the execution log for:
 *        - Public form URL (give this to participants)
 *        - Edit URL (for organizers to tweak the form)
 *        - Responses sheet URL (Supabase is master, but Sheets is the backup)
 *
 * The onFormSubmit trigger is installed automatically. To re-create the
 * form later (e.g. for next year's tournament), bump FORM_TITLE and re-run
 * createVolleyPalForm; it will produce a NEW form (the old one stays).
 */

var FORM_TITLE = '2026 南加雙11星座盃 報名表';
var FORM_DESCRIPTION =
  '請填寫以下基本資料以完成報名。盃賽詳情請看競賽規章\n' +
  '⚠ 生日將用於星座分隊，請務必正確填寫。';

function createVolleyPalForm() {
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
  form.setDescription(FORM_DESCRIPTION)
      .setCollectEmail(false)            // we ask for email explicitly so it's in responses
      .setLimitOneResponsePerUser(false) // multiple devices OK, dedup happens server-side by email
      .setAllowResponseEdits(true)
      .setShowLinkToRespondAgain(false);

  // 姓名
  form.addTextItem()
      .setTitle('姓名')
      .setRequired(true);

  // Email (used as dedup key in /api/form-webhook)
  var emailRegex = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';
  form.addTextItem()
      .setTitle('Email')
      .setRequired(true)
      .setValidation(
        FormApp.createTextValidation()
          .setHelpText('請輸入有效的 email 地址')
          .requireTextMatchesPattern(emailRegex)
          .build()
      );

  // 電話 (optional)
  form.addTextItem()
      .setTitle('電話')
      .setHelpText('比賽當天緊急聯絡用，選填')
      .setRequired(false);

  // 生日 (date)
  form.addDateItem()
      .setTitle('生日')
      .setHelpText('用於星座分隊，年份請填正確')
      .setIncludesYear(true)
      .setRequired(true);

  // 性別
  form.addMultipleChoiceItem()
      .setTitle('性別')
      .setChoiceValues(['男', '女'])
      .setRequired(true);

  // 性別
  form.addMultipleChoiceItem()
      .setTitle('國籍 (非台灣人僅接受前十位報名成功者)')
      .setChoiceValues(['台灣', '非台灣'])
      .setRequired(true);

  // 場上位置
  form.addListItem()
      .setTitle('場上位置')
      .setHelpText('希望每個隊伍盡量都有一位舉球員')
      .setChoiceValues([
        '舉球員 (Setter)',
        '非舉球員 (Non-setter)',
      ])
      .setRequired(true);

  // 社交軟體聯絡方式
  form.addTextItem()
      .setTitle('Facebook')
      .setHelpText('將用於賽事通知與聯絡')
      .setRequired(true);

  // 聚餐意願
  form.addMultipleChoiceItem()
      .setTitle('聚餐意願')
      .setChoiceValues(['參加', '不參加'])
      .setRequired(true);

  // Install the onFormSubmit trigger so submissions push to Vercel
  removeExistingFormTriggers_();
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  // Optional: create a linked responses spreadsheet (backup view for organizers)
  var ssName = FORM_TITLE + ' — 回應';
  var ss = SpreadsheetApp.create(ssName);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log('=== VolleyPal form created ===');
  Logger.log('Public URL (share with participants):');
  Logger.log('  ' + form.getPublishedUrl());
  Logger.log('Short URL: ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('Edit URL (organizers):');
  Logger.log('  ' + form.getEditUrl());
  Logger.log('Responses spreadsheet:');
  Logger.log('  ' + ss.getUrl());
  Logger.log('onFormSubmit trigger installed and pointing at ' +
             props.getProperty('SUPABASE_WEBHOOK_URL'));
}

function removeExistingFormTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Receives every form submission and POSTs it to the VolleyPal webhook.
 * Same handler as google-apps-script/onFormSubmit.gs — kept here so this
 * file is self-contained.
 */
function onFormSubmit(e) {
  if (!e || !e.namedValues) {
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

  var responses = e.namedValues || {};
  var payload = {
    tournament_id: tournamentId,
    submitted_at: new Date().toISOString(),
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
  logError_(payload, lastErr);
}

/**
 * Manual smoke test — runs onFormSubmit with a fake event so you can verify
 * webhook connectivity without filling out the real form.
 * Select this function in the editor and click Run.
 * Check the execution log + your Supabase `registrations` table afterwards.
 */
function testOnFormSubmit() {
  var fakeEvent = {
    namedValues: {
      '姓名':   ['測試球員'],
      'Email':  ['test+' + Date.now() + '@example.com'],
      '電話':   ['0900000000'],
      '生日':   ['1990/06/15'],
      '性別':   ['女'],
      '國籍':   ['台灣'],
      '場上位置': ['舉球員 (Setter)'],
      'Facebook': ['fb.com/test'],
      '聚餐意願':  ['參加']
    }
  };
  onFormSubmit(fakeEvent);
  Logger.log('testOnFormSubmit done — check Supabase `registrations` table.');
}

function logError_(payload, message) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    var sheet = ss.getSheetByName('_errors') || ss.insertSheet('_errors');
    sheet.appendRow([new Date(), message, JSON.stringify(payload)]);
  } catch (e) {
    Logger.log('error logging failed: ' + e);
  }
}
