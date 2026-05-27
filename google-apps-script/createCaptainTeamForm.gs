/**
 * VolleyPal — 正規盃賽 (隊長代報) Google Form generator.
 *
 * 與 createForm.gs 的差別：
 *   - 由「隊長」一次幫整隊 12 位球員報名
 *   - 不問場上位置（正規比賽教練 / 隊長自己排）
 *   - 每位球員都有「是否為非台灣人」勾選框 (僅限前 10 位)
 *   - 聚餐意願以隊伍為單位
 *
 * 一份表單送出 → onFormSubmit 自動拆成 12 筆 registrations POST 到 webhook
 * (隊長有 email，球員 2-12 只有姓名 + 國籍 + 隊伍名)
 *
 * Setup 步驟：
 *   1. https://script.google.com → New project，貼整個檔
 *   2. Project Settings → Script properties 設：
 *        SUPABASE_WEBHOOK_URL = https://<your-app>.vercel.app/api/form-webhook
 *        SHARED_SECRET        = (= Vercel FORM_WEBHOOK_SHARED_SECRET)
 *        TOURNAMENT_ID        = <下一屆 tournament 的 UUID>
 *   3. 選 createCaptainTeamForm → Run，授權
 *   4. 看 Execution log 拿到表單 URL
 */

var FORM_TITLE = '2027 VolleyPal 排球盃 報名表 (隊長代報)';
var FORM_DESCRIPTION =
  '由隊長代表整隊（共 12 位球員）填寫報名。\n' +
  '⚠ 非台灣人僅接受全活動前 10 位報名成功者，請如實勾選國籍。';
var ROSTER_SIZE = 12; // 隊長 + 11 球員

function createCaptainTeamForm() {
  var props = PropertiesService.getScriptProperties();
  var required = ['SUPABASE_WEBHOOK_URL', 'SHARED_SECRET', 'TOURNAMENT_ID'];
  for (var i = 0; i < required.length; i++) {
    if (!props.getProperty(required[i])) {
      throw new Error('Missing Script property: ' + required[i]);
    }
  }

  var form = FormApp.create(FORM_TITLE);
  form.setDescription(FORM_DESCRIPTION)
      .setCollectEmail(false)
      .setLimitOneResponsePerUser(false)
      .setAllowResponseEdits(true)
      .setShowLinkToRespondAgain(false);

  // ── 隊伍資訊 ──
  form.addSectionHeaderItem().setTitle('隊伍資訊');

  form.addTextItem()
      .setTitle('隊伍名稱')
      .setRequired(true);

  // ── 隊長資料 ──
  form.addSectionHeaderItem().setTitle('隊長資料');

  form.addTextItem()
      .setTitle('隊長姓名')
      .setRequired(true);

  var emailRegex = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';
  form.addTextItem()
      .setTitle('隊長 Email')
      .setHelpText('用於賽事通知與報名去重')
      .setRequired(true)
      .setValidation(
        FormApp.createTextValidation()
          .setHelpText('請輸入有效的 email 地址')
          .requireTextMatchesPattern(emailRegex)
          .build()
      );

  form.addTextItem()
      .setTitle('隊長 Facebook')
      .setHelpText('比賽當天聯絡用')
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle('隊長：非台灣人')
      .setHelpText('若為非台灣人請打勾（不勾即視為台灣人）')
      .setChoiceValues(['是 (Non-Taiwanese)'])
      .setRequired(false);

  // ── 球員 2-12 ──
  form.addSectionHeaderItem()
      .setTitle('球員資料 (球員 2 - 球員 ' + ROSTER_SIZE + ')')
      .setHelpText('依序填寫其餘 ' + (ROSTER_SIZE - 1) + ' 位球員姓名與國籍');

  for (var n = 2; n <= ROSTER_SIZE; n++) {
    form.addTextItem()
        .setTitle('球員 ' + n + ' 姓名')
        .setRequired(true);
    form.addCheckboxItem()
        .setTitle('球員 ' + n + ' 非台灣人')
        .setChoiceValues(['是 (Non-Taiwanese)'])
        .setRequired(false);
  }

  // ── 其他 ──
  form.addSectionHeaderItem().setTitle('其他');

  form.addMultipleChoiceItem()
      .setTitle('賽後聚餐意願')
      .setHelpText('幫主辦人提早訂位（會記錄在 Google Sheet）')
      .setChoiceValues(['全隊參加', '部分參加', '不參加'])
      .setRequired(true);

  // ── Trigger + linked sheet ──
  removeExistingFormTriggers_();
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  var ss = SpreadsheetApp.create(FORM_TITLE + ' — 回應');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  props.setProperty('RESPONSES_SHEET_ID', ss.getId());

  Logger.log('=== Captain team form created ===');
  Logger.log('Public URL: ' + form.getPublishedUrl());
  Logger.log('Short URL:  ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('Edit URL:   ' + form.getEditUrl());
  Logger.log('Sheet URL:  ' + ss.getUrl());
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
 * 拆成 12 筆 registrations 個別 POST 到 webhook。
 * 隊長帶 email 走 UPSERT 路徑；球員 2-12 沒 email 走 INSERT。
 * 每位都附 teamName / role / 國籍，server 端會存進 raw_form_payload，
 * admin 之後可以依「隊伍名稱」分組建 team。
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

  var r = e.namedValues || {};
  var teamName = pick_(r, '隊伍名稱');
  var dinner = pick_(r, '賽後聚餐意願');

  var players = [];

  // 隊長
  players.push({
    name: pick_(r, '隊長姓名'),
    email: pick_(r, '隊長 Email'),
    facebook: pick_(r, '隊長 Facebook'),
    isNonTw: hasYes_(r, '隊長：非台灣人'),
    role: '隊長'
  });

  // 球員 2 - N
  for (var n = 2; n <= ROSTER_SIZE; n++) {
    var name = pick_(r, '球員 ' + n + ' 姓名');
    if (!name) continue; // 跳過空白
    players.push({
      name: name,
      email: '',
      facebook: '',
      isNonTw: hasYes_(r, '球員 ' + n + ' 非台灣人'),
      role: '球員'
    });
  }

  // 每位球員獨立 POST。第一位失敗就 log 整批備援，避免半成功狀態。
  var failures = [];
  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    var payload = {
      tournament_id: tournamentId,
      submitted_at: new Date().toISOString(),
      responses: {
        '姓名':   [p.name],
        'Email':  [p.email],
        '電話':   [''],
        'Facebook': [p.facebook],
        '隊伍名稱': [teamName],
        '角色':     [p.role],
        '國籍':     [p.isNonTw ? '非台灣' : '台灣'],
        '賽後聚餐意願': [dinner]
      }
    };
    var ok = postWithRetry_(url, secret, payload);
    if (!ok) failures.push(p.name + ' (' + p.role + ')');
  }
  if (failures.length > 0) {
    var msg = 'Failed to register: ' + failures.join(', ');
    Logger.log(msg);
    Logger.log('team payload was: ' + JSON.stringify({
      teamName: teamName, players: players,
    }));
    logError_(
      { teamName: teamName, players: players },
      msg,
    );
  }
}

function pick_(r, key) {
  return (r[key] && r[key][0] || '').toString().trim();
}

function hasYes_(r, key) {
  var v = pick_(r, key);
  return v.indexOf('是') >= 0;
}

function postWithRetry_(url, secret, payload) {
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var lastBody = null;
  var lastCode = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      var res = UrlFetchApp.fetch(url, options);
      lastCode = res.getResponseCode();
      lastBody = res.getContentText();
      if (lastCode >= 200 && lastCode < 300) return true;
    } catch (err) {
      lastBody = String(err);
    }
    Utilities.sleep(500 * (attempt + 1));
  }
  Logger.log('webhook POST failed (HTTP ' + lastCode + '): ' + lastBody);
  return false;
}

/**
 * Manual smoke test — fake captain submission so you can verify webhook
 * connectivity without filling the real form. Should create 3 registrations
 * (1 captain + 2 players) in the Supabase table.
 */
function testOnFormSubmit() {
  var fakeEvent = {
    namedValues: {
      '隊伍名稱':         ['測試隊'],
      '隊長姓名':         ['測試隊長'],
      '隊長 Email':       ['captain+' + Date.now() + '@example.com'],
      '隊長 Facebook':    ['fb.com/captain'],
      '隊長：非台灣人':    [''],
      '球員 2 姓名':       ['球員2'],
      '球員 2 非台灣人':    ['是 (Non-Taiwanese)'],
      '球員 3 姓名':       ['球員3'],
      '球員 3 非台灣人':    [''],
      '賽後聚餐意願':     ['全隊參加']
    }
  };
  onFormSubmit(fakeEvent);
  Logger.log('testOnFormSubmit done — check Supabase `registrations` table.');
}

function logError_(payload, message) {
  try {
    var ss = getResponsesSheet_();
    if (!ss) {
      Logger.log('logError_: no spreadsheet available; see Executions log above');
      return;
    }
    var sheet = ss.getSheetByName('_errors') || ss.insertSheet('_errors');
    sheet.appendRow([new Date(), message, JSON.stringify(payload)]);
  } catch (err) {
    Logger.log('error logging failed: ' + err);
  }
}

function getResponsesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty(
    'RESPONSES_SHEET_ID',
  );
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      Logger.log('openById failed: ' + e);
    }
  }
  return null;
}
