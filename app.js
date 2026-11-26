/* 초간단 AI 단톡방 — app.js
   열쇠(?room=...&k=...)가 없으면 아무것도 열리지 않아요. */
(function () {
  'use strict';

  /* 콘솔 오류를 모아 두면 문제 생겼을 때 확인하기 쉬워요 */
  window.__aigcErrors = [];
  window.addEventListener('error', function (e) {
    try { window.__aigcErrors.push(String(e.message) + ' @' + (e.filename || '') + ':' + (e.lineno || 0)); } catch (_) { }
  });

  /* ---------- 기본 정보 ---------- */
  var AI_ORDER = ['gemini', 'openai', 'claude'];
  var AI_INFO = {
    gemini: { label: 'Google Gemini', c1: '#4285F4', c2: '#1B6FE0', keyUrl: 'https://aistudio.google.com/apikey', keySite: 'Google AI Studio' },
    openai: { label: 'OpenAI ChatGPT', c1: '#10A37F', c2: '#0B7A60', keyUrl: 'https://platform.openai.com/api-keys', keySite: 'OpenAI' },
    claude: { label: 'Anthropic Claude', c1: '#D97757', c2: '#B0573A', keyUrl: 'https://console.anthropic.com/settings/keys', keySite: 'Anthropic' }
  };
  var DEFAULTS = {
    gemini: { name: '제미나이', on: true, persona: '', role: '블로그 원고 담당' },
    openai: { name: '지피티', on: false, persona: '', role: '스레드 카피·아이디어 담당' },
    claude: { name: '클로드', on: false, persona: '', role: '최종 검수·실행 담당' }
  };
  var ROLE_PRESETS = [
    '블로그 원고 담당',
    '스레드 카피·아이디어 담당',
    '최종 검수·실행 담당',
    '기획·아이디어 담당',
    '요리·레시피 담당',
    '여행 코스 담당',
    '돈벌이 아이디어 담당',
    '자료 조사 담당'
  ];
  var USER_NAME = '제훈';
  var KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
  var ROOM_RE = /^[A-Za-z0-9_-]{4,48}$/;

  /* ---------- 요소 ---------- */
  var $ = function (s) { return document.querySelector(s); };
  var lockEl = $('#lock');
  var appEl = $('#app');
  var lockMsgEl = $('#lockMsg');
  var joinInput = $('#joinInput');
  var chatEl = $('#chat');
  var inputEl = $('#input');
  var sendBtn = $('#sendBtn');
  var chipsEl = $('#chips');
  var badgesEl = $('#aiBadges');
  var roomInput = $('#roomName');
  var toastEl = $('#toast');
  var modal = $('#modal');
  var aiCardsEl = $('#aiCards');
  var dbStatusEl = $('#dbStatus');

  /* ---------- 상태 ---------- */
  var settings = null;
  var messages = [];
  var roomId = '';
  var roomKey = '';
  var ns = '';
  var pending = [];
  var pollTimer = null;
  var toastTimer = null;
  var pullBusy = false;
  var dbState = '';

  /* ---------- 작은 도구들 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function randId(n) {
    var chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    var out = '';
    var buf = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < n; i++) out += chars[buf[i] % chars.length];
    return out;
  }
  function randKey(n) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    var out = '';
    var buf = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < n; i++) out += chars[buf[i] % chars.length];
    return out;
  }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function read(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function nameOf(who) {
    if (who === 'me') return USER_NAME;
    if (settings && settings.ais[who]) return settings.ais[who].name;
    return 'AI';
  }
  function roleOf(id) {
    return settings && settings.ais[id] ? String(settings.ais[id].role || '').trim() : '';
  }
  function shortRole(role) {
    var r = String(role || '').trim();
    if (r.slice(-2) === '담당') r = r.slice(0, -2).trim();
    return r;
  }
  function fmtTime(ts) {
    var d = new Date(ts || Date.now());
    var h = d.getHours();
    var ap = h < 12 ? '오전' : '오후';
    h = h % 12 || 12;
    return ap + ' ' + h + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function dayLabel(ts) {
    var d = new Date(ts);
    var w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + w + '요일';
  }
  function sig(m) { return m.who + '|' + m.ts + '|' + m.text; }
  function isHttpUrl(v) {
    var s = String(v || '').toLowerCase();
    return s.indexOf('http://') === 0 || s.indexOf('https://') === 0;
  }
  function stripSlash(v) {
    var s = String(v || '');
    while (s.slice(-1) === '/') s = s.slice(0, -1);
    return s;
  }

  /* ---------- 잠금 / 열쇠 ---------- */
  function readCreds() {
    var u = new URL(location.href);
    var h = new URLSearchParams(u.hash.replace(/^#/, ''));
    var room = (u.searchParams.get('room') || '').trim();
    var k = (u.searchParams.get('k') || h.get('k') || '').trim();
    var db = (u.searchParams.get('db') || h.get('db') || '').trim();
    return { room: room, k: k, db: db, ok: ROOM_RE.test(room) && KEY_RE.test(k) };
  }

  function showLock(reason) {
    lockEl.hidden = false;
    appEl.hidden = true;
    if (reason) setLockMsg(reason);
    document.title = '🔒 입장 키가 필요해요 · 초간단 AI 단톡방';
    try { joinInput.focus({ preventScroll: true }); } catch (e) { }
  }
  function setLockMsg(text) {
    lockMsgEl.textContent = text || '';
    lockMsgEl.classList.toggle('show', !!text);
  }

  function goToRoom(room, k, db) {
    var u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('room', room);
    u.searchParams.set('k', k);
    if (db) u.hash = 'db=' + encodeURIComponent(db);
    location.replace(u.toString());
  }

  function createRoom() {
    goToRoom(randId(8), randKey(28));
  }

  function joinFrom(text) {
    var t = String(text || '').trim();
    if (!t) return setLockMsg('초대 링크를 붙여넣어 주세요.');
    var room = '', k = '', db = '';

    if (isHttpUrl(t) || t.indexOf('room=') > -1) {
      var queryPart = '', hashPart = '';
      if (isHttpUrl(t)) {
        try {
          var u = new URL(t);
          var hq = new URLSearchParams(u.hash.replace(/^#/, ''));
          room = u.searchParams.get('room') || '';
          k = u.searchParams.get('k') || hq.get('k') || '';
          db = u.searchParams.get('db') || hq.get('db') || '';
        } catch (e) { }
      }
      if (!room) {
        var clean = t.replace(/^[?#]/, '');
        var idx = clean.indexOf('#');
        hashPart = idx > -1 ? clean.slice(idx + 1) : '';
        queryPart = idx > -1 ? clean.slice(0, idx) : clean;
        var q = new URLSearchParams(queryPart);
        var hq2 = new URLSearchParams(hashPart);
        room = q.get('room') || '';
        k = q.get('k') || hq2.get('k') || k || '';
        db = q.get('db') || hq2.get('db') || db || '';
      }
    } else if (KEY_RE.test(t)) {
      var curRoom = new URL(location.href).searchParams.get('room') || '';
      if (!curRoom) return setLockMsg('방 주소까지 같이 붙여넣어 주세요. 초대 링크 전체를 붙여넣으면 돼요.');
      room = curRoom;
      k = t;
    }

    room = String(room).trim();
    k = String(k).trim();
    if (!room || !k) return setLockMsg('링크를 읽지 못했어요. 초대 링크 전체를 그대로 붙여넣어 주세요.');
    if (!ROOM_RE.test(room) || !KEY_RE.test(k)) return setLockMsg('열쇠가 짧거나 모양이 달라요. 초대 링크를 다시 확인해 주세요.');
    goToRoom(room, k, isHttpUrl(db) ? stripSlash(db) : '');
  }

  /* ---------- 설정 / 대화 저장 ---------- */
  function settingsKey() { return ns + '.settings'; }
  function messagesKey() { return ns + '.messages'; }
  function dbPath() { return 'rooms/' + encodeURIComponent(roomId + '_' + roomKey) + '/messages.json'; }

  function loadSettings() {
    var saved = read(settingsKey()) || {};
    var s = {
      roomName: saved.roomName || '우리들 단톡방',
      dbUrl: saved.dbUrl || '',
      clearedAt: saved.clearedAt || 0,
      ais: {}
    };
    AI_ORDER.forEach(function (id) {
      var a = (saved.ais && saved.ais[id]) || {};
      s.ais[id] = {
        name: a.name || DEFAULTS[id].name,
        key: a.key || '',
        persona: a.persona || '',
        role: typeof a.role === 'string' ? a.role : DEFAULTS[id].role,
        on: typeof a.on === 'boolean' ? a.on : DEFAULTS[id].on
      };
    });
    return s;
  }
  function saveSettings() { store(settingsKey(), settings); }

  function loadMessages() {
    var list = read(messagesKey());
    return Array.isArray(list) ? list : [];
  }
  function saveMessages() {
    store(messagesKey(), messages.filter(function (m) { return !m.err; }));
  }

  /* ---------- 화면 ---------- */
  function render() {
    var near = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 160;
    renderBadges();
    renderChips();
    renderChat();
    if (near) chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderBadges() {
    var on = AI_ORDER.filter(function (id) { return settings.ais[id].on; });
    var html = '<span class="badge badge-lock">🔒 비밀 방</span>';
    if (!on.length) {
      html += '<span class="badge badge-off">AI 모두 꺼짐</span>';
    } else {
      html += on.map(function (id) {
        var info = AI_INFO[id];
        var role = roleOf(id);
        return '<span class="badge" style="--c1:' + info.c1 + ';--c2:' + info.c2 + '" title="' + esc(role || '역할 없음') + '"><i></i>' + esc(settings.ais[id].name) +
          (role ? '<em>· ' + esc(shortRole(role)) + '</em>' : '') + '</span>';
      }).join('');
    }
    badgesEl.innerHTML = html;
  }

  function renderChips() {
    var on = AI_ORDER.filter(function (id) { return settings.ais[id].on; });
    var html = '<button class="chip chip-all" type="button" data-mention="__all">전체 (각자 역할대로)</button>';
    html += on.map(function (id) {
      return '<button class="chip" type="button" data-mention="' + esc(settings.ais[id].name) + '" style="--c1:' + AI_INFO[id].c1 + '">@' + esc(settings.ais[id].name) + '</button>';
    }).join('');
    chipsEl.innerHTML = html;
  }

  function welcomeHTML() {
    return '<div class="welcome">' +
      '<div class="welcome-emoji">💬</div>' +
      '<h3>여기가 우리 단톡방이에요</h3>' +
      '<ol>' +
      '<li>오른쪽 위 <b>⚙️</b>를 눌러 AI 열쇠(API 키)를 넣어 주세요.</li>' +
      '<li>AI마다 <b>담당 역할</b>을 정해 두면, <b>전체</b>에게 말할 때 각자 맡은 일만 해요.</li>' +
      '<li>아래에 하고 싶은 말을 쓰고 <b>전송</b>을 누르면 AI들이 차례로 답해요.</li>' +
      '<li><b>🔗</b>를 누르면 이 방의 비밀 링크가 복사돼요. 나만 쓰려면 아무한테도 보내지 않으면 돼요.</li>' +
      '</ol>' +
      '<button class="primary-btn sm" type="button" data-open-settings>AI 열쇠 넣으러 가기</button>' +
      '</div>';
  }

  function renderChat() {
    var list = messages.filter(function (m) { return (m.ts || 0) > (settings.clearedAt || 0); });
    if (!list.length && !pending.length) { chatEl.innerHTML = welcomeHTML(); return; }

    var html = '';
    var lastDay = '';
    list.forEach(function (m) {
      var d = dayKey(m.ts);
      if (d !== lastDay) { html += '<div class="day"><span>' + esc(dayLabel(m.ts)) + '</span></div>'; lastDay = d; }
      if (m.who === 'me') html += meHTML(m);
      else if (m.who === 'system') html += sysHTML(m);
      else html += aiHTML(m);
    });
    pending.forEach(function (id) { html += typingHTML(id); });
    chatEl.innerHTML = html;
  }

  function meHTML(m) {
    return '<div class="msg me">' +
      '<div class="stamp">' + fmtTime(m.ts) + '</div>' +
      '<div class="bubble">' + esc(m.text) + '</div>' +
      '</div>';
  }
  function sysHTML(m) {
    return '<div class="sys">' + esc(m.text) + '</div>';
  }
  function aiHTML(m) {
    var info = AI_INFO[m.who] || { c1: '#888888', c2: '#666666' };
    var name = nameOf(m.who);
    return '<div class="msg ai" style="--c1:' + info.c1 + ';--c2:' + info.c2 + '">' +
      '<div class="avatar">' + esc(String(name).charAt(0) || 'A') + '</div>' +
      '<div class="msg-body">' +
      '<div class="who">' + esc(name) + (roleOf(m.who) ? '<em>· ' + esc(roleOf(m.who)) + '</em>' : '') + '</div>' +
      '<div class="row"><div class="bubble' + (m.err ? ' bubble-err' : '') + '">' + esc(m.text) + '</div>' +
      '<div class="stamp">' + fmtTime(m.ts) + '</div></div>' +
      '</div></div>';
  }
  function typingHTML(id) {
    var info = AI_INFO[id] || { c1: '#888888', c2: '#666666' };
    var name = nameOf(id);
    return '<div class="msg ai" style="--c1:' + info.c1 + ';--c2:' + info.c2 + '">' +
      '<div class="avatar">' + esc(String(name).charAt(0) || 'A') + '</div>' +
      '<div class="msg-body">' +
      '<div class="who">' + esc(name) + (roleOf(id) ? '<em>· ' + esc(roleOf(id)) + '</em>' : '') + '</div>' +
      '<div class="row"><div class="bubble typing"><span>생각 중</span><i></i><i></i><i></i></div></div>' +
      '</div></div>';
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  /* ---------- 메시지 ---------- */
  function pushMessage(m) {
    m.ts = m.ts || Date.now();
    messages.push(m);
    if (!m.err) {
      saveMessages();
      if (m.who !== 'system') pushToDb(m);
    }
    return m;
  }

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    autoGrow();
    pushMessage({ who: 'me', text: text });
    var ids = pickTargets(text);
    if (!ids.length) {
      var offNamed = namedIds(text).filter(function (id) { return !settings.ais[id].on; });
      var msg = offNamed.length
        ? '불러준 ' + offNamed.map(function (id) { return settings.ais[id].name; }).join(', ') + '가 지금 꺼져 있어요. ⚙️에서 켜 주세요!'
        : '지금은 AI 친구가 모두 꺼져 있어요. 오른쪽 위 ⚙️에서 켜 주세요!';
      pushMessage({ who: 'system', text: msg });
      render();
      return;
    }
    render();
    runResponses(ids);
  }

  /* 켜 둔 AI들이 앞사람 답변을 보고 이어서 자기 역할만 하도록 한 명씩 물어봐요 */
  function runResponses(ids) {
    var i = 0;
    function next() {
      if (i >= ids.length) return;
      var id = ids[i++];
      respond(id, function () { setTimeout(next, 220); });
    }
    next();
  }

  function namedIds(text) {
    return AI_ORDER.filter(function (id) {
      var nm = settings.ais[id].name;
      return nm && text.indexOf('@' + nm) > -1;
    });
  }

  /* 본문에 @이름 을 직접 썼거나 칩으로 넣었을 때 → 그 AI만 부름 */
  function pickTargets(text) {
    var on = AI_ORDER.filter(function (id) { return settings.ais[id].on; });
    if (text.indexOf('@전체') > -1 || text.indexOf('@모두') > -1 || text.indexOf('@다들') > -1) return on;
    var named = namedIds(text);
    if (named.length) {
      return named.filter(function (id) { return settings.ais[id].on; });
    }
    return on;
  }

  function respond(id, done) {
    if (pending.indexOf(id) < 0) pending.push(id);
    render();
    askAI(id).then(function (text) {
      removePending(id);
      pushMessage({ who: id, text: text });
      render();
      if (done) done();
    }).catch(function (err) {
      removePending(id);
      pushMessage({ who: id, text: friendlyError(id, err), err: true });
      render();
      if (done) done();
    });
  }

  function removePending(id) {
    var i = pending.indexOf(id);
    if (i > -1) pending.splice(i, 1);
  }

  function friendlyError(id, err) {
    var name = nameOf(id);
    var code = err && err.code;
    if (code === 'NO_KEY') return name + ' 열쇠(API 키)가 아직 없어요. ⚙️ 설정에서 넣어 주면 ' + (roleOf(id) || '단톡방 친구') + ' 일을 맡을게요!';
    if (code === 'NETWORK') return name + '랑 연결이 안 됐어요. 인터넷이 되는지 한 번 확인해 주세요!';
    if (code === 'EMPTY') return name + '가 오늘은 말이 없네요ㅎㅎ 한 번 더 말 걸어 봐 주세요.';
    var st = err && err.status;
    if (st === 401 || st === 403) return name + '가 열쇠를 거절했어요. 열쇠가 맞는지 ⚙️ 설정에서 확인해 주세요!';
    if (st === 429) return name + '가 잠깐 숨을 고르고 있어요. 1분 뒤에 다시 말 걸어 주세요!';
    if (st === 404) return name + '가 그 모델을 못 찾았어요. 잠시 뒤 다시 해 봐 주세요.';
    if (st >= 500) return name + ' 쪽에 잠깐 문제가 생겼어요. 조금 뒤에 다시 해 봐 주세요.';
    var detail = '';
    try { detail = String((err.data && err.data.error && err.data.error.message) || '').toLowerCase(); } catch (e) { }
    if (st === 400 && (detail.indexOf('api key') > -1 || detail.indexOf('api_key') > -1 || detail.indexOf('invalid_argument') > -1)) {
      return name + ' 열쇠(API 키)가 잘못된 것 같아요. ⚙️ 설정에서 다시 확인해 주세요!';
    }
    if (st === 400) return name + '가 요청을 이해하지 못했어요. 잠시 뒤 다시 해 봐 주세요.';
    return name + '가 대답을 못 했어요. 잠시 뒤 다시 해 봐 주세요.';
  }

  /* ---------- AI에게 묻기 ---------- */
  function systemPrompt(id) {
    var ai = settings.ais[id];
    var persona = (ai.persona || '').trim();
    var mine = roleOf(id) || '정해진 역할 없이 단톡방 친구처럼 돕기';
    var lines = [];
    lines.push('당신은 ' + ai.name + '입니다. 이 단톡방에서 당신의 담당 역할은 [' + mine + ']입니다.');
    if (persona) lines.push('말투와 성격: ' + persona);
    lines.push('');
    lines.push('이 방의 멤버와 역할:');
    lines.push('- ' + USER_NAME + ' (지시하는 사람, 사장님)');
    lines.push('- ' + ai.name + ' (당신): ' + mine);
    AI_ORDER.forEach(function (other) {
      if (other === id) return;
      if (!settings.ais[other].on) return;
      lines.push('- ' + settings.ais[other].name + ': ' + (roleOf(other) || '정해진 역할 없음'));
    });
    lines.push('');
    lines.push('지켜야 할 것:');
    lines.push('1. 답할 때는 자기 담당 역할의 일을 실제 결과물로 내놓으세요. (원고면 원고, 검수면 고칠 점과 고친 결과)');
    lines.push('2. 다른 AI의 담당 영역은 대신 하지 말고, 필요하면 그 AI에게 넘기세요. 예: "이건 클로드가 검수하면 좋겠어요."');
    lines.push('3. 앞에 다른 AI가 이미 답했다면 그 내용을 이어받아, 겹치는 말은 빼고 내 역할에서 보탤 것만 말하세요.');
    lines.push('4. 카카오톡 단톡방처럼 짧고 편한 반말로, 보통 2~6문장. 길게 설명하지 마세요.');
    lines.push('5. 모르면 모른다고 말하고, 없는 내용을 지어내지 마세요.');
    return lines.join(String.fromCharCode(10));
  }

  function buildHistory(selfId) {
    var slice = messages.filter(function (m) { return !m.err && m.who !== 'system'; }).slice(-24);
    var out = [];
    slice.forEach(function (m) {
      var role, text;
      if (m.who === 'me') { role = 'user'; text = m.text; }
      else if (m.who === selfId) { role = 'assistant'; text = m.text; }
      else if (AI_INFO[m.who]) { role = 'user'; text = '[' + nameOf(m.who) + '] ' + m.text; }
      else return;
      var last = out[out.length - 1];
      if (last && last.role === role) last.text += String.fromCharCode(10) + text;
      else out.push({ role: role, text: text });
    });
    if (!out.length || out[0].role !== 'user') out.unshift({ role: 'user', text: '(단톡방에 들어왔어요)' });
    return out;
  }

  function toGemini(hist) {
    return hist.map(function (h) {
      return { role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] };
    });
  }

  function callJson(url, opts) {
    return fetch(url, opts).then(function (res) {
      return res.text().then(function (raw) {
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (e) { }
        if (!res.ok) {
          var err = { code: 'HTTP', status: res.status, data: data };
          throw err;
        }
        return data;
      });
    }, function () { throw { code: 'NETWORK' }; });
  }

  function askAI(id) {
    var ai = settings.ais[id];
    var key = (ai.key || '').trim();
    if (!key) return Promise.reject({ code: 'NO_KEY' });
    var hist = buildHistory(id);

    if (id === 'gemini') {
      var gBody = {
        systemInstruction: { parts: [{ text: systemPrompt(id) }] },
        contents: toGemini(hist),
        generationConfig: { temperature: 0.9, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } }
      };
      return callJson('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gBody)
      }).then(function (data) {
        var cand = data && data.candidates && data.candidates[0];
        var parts = (cand && cand.content && cand.content.parts) || [];
        var text = parts.map(function (p) { return p.text || ''; }).join('').trim();
        if (!text) throw { code: 'EMPTY' };
        return text;
      });
    }

    if (id === 'openai') {
      var oBody = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt(id) }].concat(hist.map(function (h) {
          return { role: h.role, content: h.text };
        })),
        max_tokens: 600,
        temperature: 0.9
      };
      return callJson('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify(oBody)
      }).then(function (data) {
        var ch = data && data.choices && data.choices[0];
        var text = ch && ch.message && ch.message.content;
        if (!text) throw { code: 'EMPTY' };
        return String(text).trim();
      });
    }

    var cBody = {
      model: 'claude-3-5-haiku-latest',
      max_tokens: 600,
      system: systemPrompt(id),
      messages: hist.map(function (h) { return { role: h.role, content: h.text }; })
    };
    return callJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(cBody)
    }).then(function (data) {
      var text = ((data && data.content) || []).map(function (b) { return b.text || ''; }).join('').trim();
      if (!text) throw { code: 'EMPTY' };
      return text;
    });
  }

  /* ---------- 공용 공책 (선택) ---------- */
  function dbBase() { return stripSlash(settings.dbUrl); }

  function pushToDb(m) {
    var base = dbBase();
    if (!base) return;
    fetch(base + '/' + dbPath(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ who: m.who, name: nameOf(m.who), text: m.text, ts: m.ts })
    }).catch(function () { });
  }

  function pull(silent) {
    var base = dbBase();
    if (!base || pullBusy) return;
    pullBusy = true;
    fetch(base + '/' + dbPath()).then(function (res) {
      if (!res.ok) throw new Error('bad');
      return res.json();
    }).then(function (data) {
      dbState = 'ok';
      renderDbStatus();
      if (!data || typeof data !== 'object') return;
      var known = {};
      messages.forEach(function (m) { known[sig(m)] = true; });
      var added = 0;
      Object.keys(data).forEach(function (key) {
        var x = data[key];
        if (!x || typeof x.text !== 'string' || !x.who || typeof x.ts !== 'number') return;
        if (x.ts <= (settings.clearedAt || 0)) return;
        var s = sig({ who: x.who, ts: x.ts, text: x.text });
        if (known[s]) return;
        known[s] = true;
        messages.push({ who: x.who, text: x.text, ts: x.ts });
        added++;
      });
      if (added) {
        messages.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
        saveMessages();
        render();
      }
    }).catch(function () {
      dbState = 'bad';
      renderDbStatus();
      if (!silent) toast('공용 공책 연결을 확인해 주세요.');
    }).then(function () { pullBusy = false; });
  }

  function startPoll() {
    stopPoll();
    if (!dbBase()) return;
    pollTimer = setInterval(function () { pull(true); }, 3000);
  }
  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  function restartSync() {
    stopPoll();
    if (dbBase()) { pull(true); startPoll(); } else { dbState = ''; renderDbStatus(); }
  }

  function renderDbStatus() {
    if (!dbStatusEl) return;
    if (!dbBase()) { dbStatusEl.textContent = ''; dbStatusEl.className = 'db-status'; return; }
    if (dbState === 'ok') { dbStatusEl.textContent = '✓ 공용 공책에 연결됐어요 (3초마다 새 대화를 확인해요)'; dbStatusEl.className = 'db-status ok'; }
    else if (dbState === 'bad') { dbStatusEl.textContent = '연결이 안 돼요. 주소와 규칙(rules)을 확인해 주세요.'; dbStatusEl.className = 'db-status bad'; }
    else { dbStatusEl.textContent = '확인 중…'; dbStatusEl.className = 'db-status'; }
  }

  /* ---------- 초대 링크 ---------- */
  function inviteUrl() {
    var u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('room', roomId);
    u.searchParams.set('k', roomKey);
    if (settings.dbUrl) u.hash = 'db=' + encodeURIComponent(settings.dbUrl);
    return u.toString();
  }

  function copyInvite() {
    var url = inviteUrl();
    function done(ok) {
      toast(ok ? '비밀 초대 링크를 복사했어요! 🔗' : '복사가 안 됐어요. 주소창의 주소를 복사해 주세요.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done(true); }, function () { legacyCopy(url, done); });
    } else {
      legacyCopy(url, done);
    }
  }
  function legacyCopy(url, done) {
    var ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
    done(ok);
  }

  /* 주소창에 방·열쇠를 항상 남겨 둬요 (해시로 들어와도 정리됨) */
  function updateHash() {
    var u = new URL(location.href);
    u.searchParams.set('room', roomId);
    u.searchParams.set('k', roomKey);
    u.hash = settings.dbUrl ? 'db=' + encodeURIComponent(settings.dbUrl) : '';
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  /* ---------- 설정 창 ---------- */
  function openSettings() {
    $('#setRoomName').value = settings.roomName;
    $('#setDbUrl').value = settings.dbUrl;
    renderAiCards();
    renderRoleSummary(readCards());
    renderDbStatus();
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }
  function closeSettings() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function renderAiCards() {
    aiCardsEl.innerHTML = AI_ORDER.map(function (id) {
      var a = settings.ais[id];
      var info = AI_INFO[id];
      return '<div class="ai-card' + (a.on ? ' on' : '') + '" data-ai="' + id + '" style="--c1:' + info.c1 + ';--c2:' + info.c2 + '">' +
        '<div class="ai-card-head">' +
        '<div class="avatar">' + esc(String(a.name).charAt(0) || 'A') + '</div>' +
        '<div class="ai-card-title">' +
        '<input class="ai-name" data-f="name" value="' + esc(a.name) + '" maxlength="10" aria-label="AI 이름">' +
        '<div class="ai-kind">' + esc(info.label) + '</div>' +
        '</div>' +
        '<label class="switch" title="켜기 / 끄기">' +
        '<input type="checkbox" data-f="on"' + (a.on ? ' checked' : '') + ' aria-label="' + esc(a.name) + ' 켜기">' +
        '<span class="slider"></span>' +
        '</label>' +
        '</div>' +
        '<label class="field">' +
        '<span class="field-label">담당 역할</span>' +
        '<input class="ai-role" data-f="role" value="' + esc(a.role) + '" maxlength="30" placeholder="예: 블로그 원고 담당">' +
        '</label>' +
        '<div class="role-chips">' + ROLE_PRESETS.map(function (r) {
          return '<button type="button" class="role-chip' + (a.role === r ? ' active' : '') + '" data-role="' + esc(r) + '">' + esc(shortRole(r)) + '</button>';
        }).join('') + '</div>' +
        '<div class="field">' +
        '<span class="field-label">AI 열쇠 (API 키)</span>' +
        '<div class="key-row">' +
        '<input class="ai-key" data-f="key" type="password" aria-label="' + esc(a.name) + ' API 키" value="' + esc(a.key) + '" placeholder="열쇠를 붙여 넣으세요" autocomplete="off" spellcheck="false">' +
        '<button type="button" class="ghost-btn sm" data-reveal>보기</button>' +
        '</div>' +
        '</div>' +
        '<label class="field">' +
        '<span class="field-label">성격 한 줄 (선택)</span>' +
        '<input class="ai-persona" data-f="persona" value="' + esc(a.persona) + '" maxlength="80" placeholder="예: 다정한 요리 선생님">' +
        '</label>' +
        '<div class="ai-foot">열쇠 받는 곳: <a href="' + info.keyUrl + '" target="_blank" rel="noopener">' + esc(info.keySite) + '</a></div>' +
        '</div>';
    }).join('');
  }

  function readCards() {
    var out = {};
    AI_ORDER.forEach(function (id) {
      var card = aiCardsEl.querySelector('.ai-card[data-ai="' + id + '"]');
      if (!card) return;
      out[id] = {
        name: (card.querySelector('[data-f="name"]').value.trim() || DEFAULTS[id].name).slice(0, 10),
        role: card.querySelector('[data-f="role"]').value.trim(),
        on: card.querySelector('[data-f="on"]').checked
      };
    });
    return out;
  }

  function renderRoleSummary(ais) {
    var el = $('#roleSummary');
    if (!el) return;
    ais = ais || readCards();
    var rows = ['<div class="role-row me"><span class="dot" style="--c1:#191919;--c2:#191919"></span><b>' + esc(USER_NAME) + '</b><span class="role-text">시키는 사람 (사장님)</span></div>'];
    AI_ORDER.forEach(function (id) {
      var a = ais[id];
      if (!a) return;
      var info = AI_INFO[id];
      rows.push('<div class="role-row' + (a.on ? '' : ' off') + '" style="--c1:' + info.c1 + ';--c2:' + info.c2 + '">' +
        '<span class="dot"></span><b>' + esc(a.name) + '</b>' +
        '<span class="role-text">' + esc(a.role || '역할이 아직 없어요') + '</span>' +
        (a.on ? '' : '<span class="role-off">꺼짐</span>') +
        '</div>');
    });
    var onCount = AI_ORDER.filter(function (id) { return ais[id] && ais[id].on; }).length;
    el.innerHTML = rows.join('') +
      '<p class="role-note">' + (onCount > 1
        ? '‘전체 (각자 역할대로)’에게 말하면 위에서부터 한 명씩, 앞사람 답변을 보고 자기 역할만 해요.'
        : 'AI를 두 명 이상 켜면 역할을 나눠서 이어서 일해요.') + '</p>';
  }

  function saveSettingsFromModal() {
    settings.roomName = ($('#setRoomName').value.trim() || '우리들 단톡방').slice(0, 24);
    AI_ORDER.forEach(function (id) {
      var card = aiCardsEl.querySelector('.ai-card[data-ai="' + id + '"]');
      if (!card) return;
      var a = settings.ais[id];
      var nm = card.querySelector('[data-f="name"]').value.trim();
      a.name = (nm || DEFAULTS[id].name).slice(0, 10);
      a.key = card.querySelector('[data-f="key"]').value.trim();
      a.persona = card.querySelector('[data-f="persona"]').value.trim();
      a.role = card.querySelector('[data-f="role"]').value.trim().slice(0, 30);
      a.on = card.querySelector('[data-f="on"]').checked;
    });
    var db = stripSlash($('#setDbUrl').value.trim());
    if (db && !isHttpUrl(db)) { toast('공용 공책 주소는 https://로 시작해야 해요'); return; }
    settings.dbUrl = db;
    saveSettings();
    updateHash();
    roomInput.value = settings.roomName;
    document.title = settings.roomName + ' · 초간단 AI 단톡방';
    closeSettings();
    render();
    restartSync();
    toast('저장했어요!');
  }

  /* ---------- 입력창 ---------- */
  function autoGrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }
  function insertMention(name) {
    var start = inputEl.selectionStart || 0;
    var end = inputEl.selectionEnd || 0;
    var val = inputEl.value;
    var token = '@' + name + ' ';
    inputEl.value = val.slice(0, start) + token + val.slice(end);
    var pos = start + token.length;
    inputEl.setSelectionRange(pos, pos);
    inputEl.focus();
    autoGrow();
  }

  /* ---------- 이벤트 ---------- */
  function bind() {
    $('#createRoom').addEventListener('click', createRoom);
    $('#joinBtn').addEventListener('click', function () { joinFrom(joinInput.value); });
    joinInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); joinFrom(joinInput.value); }
    });

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        sendMessage();
      }
    });
    inputEl.addEventListener('input', autoGrow);

    roomInput.addEventListener('change', function () {
      settings.roomName = (roomInput.value.trim() || '우리들 단톡방').slice(0, 24);
      roomInput.value = settings.roomName;
      saveSettings();
      document.title = settings.roomName + ' · 초간단 AI 단톡방';
    });
    roomInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') roomInput.blur(); });

    $('#btnInvite').addEventListener('click', copyInvite);
    $('#btnSettings').addEventListener('click', openSettings);
    badgesEl.addEventListener('click', function (e) {
      if (e.target.closest('.badge')) openSettings();
    });

    chipsEl.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var m = chip.getAttribute('data-mention');
      if (m === '__all') {
        var raw = inputEl.value.split(String.fromCharCode(10)).join(' ');
        var keep = [];
        raw.split(' ').forEach(function (tok) { if (tok && tok.charAt(0) !== '@') keep.push(tok); });
        inputEl.value = keep.join(' ');
        inputEl.focus();
        autoGrow();
      } else {
        insertMention(m);
      }
    });

    chatEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-settings]')) openSettings();
    });

    modal.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) closeSettings();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeSettings();
    });

    aiCardsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-reveal]');
      if (!btn) return;
      var field = btn.closest('.key-row').querySelector('.ai-key');
      var show = field.type === 'password';
      field.type = show ? 'text' : 'password';
      btn.textContent = show ? '숨기기' : '보기';
    });
    aiCardsEl.addEventListener('change', function (e) {
      if (e.target.getAttribute('data-f') === 'on') {
        var card = e.target.closest('.ai-card');
        if (card) card.classList.toggle('on', e.target.checked);
        renderRoleSummary();
      }
    });
    aiCardsEl.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-role]');
      if (!chip) return;
      var card = chip.closest('.ai-card');
      var field = card.querySelector('[data-f="role"]');
      field.value = chip.getAttribute('data-role');
      card.querySelectorAll('.role-chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
      renderRoleSummary();
    });
    aiCardsEl.addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-f');
      if (f === 'role' || f === 'name') renderRoleSummary();
    });

    $('#saveBtn').addEventListener('click', saveSettingsFromModal);
    $('#clearChat').addEventListener('click', function () {
      if (!confirm('이 기기에서 이 방의 대화를 지울까요? 되돌릴 수 없어요.')) return;
      settings.clearedAt = Date.now();
      messages = [];
      saveSettings();
      saveMessages();
      render();
      closeSettings();
      toast('이 기기의 대화를 지웠어요.');
    });
  }

  /* ---------- 시작 ---------- */
  function start() {
    var creds = readCreds();

    if (!creds.ok) {
      bindLockOnly();
      var reason = '';
      if (creds.room && creds.k) reason = '초대 링크의 열쇠가 올바르지 않아요. 링크 전체를 다시 확인해 주세요.';
      else if (creds.room) reason = '이 방에는 아직 열쇠가 없어요. 초대 링크 전체(?room=…&k=…)를 붙여넣어 주세요.';
      showLock(reason);
      return;
    }

    roomId = creds.room;
    roomKey = creds.k;
    ns = 'aigc.v1.' + roomId + '_' + roomKey;

    settings = loadSettings();
    if (creds.db && isHttpUrl(creds.db) && stripSlash(creds.db) !== settings.dbUrl) {
      settings.dbUrl = stripSlash(creds.db);
      saveSettings();
    }
    messages = loadMessages();

    lockEl.hidden = true;
    appEl.hidden = false;
    roomInput.value = settings.roomName;
    document.title = settings.roomName + ' · 초간단 AI 단톡방';

    bind();
    render();
    updateHash();
    if (settings.dbUrl) restartSync();
    registerSW();
  }

  function bindLockOnly() {
    $('#createRoom').addEventListener('click', createRoom);
    $('#joinBtn').addEventListener('click', function () { joinFrom(joinInput.value); });
    joinInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); joinFrom(joinInput.value); }
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }

  start();
})();
