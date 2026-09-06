/* bugfix-app · VER 4 · 16.08.2026 · webcheck · встраиваемый in-app багфикс для Tauri/webview-приложений */
/*
 * ЕДИНЫЙ in-app багфикс на все 5+ Tauri-приложений (psygames / TypeRIGHT / Гидромаш-в-цеху / fydao / grovi).
 * НЕ внешний загрузчик (в APK CSP script-src 'self' его режет + офлайн) — файл ВЕНДОРИТСЯ в приложение
 * (кладётся локально, грузится из 'self'). Пишет в ЕДИНЫЙ bug_reports + бакет bug-shots (как сайтовый
 * багфикс) → авто-задача в TeamOps. Фреймворк-агностик: чистый DOM (все наши app = webview, даже RN-Web).
 *
 * ПОДКЛЮЧЕНИЕ (vanilla, напр. TypeRIGHT):
 *   import './bugfix-app.js';            // или <script src="/bugfix-app.js">
 *   BugfixApp.init({ project: 'typefree', version: '1.203.0', enabled: __TEST_BUILD__ });
 *
 * ПОДКЛЮЧЕНИЕ (своя кнопка, headless, напр. psygames RN):
 *   BugfixApp.init({ project: 'psygames', button: false, enabled: FEEDBACK_ENABLED });
 *   // из своего FeedbackWidget: await BugfixApp.send('bug', text, contact);
 *
 * CSP приложения: connect-src должен включать https://iuvvheeocobhiothfgei.supabase.co
 * html2canvas: если global.html2canvas есть — будет скрин; нет — репорт уйдёт без скрина (не падаем).
 */
(function (global) {
  'use strict';
  if (global.BugfixApp) return;   // одна копия на приложение

  var SB_URL = 'https://iuvvheeocobhiothfgei.supabase.co';
  var SB_KEY_DEFAULT = 'sb_publishable_A2vJ5DjemTZIKrKX6XGqvQ_WaiuAkk1'; // публичный, RLS INSERT-only
  var QKEY = 'odv_bugfix_queue';
  var DKEY = 'odv_bugfix_device';
  var CFG = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function deviceId() {
    var id = lsGet(DKEY);
    if (id) return id;
    var c = global.crypto;
    id = (c && c.randomUUID) ? c.randomUUID() : ('d-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
    lsSet(DKEY, id); return id;
  }

  // Platform.OS для Tauri-APK врёт 'web' (паттерн psygames) — детект по __TAURI__ + UA.
  function detectPlatform() {
    var ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
    var tauri = !!(global.__TAURI__ || global.__TAURI_INTERNALS__);
    var mob = /Android/i.test(ua) ? 'android' : (/iPhone|iPad|iPod/i.test(ua) ? 'ios' : null);
    if (tauri) return mob ? ('tauri-' + mob) : 'tauri-desktop';
    return mob ? ('web-' + mob) : 'web';
  }

  function viewport() {
    try {
      var probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;font-size:16px';
      probe.textContent = 'M';
      document.body.appendChild(probe);
      var px = parseFloat(getComputedStyle(probe).fontSize) || 16;
      probe.remove();
      return { w: global.innerWidth, h: global.innerHeight, dpr: global.devicePixelRatio, fontScale: Math.round(px / 16 * 100) / 100 };
    } catch (e) { return null; }
  }

  // буфер ошибок консоли — контекст репорта
  // ── хлебные крошки: последние 20 экранов/действий (идея psygames 29.08 — топливо для репро) ──
  var stepBuf = [], SESSION_T0 = Date.now(), VKEY = 'odv_bugfix_lastver';
  function pushStep(type, val) {
    try {
      stepBuf.push({ t: Date.now() - SESSION_T0, type: type, v: String(val).slice(0, 80) });
      if (stepBuf.length > 20) stepBuf.shift();
    } catch (e) {}
  }
  // updated_from: с какой версии человек обновился и когда (psygames вычисляли руками по сессиям)
  function updatedFrom() {
    try {
      var cur = CFG && CFG.version || '', prev = lsGet(VKEY);
      if (cur && prev !== cur) { lsSet(VKEY, cur + '|' + Date.now()); }
      if (!prev) return null;
      var parts = prev.split('|');
      return (parts[0] && parts[0] !== cur) ? { from: parts[0], at: +parts[1] || null } : null;
    } catch (e) { return null; }
  }
  // ключ дедупликации: пять нажатий «отправить» не должны рожать пять тикетов
  function dedupKey(message, screen) {
    try {
      var raw = (message || '').trim().toLowerCase() + '|' + (screen || '') + '|' + new Date().toISOString().slice(0, 10);
      var h = 0; for (var i = 0; i < raw.length; i++) { h = ((h << 5) - h + raw.charCodeAt(i)) | 0; }
      return 'd' + (h >>> 0).toString(36);
    } catch (e) { return null; }
  }

  var errBuf = [];
  function pushErr(s) { try { errBuf.push(String(s).slice(0, 300)); if (errBuf.length > 10) errBuf.shift(); } catch (e) {} }
  try { var _ce = console.error; console.error = function () { pushErr(Array.prototype.join.call(arguments, ' ')); return _ce.apply(console, arguments); }; } catch (e) {}
  if (global.addEventListener) global.addEventListener('error', function (e) { pushErr(e && e.message || 'error'); });

  function capture() {
    return new Promise(function (res) {
      var h2c = global.html2canvas;
      if (!h2c || typeof document === 'undefined') return res(null);
      try {
        h2c(document.body, { scale: 0.6, logging: false, useCORS: true, backgroundColor: null })
          .then(function (cv) { cv.toBlob(function (b) { res(b); }, 'image/jpeg', 0.7); })
          .catch(function () { res(null); });
      } catch (e) { res(null); }
    });
  }

  function headers(ct) {
    var h = { apikey: CFG.apiKey, Authorization: 'Bearer ' + CFG.apiKey };
    if (ct) h['Content-Type'] = ct;
    return h;
  }

  function uploadShot(blob) {
    if (!blob) return Promise.resolve(null);
    var path = new Date().toISOString().slice(0, 10) + '/' + Math.random().toString(36).slice(2) + '.jpg';
    return fetch(SB_URL + '/storage/v1/object/bug-shots/' + path, { method: 'POST', headers: headers('image/jpeg'), body: blob })
      .then(function (r) { return r.ok ? path : null; }).catch(function () { return null; });
  }

  function insertReport(row) {
    return fetch(SB_URL + '/rest/v1/bug_reports', {
      method: 'POST',
      headers: Object.assign(headers('application/json'), { Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    }).then(function (r) { return r.ok; });
  }

  // голосовая заметка → приватный бакет feedback-audio (тот же, что у сайтового багфикса и app_feedback; расшифровка — работник brain)
  // замер громкости записи (приём psygames): пик ≈ −100 дБ при выданном доступе = WebView не отдаёт микрофон
  function peakDb(blob) {
    return new Promise(function (res) {
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC || !blob) return res(null);
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var ac = new AC();
            ac.decodeAudioData(fr.result, function (buf) {
              var peak = 0;
              for (var ch = 0; ch < buf.numberOfChannels; ch++) {
                var d = buf.getChannelData(ch);
                for (var i = 0; i < d.length; i += 16) { var a = Math.abs(d[i]); if (a > peak) peak = a; }
              }
              try { ac.close(); } catch (e) {}
              res(peak > 0 ? Math.round(20 * Math.log10(peak) * 10) / 10 : -100);
            }, function () { res(null); });
          } catch (e) { res(null); }
        };
        fr.onerror = function () { res(null); };
        fr.readAsArrayBuffer(blob);
      } catch (e) { res(null); }
    });
  }

  function uploadAudio(blob) {
    if (!blob) return Promise.resolve(null);
    var ext = (blob.type && blob.type.indexOf('mp4') > -1) ? 'm4a' : 'webm';
    var path = new Date().toISOString().slice(0, 10) + '/' + Math.random().toString(36).slice(2) + '.' + ext;
    return fetch(SB_URL + '/storage/v1/object/feedback-audio/' + path, { method: 'POST', headers: headers(blob.type || 'audio/webm'), body: blob })
      .then(function (r) { return r.ok ? path : null; }).catch(function () { return null; });
  }

  // офлайн-очередь (репорт без скрина — скрин привязан к сессии, в очередь кладём только строку)
  function qLoad() { try { return JSON.parse(lsGet(QKEY) || '[]'); } catch (e) { return []; } }
  function qSave(a) { lsSet(QKEY, JSON.stringify(a.slice(-50))); }
  function enqueue(row) { var a = qLoad(); a.push(row); qSave(a); }
  function flush() {
    if (!CFG) return;
    var a = qLoad(); if (!a.length) return;
    insertReport(a[0]).then(function (ok) {
      if (ok) { var b = qLoad(); b.shift(); qSave(b); if (b.length) flush(); }
    }).catch(function () {});
  }

  function buildRow(kind, message, reporter, shot_path, audio_path, audio_peak) {
    return {
      project: CFG.project,
      kind: kind || 'bug',
      message: (message || '').slice(0, 4000),
      url: ((CFG.screen ? CFG.screen() : (typeof location !== 'undefined' ? location.href : '')) || '').slice(0, 500),
      shot_path: shot_path || null,
      audio_path: audio_path || null,
      audio_peak_db: (audio_peak === undefined ? null : audio_peak),
      reporter: (reporter || '').slice(0, 200) || null,
      device_id: deviceId(),
      context: {
        title: (CFG.appName || (typeof document !== 'undefined' ? document.title : '') || '').slice(0, 200),
        platform: detectPlatform(),
        viewport: viewport(),
        consoleErrors: errBuf.slice(-10),
        appVersion: CFG.version || '',
        lang: CFG.lang || (typeof document !== 'undefined' ? (document.documentElement.getAttribute('lang') || '') : ''),
        inApp: true,
        // ── КОНТРАКТ VER 3 (согласован с psygames 29.08): два независимых канала ──
        // module() — ОБЯЗАТЕЛЬНЫЙ: редакция ЭКРАНА, а не только сборки. За одну сборку экран
        //            переписывается по нескольку раз; {id, ver} отвечает «что было в ЭТОМ упражнении».
        module: (function () { try { return CFG.module ? CFG.module() : null; } catch (e) { return null; } })(),
        // ctx() — живое состояние ОБЪЕКТОМ, не строкой. Строка теряет режим/уровень/фазу —
        //         на этом psygames потеряли час на репорте «Ур.45/8» (уровень протёк в мини-режим).
        state: (function () { try { return CFG.context ? CFG.context() : null; } catch (e) { return null; } })(),
        steps: stepBuf.slice(-20),                 // хлебные крошки
        sessionUptimeSec: Math.round((Date.now() - SESSION_T0) / 1000),
        updatedFrom: updatedFrom(),
        ua: (typeof navigator !== 'undefined' ? (navigator.userAgent || '').slice(0, 200) : ''),  // версия WebView (немой микрофон Chrome/90)
        tz: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } })(),
        net: (function () { try { var c = navigator.connection; return c ? { type: c.effectiveType, saveData: !!c.saveData } : null; } catch (e) { return null; } })(),
        dedupKey: dedupKey(message, (CFG.screen ? CFG.screen() : '')),
      },
    };
  }

  // экспорт крошек: приложение зовёт при смене экрана/действии — BugfixApp.step('screen','game:sudoku')
  function step(type, val) { pushStep(type, val); }

  // headless-отправка: приложение может вызвать со своей кнопкой/формой
  function send(kind, message, reporter) {
    return capture().then(function (blob) {
      return uploadShot(blob).then(function (shot_path) {
        var row = buildRow(kind, message, reporter, shot_path);
        return insertReport(row).then(function (ok) {
          if (!ok) { enqueue(buildRow(kind, message, reporter, null)); return false; }
          return true;
        }).catch(function () { enqueue(buildRow(kind, message, reporter, null)); return false; });
      });
    });
  }

  // ---------- минимальный UI (shadow DOM — изоляция от стилей приложения) ----------
  var host = null, sh = null;
  var T = {
    ru: { btn: 'Сообщить о баге', title: 'Что не так?', bug: 'Баг', idea: 'Идея', unclear: 'Непонятно', ph: 'Опишите, что случилось…', contact: 'Контакт для ответа (необязательно)', shot: 'Приложить скриншот', send: 'Отправить', cancel: 'Отмена', okMsg: 'Спасибо! Отчёт отправлен.', queuedMsg: 'Нет сети — отправим позже.', voice: 'Записать голосом', vredo: 'Перезаписать', vdel: 'Удалить', vmicerr: 'Нет доступа к микрофону' },
    en: { btn: 'Report a bug', title: "What's wrong?", bug: 'Bug', idea: 'Idea', unclear: 'Unclear', ph: 'Describe what happened…', contact: 'Contact for reply (optional)', shot: 'Attach screenshot', send: 'Send', cancel: 'Cancel', okMsg: 'Thanks! Report sent.', queuedMsg: 'Offline — will send later.', voice: 'Record voice', vredo: 'Re-record', vdel: 'Delete', vmicerr: 'No microphone access' },
  };
  function t() { var l = (CFG.lang || (typeof document !== 'undefined' ? document.documentElement.getAttribute('lang') : '') || 'ru').slice(0, 2).toLowerCase(); return Object.assign({}, T.en, T[l] || {}); }

  function mountFab() {
    if (host || typeof document === 'undefined') return;
    host = document.createElement('div');
    host.id = 'odv-bugfix-app-root';
    host.style.cssText = 'all:initial';
    sh = host.attachShadow({ mode: 'open' });
    var side = CFG.position === 'right' ? 'right' : 'left';
    var acc = CFG.color || '#e24b4a';
    sh.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '.fab{position:fixed;z-index:2147483200;' + side + ':14px;bottom:calc(14px + env(safe-area-inset-bottom));' +
      'display:flex;align-items:center;gap:6px;padding:9px 13px;border-radius:22px;border:none;cursor:pointer;' +
      'font:600 13px system-ui,-apple-system,sans-serif;color:#fff;background:' + acc + ';box-shadow:0 4px 14px rgba(0,0,0,.28)}' +
      '.wrap{position:fixed;inset:0;z-index:2147483201;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '.card{background:#fff;color:#1c1c1e;width:min(440px,100%);border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));font:14px system-ui,-apple-system,sans-serif}' +
      '@media(min-width:560px){.wrap{align-items:center}.card{border-radius:16px}}' +
      '.hd{font-weight:700;font-size:16px;margin:0 0 12px}' +
      '.kinds{display:flex;gap:8px;margin-bottom:10px}' +
      '.k{flex:1;padding:8px;border:1px solid #d2d2d7;border-radius:10px;background:#f5f5f7;cursor:pointer;text-align:center;font-size:13px}' +
      '.k.on{border-color:' + acc + ';background:#fff;font-weight:600;box-shadow:0 0 0 2px ' + acc + '33}' +
      'textarea,input{width:100%;box-sizing:border-box;border:1px solid #d2d2d7;border-radius:10px;padding:10px;font:14px system-ui;margin-bottom:10px}' +
      'textarea{min-height:84px;resize:vertical}' +
      '.row{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;color:#3a3a3c}' +
      '.btns{display:flex;gap:10px}' +
      '.btns button{flex:1;padding:11px;border-radius:10px;border:none;cursor:pointer;font:600 14px system-ui}' +
      '.cancel{background:#f0f0f2;color:#1c1c1e}.send{background:' + acc + ';color:#fff}' +
      '.send[disabled]{opacity:.5}' +
      '.toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:2147483202;background:#1c1c1e;color:#fff;padding:10px 16px;border-radius:22px;font:13px system-ui}' +
      '</style>' +
      '<button class="fab" id="fab">🐞 <span></span></button>';
    sh.getElementById('fab').querySelector('span').textContent = t().btn;
    sh.getElementById('fab').addEventListener('click', openForm);
    document.body.appendChild(host);
  }

  var _kind = 'bug';
  function openForm() {
    if (!sh) { // headless: подмонтируем контейнер под форму
      if (!host) { host = document.createElement('div'); host.id = 'odv-bugfix-app-root'; sh = host.attachShadow({ mode: 'open' }); document.body.appendChild(host); }
    }
    var L = t(); _kind = 'bug';
    var w = document.createElement('div'); w.className = 'wrap';
    w.innerHTML =
      '<div class="card">' +
      '<p class="hd">' + L.title + '</p>' +
      '<div class="kinds"><div class="k on" data-k="bug">🐞 ' + L.bug + '</div><div class="k" data-k="idea">💡 ' + L.idea + '</div><div class="k" data-k="unclear">🤔 ' + L.unclear + '</div></div>' +
      '<textarea id="msg" placeholder="' + L.ph + '"></textarea>' +
      '<div class="vrow" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap"><button type="button" id="vrec" style="flex:0 0 auto;padding:8px 12px;border:1px solid #d2d2d7;border-radius:10px;background:#f5f5f7;cursor:pointer;font:600 13px system-ui">🎤 ' + L.voice + '</button><span id="vinfo" style="font-size:12px;opacity:.85;display:flex;align-items:center;gap:6px"></span></div>' +
      '<input id="contact" placeholder="' + L.contact + '">' +
      '<label class="row"><input type="checkbox" id="shot" checked> ' + L.shot + '</label>' +
      '<div class="btns"><button class="cancel" id="cancel">' + L.cancel + '</button><button class="send" id="send">' + L.send + '</button></div>' +
      '</div>';
    // если fab-стилей нет (headless), добавим стили формы
    if (!sh.querySelector('style')) {
      var st = document.createElement('style');
      st.textContent = '.wrap{position:fixed;inset:0;z-index:2147483201;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:14px system-ui}.card{background:#fff;color:#1c1c1e;width:min(440px,92%);border-radius:16px;padding:16px}.hd{font-weight:700;font-size:16px;margin:0 0 12px}.kinds{display:flex;gap:8px;margin-bottom:10px}.k{flex:1;padding:8px;border:1px solid #d2d2d7;border-radius:10px;background:#f5f5f7;cursor:pointer;text-align:center}.k.on{border-color:#e24b4a;background:#fff;font-weight:600}textarea,input{width:100%;box-sizing:border-box;border:1px solid #d2d2d7;border-radius:10px;padding:10px;margin-bottom:10px;font:14px system-ui}textarea{min-height:84px}.row{display:flex;gap:8px;margin-bottom:12px}.btns{display:flex;gap:10px}.btns button{flex:1;padding:11px;border-radius:10px;border:none;cursor:pointer;font:600 14px system-ui}.cancel{background:#f0f0f2}.send{background:#e24b4a;color:#fff}';
      sh.appendChild(st);
    }
    sh.appendChild(w);
    var sendBtn = w.querySelector('#send');
    w.querySelectorAll('.k').forEach(function (el) { el.addEventListener('click', function () { w.querySelectorAll('.k').forEach(function (x) { x.classList.remove('on'); }); el.classList.add('on'); _kind = el.getAttribute('data-k'); }); });
    w.querySelector('#cancel').addEventListener('click', function () { w.remove(); });
    w.addEventListener('click', function (e) { if (e.target === w) w.remove(); });
    // голосовая заметка (аудио → feedback-audio → bug_reports.audio_path; расшифровка — работник brain)
    var audioBlob = null, mediaRec = null, chunks = [], vt = null, vurl = null;
    var vrec = w.querySelector('#vrec'), vinfo = w.querySelector('#vinfo');
    function vreset() { if (vurl) { try { URL.revokeObjectURL(vurl); } catch (e) {} vurl = null; } audioBlob = null; vinfo.textContent = ''; vrec.textContent = '🎤 ' + L.voice; }
    function vstop() { if (mediaRec && mediaRec.state === 'recording') { try { mediaRec.stop(); } catch (e) {} } }
    vrec.addEventListener('click', function () {
      if (mediaRec && mediaRec.state === 'recording') { vstop(); return; }
      if (audioBlob) { vreset(); }
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) { vinfo.textContent = L.vmicerr; return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        chunks = [];
        var mime = (window.MediaRecorder && MediaRecorder.isTypeSupported) ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '')) : '';
        try { mediaRec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch (e) { mediaRec = new MediaRecorder(stream); }
        mediaRec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        mediaRec.onstop = function () {
          try { stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) {}
          clearInterval(vt);
          audioBlob = new Blob(chunks, { type: (mediaRec.mimeType || 'audio/webm') });
          vurl = URL.createObjectURL(audioBlob);
          vinfo.innerHTML = '<audio controls src="' + vurl + '" style="height:30px;max-width:150px"></audio> <button type="button" id="vdel" style="background:none;border:0;cursor:pointer;font-size:15px;opacity:.7">✕</button>';
          vrec.textContent = '🎤 ' + L.vredo;
          var vd = w.querySelector('#vdel'); if (vd) vd.addEventListener('click', vreset);
        };
        var t0 = Date.now(); mediaRec.start(); vrec.textContent = '⏹';
        vt = setInterval(function () { var s = Math.round((Date.now() - t0) / 1000); vrec.textContent = '⏹ ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); if (s >= 90) vstop(); }, 250);
      }).catch(function () { vinfo.textContent = L.vmicerr; });
    });

    sendBtn.addEventListener('click', function () {
      var msg = w.querySelector('#msg').value.trim();
      if (!msg && !audioBlob) { w.querySelector('#msg').style.borderColor = '#e24b4a'; return; }
      var contact = w.querySelector('#contact').value.trim();
      var withShot = w.querySelector('#shot').checked;
      vstop();
      sendBtn.disabled = true; sendBtn.textContent = '…';
      Promise.all([withShot ? capture() : Promise.resolve(null), Promise.resolve(audioBlob)]).then(function (a) {
        return Promise.all([uploadShot(a[0]), uploadAudio(a[1]), peakDb(a[1])]);
      }).then(function (p) {
        var row = buildRow(_kind, msg, contact, p[0], p[1], p[2]);
        return insertReport(row).then(function (ok) { if (!ok) { enqueue(buildRow(_kind, msg, contact, null, null)); return false; } return true; }).catch(function () { enqueue(buildRow(_kind, msg, contact, null, null)); return false; });
      }).then(function (ok) { w.remove(); toast(ok ? L.okMsg : L.queuedMsg); });
    });
  }
  function sendNoShot(k, m, c) {
    var row = buildRow(k, m, c, null);
    return insertReport(row).then(function (ok) { if (!ok) enqueue(row); return ok; }).catch(function () { enqueue(row); return false; });
  }
  function toast(txt) {
    if (!sh) return;
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = txt; sh.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (e) {} }, 3200);
  }

  var API = {
    init: function (cfg) {
      CFG = Object.assign({ apiKey: SB_KEY_DEFAULT, enabled: true, position: 'left' }, cfg || {});
      if (!CFG.project) { try { console.warn('[bugfix-app] project обязателен'); } catch (e) {} return API; }
      flush();
      if (global.addEventListener) global.addEventListener('online', flush);
      if (CFG.enabled && CFG.button !== false) mountFab();
      return API;
    },
    open: function () { if (CFG) openForm(); },      // открыть форму программно
    send: send,                                       // headless-сабмит (своя UI)
    flush: flush,
    step: step,                                       // крошки: BugfixApp.step('screen','game:sudoku') при смене экрана
    version: 4,
  };
  global.BugfixApp = API;
})(typeof window !== 'undefined' ? window : this);
