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
  var PROVIDERS = ['gemini', 'openai', 'claude', 'groq', 'openrouter'];
  var PROVIDER_INFO = {
    gemini: {
      label: 'Google Gemini',
      defaultName: '제미나이',
      keyUrl: 'https://aistudio.google.com/apikey',
      keySite: 'Google AI Studio',
      colors: [
        { c1: '#4285F4', c2: '#1B6FE0' },
        { c1: '#1C7ED6', c2: '#0B5CAB' },
        { c1: '#7048E8', c2: '#5B3FD9' }
      ]
    },
    openai: {
      label: 'OpenAI ChatGPT',
      defaultName: '지피티',
      keyUrl: 'https://platform.openai.com/api-keys',
      keySite: 'OpenAI',
      colors: [
        { c1: '#10A37F', c2: '#0B7A60' },
        { c1: '#0CA678', c2: '#087F5B' },
        { c1: '#2F9E44', c2: '#237032' }
      ]
    },
    claude: {
      label: 'Anthropic Claude',
      defaultName: '클로드',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      keySite: 'Anthropic',
      colors: [
        { c1: '#D97757', c2: '#B0573A' },
        { c1: '#E8590C', c2: '#C2410C' },
        { c1: '#F08C00', c2: '#B35C00' }
      ]
    },
    /* Groq·OpenRouter도 OpenAI와 같은 모양으로 물어보는 곳이에요 (열쇠만 다름) */
    groq: {
      label: 'Groq (무료/초고속)',
      defaultName: '그록',
      keyUrl: 'https://console.groq.com/keys',
      keySite: 'Groq Console',
      colors: [
        { c1: '#F55036', c2: '#C2410C' },
        { c1: '#FF7A45', c2: '#D9480F' },
        { c1: '#F76707', c2: '#B34700' }
      ]
    },
    openrouter: {
      label: 'OpenRouter (무료 모델)',
      defaultName: '오픈이',
      keyUrl: 'https://openrouter.ai/keys',
      keySite: 'OpenRouter',
      colors: [
        { c1: '#6D5AE6', c2: '#4C2FA8' },
        { c1: '#4C6EF5', c2: '#2B3FA8' },
        { c1: '#7B5CD6', c2: '#3B2A7A' }
      ]
    }
  };
  /* 롤 티어 직급 — 낮은 순서부터 높은 순서 (말풍선·배지 색도 여기서 나와요). */
  var TIERS = [
    { key: 'iron', name: '아이언', icon: '⚙️', c1: '#818c99', c2: '#4e5865', ink: '#ffffff' },
    { key: 'bronze', name: '브론즈', icon: '🥉', c1: '#c08457', c2: '#8a5626', ink: '#ffffff' },
    { key: 'silver', name: '실버', icon: '🥈', c1: '#b6c3d1', c2: '#7b8a9c', ink: '#2a3542' },
    { key: 'gold', name: '골드', icon: '🥇', c1: '#f6c445', c2: '#c98b00', ink: '#4a3300' },
    { key: 'platinum', name: '플래티넘', icon: '💠', c1: '#45cbbc', c2: '#17897f', ink: '#ffffff' },
    { key: 'emerald', name: '에메랄드', icon: '🍀', c1: '#3cc47c', c2: '#12733f', ink: '#ffffff' },
    { key: 'diamond', name: '다이아', icon: '💎', c1: '#5aa6fb', c2: '#2a5fc4', ink: '#ffffff' },
    { key: 'master', name: '마스터', icon: '🔮', c1: '#a97cf7', c2: '#6d28d9', ink: '#ffffff' },
    { key: 'grandmaster', name: '그랜드마스터', icon: '🔥', c1: '#f4694f', c2: '#b3231c', ink: '#ffffff' },
    { key: 'challenger', name: '챌린저', icon: '👑', c1: '#ffd95e', c2: '#d99b00', ink: '#4a3300' }
  ];
  var TIER_DEFAULT = 'iron'; /* 새 AI·티어 정보가 없을 때 시작 티어 (기본은 모두 아이언) */

  /* 예전(고정 3명) 방을 옮길 때 쓰는 기본 멤버 3명 — 새 방에는 자동으로 넣지 않아요 */
  var MEMBER_DEFAULTS = [
    { id: 'gemini', provider: 'gemini', name: '제미나이', on: true, persona: '', role: '블로그 원고 담당', tier: 'iron' },
    { id: 'openai', provider: 'openai', name: '지피티', on: false, persona: '', role: '스레드 카피·아이디어 담당', tier: 'iron' },
    { id: 'claude', provider: 'claude', name: '클로드', on: false, persona: '', role: '최종 검수·실행 담당', tier: 'iron' }
  ];
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
  var USER_NAME = '대마왕';
  var KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
  var ROOM_RE = /^[A-Za-z0-9_-]{4,48}$/;
  var ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  var NAME_MAX = 16;
  var ROLE_MAX = 30;
  var PERSONA_MAX = 80;

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
  var drawerEl = $('#drawer');
  var rosterEl = $('#roster');
  var drawerCountEl = $('#drawerCount');
  var drawerDbStatusEl = $('#drawerDbStatus');
  var checkEveryEl = $('#checkEvery');

  /* ---------- 상태 ---------- */
  var settings = null;
  var draftAis = null; /* 설정 창에서 편집 중인 AI 목록(저장 전) */
  var messages = [];
  var roomId = '';
  var roomKey = '';
  var ns = '';
  var pending = [];
  var pollTimer = null;
  var toastTimer = null;
  var pullBusy = false;
  var dbState = '';
  var pendingBattle = {}; /* 승급전 평가로 기다리는 AI (말풍선을 '평가 중'으로) */
  var rankBusy = false;   /* 승급전 평가가 도는 중인지 */

  /* 기본 공용 공책 — 설정에서 다른 주소로 바꿀 수 있어요 */
  var DEFAULT_DB_URL = 'https://aigc-sync-room-default-rtdb.firebaseio.com';

  /* ---------- 작은 도구들 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
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
  /* 공용 공책 주소: 붙여넣기 할 때 섞여 들어간 공백·줄바꿈은 모두 지워요 */
  function cleanDbUrl(v) { return stripSlash(String(v || '').replace(/\s+/g, '')); }

  /* ---------- AI 멤버(동적 목록) 다루기 ---------- */
  function memberList() { return (settings && isArr(settings.ais)) ? settings.ais : []; }
  function enabledAis() { return memberList().filter(function (a) { return a.on; }); }
  function aiById(id) {
    var list = memberList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function providerInfo(p) { return PROVIDER_INFO[p] || PROVIDER_INFO.gemini; }

  /* ---------- 티어(직급) 도구 ---------- */
  function tierIndex(key) {
    for (var i = 0; i < TIERS.length; i++) if (TIERS[i].key === key) return i;
    return -1;
  }
  function tierByKey(key) {
    var i = tierIndex(key);
    return i > -1 ? TIERS[i] : TIERS[tierIndex(TIER_DEFAULT)];
  }
  function tierOf(ai) { return tierByKey(ai && ai.tier); }
  function tierStyle(t) { return '--t1:' + t.c1 + ';--t2:' + t.c2 + ';--t-ink:' + t.ink; }
  function tierTag(key, extraClass) {
    var t = tierByKey(key);
    return '<span class="tier-tag' + (extraClass ? ' ' + extraClass : '') + '" style="' + tierStyle(t) + '" title="' + esc(t.name + ' 티어') + '">' +
      '<span class="tier-ico" aria-hidden="true">' + t.icon + '</span>' + esc(t.name) + '</span>';
  }
  /* ▲ 승급 / ▼ 강등 버튼 (compact면 글자 없이 화살표만) */
  function tierStepHTML(id, key, compact) {
    var i = tierIndex(key);
    if (i < 0) i = tierIndex(TIER_DEFAULT);
    var upEnd = i >= TIERS.length - 1;
    var downEnd = i <= 0;
    return '<button type="button" class="tier-step up' + (compact ? ' sm' : '') + '" data-tier-up="' + esc(id) + '"' + (upEnd ? ' disabled' : '') +
      ' title="' + esc(upEnd ? '이미 최고 티어예요' : TIERS[i + 1].name + '으로 승급') + '" aria-label="' + esc('한 단계 승급') + '">' + (compact ? '▲' : '▲ 승급') + '</button>' +
      '<button type="button" class="tier-step down' + (compact ? ' sm' : '') + '" data-tier-down="' + esc(id) + '"' + (downEnd ? ' disabled' : '') +
      ' title="' + esc(downEnd ? '이미 최저 티어예요' : TIERS[i - 1].name + '으로 강등') + '" aria-label="' + esc('한 단계 강등') + '">' + (compact ? '▼' : '▼ 강등') + '</button>';
  }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + fmtTime(ts);
  }
  function colorsOf(ai) {
    if (!ai) return { c1: '#8a95a1', c2: '#6b7684' };
    var set = providerInfo(ai.provider).colors;
    var i = parseInt(ai.colorIndex, 10);
    if (!isFinite(i) || i < 0) i = 0;
    return set[i % set.length];
  }
  function defaultNameFor(provider) {
    var info = PROVIDER_INFO[provider];
    if (info && info.defaultName) return info.defaultName;
    for (var i = 0; i < MEMBER_DEFAULTS.length; i++) {
      if (MEMBER_DEFAULTS[i].provider === provider) return MEMBER_DEFAULTS[i].name;
    }
    return 'AI';
  }
  function nameOf(who) {
    if (who === 'me') return USER_NAME;
    var ai = aiById(who);
    if (ai) return ai.name;
    if (settings && settings.names && typeof settings.names === 'object' && settings.names[who]) return String(settings.names[who]);
    /* 다른 비서(아이·피클2호 등)가 공용 공책에 직접 쓴 글: 이름을 그대로 보여 줘요 */
    if (typeof who === 'string') {
      var raw = who.trim();
      if (raw) return raw;
    }
    return 'AI';
  }
  function roleOf(id) {
    var ai = aiById(id);
    return ai ? String(ai.role || '').trim() : '';
  }
  function shortRole(role) {
    var r = String(role || '').trim();
    if (r.slice(-2) === '담당') r = r.slice(0, -2).trim();
    return r;
  }
  function isAiMessage(who) { return who && who !== 'me' && who !== 'system'; }
  function nextColorIndex(provider, list) {
    var used = {};
    (list || []).forEach(function (a) {
      if (a.provider !== provider) return;
      var i = parseInt(a.colorIndex, 10);
      if (isFinite(i) && i >= 0) used[i % 3] = true;
    });
    for (var i = 0; i < 3; i++) if (!used[i]) return i;
    return (list || []).filter(function (a) { return a.provider === provider; }).length % 3;
  }
  function newMemberId(provider, list) {
    var id = '';
    var guard = 0;
    var exists = function (x) {
      return (list || []).some(function (a) { return a.id === x; });
    };
    do {
      id = provider + '_' + randId(5);
      guard++;
    } while (exists(id) && guard < 50);
    return id;
  }
  function cloneAi(a) {
    return {
      id: a.id,
      provider: a.provider,
      name: a.name,
      role: a.role || '',
      tier: tierIndex(a.tier) > -1 ? a.tier : TIER_DEFAULT,
      on: !!a.on,
      apiKey: a.apiKey || '',
      persona: a.persona || '',
      colorIndex: typeof a.colorIndex === 'number' ? a.colorIndex : 0
    };
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

  /* 저장된 AI 목록을 읽어 와요.
     - 저장값이 아예 없는 ‘새 방’은 빈 목록([])으로 시작해요 (기본 API AI를 넣지 않음)
     - 이미 목록이 있는 방은 그 목록을 그대로 살려요 (빈 목록도 그대로) */
  function migrateAis(raw) {
    if (raw == null) return [];
    var out = [];
    function push(provider, id, a, fallbackRole, fallbackOn, fallbackTier) {
      a = (a && typeof a === 'object') ? a : {};
      var p = PROVIDERS.indexOf(provider) > -1 ? provider : 'gemini';
      var safeId = (typeof id === 'string' && ID_RE.test(id)) ? id : newMemberId(p, out);
      if (out.some(function (x) { return x.id === safeId; })) safeId = newMemberId(p, out);
      var nm = String(a.name || '').trim() || defaultNameFor(p);
      var ci = parseInt(a.colorIndex, 10);
      /* 티어 정보가 없는 예전 방은 모두 아이언에서 시작해요 */
      var tk = tierIndex(a.tier) > -1 ? a.tier : (fallbackTier || TIER_DEFAULT);
      out.push({
        id: safeId,
        provider: p,
        name: nm.slice(0, NAME_MAX),
        role: typeof a.role === 'string' ? a.role.slice(0, ROLE_MAX) : (fallbackRole || ''),
        tier: tierIndex(tk) > -1 ? tk : TIER_DEFAULT,
        on: typeof a.on === 'boolean' ? a.on : !!fallbackOn,
        apiKey: String(a.apiKey || a.key || ''),
        persona: String(a.persona || '').slice(0, PERSONA_MAX),
        colorIndex: (isFinite(ci) && ci >= 0) ? ci : nextColorIndex(p, out)
      });
    }

    if (isArr(raw)) {
      /* 이미 새 형식: 그대로 살리되 값은 꼼꼼히 점검 */
      raw.forEach(function (a) {
        if (!a || typeof a !== 'object') return;
        var p = PROVIDERS.indexOf(a.provider) > -1 ? a.provider : 'gemini';
        push(p, a.id, a, '', true);
      });
    } else if (raw && typeof raw === 'object') {
      /* 예전 형식: { gemini:{...}, openai:{...}, claude:{...} } */
      MEMBER_DEFAULTS.forEach(function (d) {
        push(d.provider, d.id, raw[d.id], d.role, d.on, d.tier);
      });
    }

    return out;
  }

  function loadSettings() {
    var saved = read(settingsKey()) || {};
    var s = {
      roomName: saved.roomName || '우리들 단톡방',
      dbUrl: saved.dbUrl ? cleanDbUrl(saved.dbUrl) : (saved.dbOff ? '' : DEFAULT_DB_URL),
      clearedAt: saved.clearedAt || 0,
      lastBattleAt: saved.lastBattleAt || 0,
      ais: migrateAis(saved.ais),
      names: (saved.names && typeof saved.names === 'object') ? saved.names : {},
      checkEvery: saved.checkEvery
    };
    s.ais.forEach(function (a) { s.names[a.id] = a.name; });
    return s;
  }
  function saveSettings() { store(settingsKey(), settings); }

  function loadMessages() {
    var list = read(messagesKey());
    return isArr(list) ? list : [];
  }
  function saveMessages() {
    store(messagesKey(), messages.filter(function (m) { return !m.err; }));
  }

  /* ---------- @이름 찾기 (이름에 공백이 있어도 정확히) ---------- */
  function scanMentions(text) {
    var src = String(text || '');
    var lower = src.toLowerCase();
    var names = memberList().map(function (a) {
      return { id: a.id, name: a.name, lower: String(a.name).toLowerCase() };
    }).filter(function (n) { return !!n.name; });
    /* 긴 이름부터 확인해서 '유튜브1호'가 '유튜브'보다 먼저 잡히게 해요 */
    names.sort(function (a, b) { return b.name.length - a.name.length; });

    var ids = [];
    var ranges = [];
    var i = 0;
    while (i < src.length) {
      if (src.charAt(i) === '@') {
        var hit = null;
        for (var k = 0; k < names.length; k++) {
          var n = names[k];
          if (lower.substr(i + 1, n.name.length) === n.lower) { hit = n; break; }
        }
        if (hit) {
          if (ids.indexOf(hit.id) < 0) ids.push(hit.id);
          ranges.push([i, i + 1 + hit.name.length]);
          i = i + 1 + hit.name.length;
          continue;
        }
      }
      i++;
    }
    return { ids: ids, ranges: ranges };
  }
  function hasAllMention(text) {
    var t = String(text || '');
    return t.indexOf('@전체') > -1 || t.indexOf('@모두') > -1 || t.indexOf('@다들') > -1;
  }

  /* ---------- 화면 ---------- */
  function render() {
    var near = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 160;
    renderBadges();
    renderChips();
    renderChat();
    renderRoster(false);
    if (near) chatEl.scrollTop = chatEl.scrollHeight;
  }

  function renderBadges() {
    var all = memberList();
    var on = enabledAis();
    var html = '<span class="badge badge-lock">🔒 비밀 방</span>';
    if (!all.length) {
      /* API AI가 0명이어도 깔끔하게: 외부 비서만 있는 방 */
      html += '<span class="badge badge-none" title="⚙️에서 AI를 추가하거나 🤖 초대 문구로 외부 비서를 불러 보세요">AI 0명 · 외부 비서만</span>';
    } else if (!on.length) {
      html += '<span class="badge badge-off">AI 모두 꺼짐</span>';
    } else {
      html += on.map(function (a) {
        var col = colorsOf(a);
        var role = String(a.role || '').trim();
        return '<span class="badge" style="--c1:' + col.c1 + ';--c2:' + col.c2 + '" title="' + esc(tierOf(a).name + ' · ' + a.name + (role ? ' · ' + role : '')) + '">' +
          tierTag(a.tier, 'sm') + '<b class="badge-name">' + esc(a.name) + '</b>' +
          (role ? '<em>· ' + esc(shortRole(role)) + '</em>' : '') + '</span>';
      }).join('');
    }
    badgesEl.innerHTML = html;
  }

  function renderChips() {
    var on = enabledAis();
    var html = '';
    if (on.length) {
      html += '<button class="chip chip-all" type="button" data-mention="__all">전체 (각자 역할대로)</button>';
      html += on.map(function (a) {
        return '<button class="chip" type="button" data-mention="' + esc(a.name) + '" style="--c1:' + colorsOf(a).c1 + '">@' + esc(a.name) + '</button>';
      }).join('');
    } else if (memberList().length) {
      /* AI는 있는데 모두 꺼져 있으면 ‘전체’ 칩을 숨기고 안내만 */
      html = '<span class="chips-hint">켜진 AI가 없어요 · ☰ 사이드 메뉴에서 불빛을 눌러 켜 주세요</span>';
    } else {
      /* API AI 0명: 외부 비서 중심 안내 */
      html = '<span class="chips-hint">내 AI는 아직 0명이에요 · ⚙️에서 추가하거나, 외부 비서는 @이름으로 불러요</span>';
    }
    chipsEl.innerHTML = html;
  }

  /* ---------- ☰ 사이드 메뉴 (참여자 · 불빛 · 이름 바꾸기 · 확인 주기) ---------- */
  var CHECK_EVERY_OPTIONS = [0, 1, 5, 10, 30, 60];
  var EXT_ONLINE_MS = 10 * 60 * 1000; /* 외부 비서는 10분 안에 글을 남기면 ‘들어와 있음’ */
  var rosterTimer = null;
  var rosterSig = '';

  function checkEvery() {
    var v = parseInt(settings && settings.checkEvery, 10);
    if (!isFinite(v) || CHECK_EVERY_OPTIONS.indexOf(v) < 0) v = 5;
    return v;
  }
  function checkEveryLabel(v) { return v ? (v + '분마다') : '수동(부르면)'; }
  function checkEveryPhrase(v) { return v ? (v + '분마다 새 글을 확인해서 답해 줘') : '내가 부를 때만 새 글을 확인해 줘'; }
  function renderCheckPreview() {
    var el = $('#checkEveryPreview');
    if (!el) return;
    el.innerHTML = '🤖 초대 문구에 이렇게 들어가요: <b>' + esc(checkEveryPhrase(checkEvery())) + '</b>';
  }
  /* 실제 🤖 초대 문구를 그대로 보여 줘서 주기가 들어갔는지 눈으로 확인 */
  function renderInvitePreview() {
    var ta = $('#invitePreviewText');
    if (ta) ta.value = aiInviteText();
  }

  function relTime(ts) {
    var diff = Math.max(0, Date.now() - (ts || 0));
    if (diff < 60 * 1000) return '방금';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '분 전';
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + '시간 전';
    return Math.floor(diff / 86400000) + '일 전';
  }

  /* 내가 넣은 AI가 아닌데 공용 공책에 글을 쓴 비서들 (아이·피클2호 등) */
  function externalParticipants() {
    var map = {};
    var list = [];
    messages.forEach(function (m) {
      if (!m || m.err) return;
      if (!isAiMessage(m.who)) return;
      if (aiById(m.who)) return;
      var who = String(m.who);
      var p = map[who];
      if (!p) { p = map[who] = { who: who, ts: 0, roleTag: '', count: 0 }; list.push(p); }
      p.count++;
      if ((m.ts || 0) >= p.ts) {
        p.ts = m.ts || 0;
        if (m.roleTag) p.roleTag = String(m.roleTag);
      }
    });
    list.sort(function (a, b) { return b.ts - a.ts; });
    return list;
  }

  function rosterRows() {
    var rows = [{ kind: 'me', key: 'me', name: USER_NAME, on: true, label: '나', meta: '시키는 사람 (사장님)' }];
    memberList().forEach(function (a) {
      var role = String(a.role || '').trim();
      rows.push({
        kind: 'ai', key: a.id, name: a.name, on: !!a.on, label: 'AI',
        meta: providerInfo(a.provider).label + (role ? ' · ' + role : '') + (a.on ? ' · 켜짐' : ' · 꺼짐')
      });
    });
    externalParticipants().forEach(function (p) {
      var online = (Date.now() - p.ts) < EXT_ONLINE_MS;
      rows.push({
        kind: 'ext', key: p.who, name: nameOf(p.who), on: online, label: '외부',
        meta: (p.roleTag ? p.roleTag + ' · ' : '') + relTime(p.ts) + ' 활동' + (online ? ' · 들어와 있음' : ' · 안 들어옴')
      });
    });
    return rows;
  }

  function renderRoster(force) {
    if (!rosterEl || !drawerEl || drawerEl.hidden) return;
    /* 이름을 고치는 중에는 다시 그리지 않아요 (커서가 튀지 않게) */
    if (!force && rosterEl.contains(document.activeElement)) return;
    var rows = rosterRows();
    /* 상태가 그대로면 다시 그리지 않아요 (입력 중 커서·스크롤이 튀지 않게) */
    var sigStr = rows.map(function (r) { return r.kind + ':' + r.key + ':' + (r.on ? 1 : 0) + ':' + r.name + ':' + r.meta; }).join('|');
    if (!force && sigStr === rosterSig) return;
    rosterSig = sigStr;
    if (drawerCountEl) drawerCountEl.textContent = rows.length + '명';
    rosterEl.innerHTML = rows.map(function (r) {
      var ai = r.kind === 'ai' ? aiById(r.key) : null;
      var col = r.kind === 'ai' ? colorsOf(ai) : (r.kind === 'ext' ? { c1: '#6b7684', c2: '#454f5b' } : { c1: '#191919', c2: '#191919' });
      var state = r.on ? 'on' : 'off';
      var hint = r.kind === 'ai'
        ? (r.on ? '켜져 있음 · 눌러서 끄기' : '꺼져 있음 · 눌러서 켜기')
        : (r.on ? '들어와 있음' : '안 들어옴');
      var light = r.kind === 'ai'
        ? '<button type="button" class="light-btn" data-toggle-ai="' + esc(r.key) + '" title="' + esc(hint) + '" aria-label="' + esc(r.name + ' ' + (r.on ? '끄기' : '켜기')) + '" aria-pressed="' + (r.on ? 'true' : 'false') + '"><span class="light ' + state + '"></span></button>'
        : '<span class="light-btn" title="' + esc(hint) + '" role="img" aria-label="' + esc(hint) + '"><span class="light ' + state + '"></span></span>';
      var nameField = r.kind === 'me'
        ? '<input class="roster-name" value="' + esc(r.name) + '" readonly aria-label="내 이름">'
        : '<input class="roster-name" value="' + esc(r.name) + '" maxlength="' + (r.kind === 'ext' ? 24 : NAME_MAX) + '" data-rename="' + esc(r.key) + '" data-kind="' + r.kind + '" placeholder="' + esc(r.kind === 'ai' ? defaultNameFor(ai.provider) : r.key) + '" aria-label="' + esc(r.name + ' 이름 바꾸기') + '" autocomplete="off" spellcheck="false">';
      /* 내 AI 줄에는 ‘방에서 빼기(✕)’를 바로 붙여요 — 설정 창에 들어가지 않아도 한 번에 */
      var delBtn = r.kind === 'ai'
        ? '<button type="button" class="roster-del" data-roster-del="' + esc(r.key) + '" title="방에서 빼기" aria-label="' + esc(r.name + ' 방에서 빼기') + '">✕</button>'
        : '';
      return '<div class="roster-row ' + r.kind + (r.on ? '' : ' off') + '" style="--c1:' + col.c1 + ';--c2:' + col.c2 + '">' +
        light +
        '<div class="avatar" aria-hidden="true">' + esc(String(r.name).charAt(0) || 'A') + '</div>' +
        '<div class="roster-main">' + nameField + '<div class="roster-meta">' + esc(r.meta) + '</div></div>' +
        '<div class="roster-tools"><span class="roster-kind ' + r.kind + '">' + r.label + '</span>' + delBtn + '</div>' +
        '</div>';
    }).join('');
  }

  function openDrawer() {
    if (!drawerEl) return;
    drawerEl.hidden = false;
    document.body.classList.add('modal-open');
    var btn = $('#btnMenu');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (checkEveryEl) checkEveryEl.value = String(checkEvery());
    renderCheckPreview();
    renderInvitePreview();
    renderDbStatus();
    renderRoster(true);
    if (rosterTimer) clearInterval(rosterTimer);
    /* 열어 둔 동안에도 10분 기준 불빛이 저절로 맞춰지게 */
    rosterTimer = setInterval(function () { renderRoster(false); }, 30000);
  }
  function closeDrawer() {
    if (!drawerEl || drawerEl.hidden) return;
    if (document.activeElement && drawerEl.contains(document.activeElement)) {
      try { document.activeElement.blur(); } catch (e) { }
    }
    drawerEl.hidden = true;
    document.body.classList.remove('modal-open');
    var btn = $('#btnMenu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (rosterTimer) { clearInterval(rosterTimer); rosterTimer = null; }
  }
  function toggleDrawer() {
    if (!drawerEl) return;
    if (drawerEl.hidden) openDrawer(); else closeDrawer();
  }

  function setCheckEvery(v) {
    var n = parseInt(v, 10);
    if (!isFinite(n) || CHECK_EVERY_OPTIONS.indexOf(n) < 0) n = 5;
    settings.checkEvery = n;
    saveSettings();
    if (checkEveryEl) checkEveryEl.value = String(n);
    renderCheckPreview();
    renderInvitePreview();
    toast('새 글 확인 주기: ' + checkEveryLabel(n) + ' — 🤖 초대 문구에 넣어 뒀어요');
  }

  /* 사이드 메뉴에서 이름을 고치면 채팅·헤더·멘션 칩·설정까지 바로 반영 */
  function renameFromRoster(key, kind, raw) {
    if (!settings) return;
    if (!settings.names || typeof settings.names !== 'object') settings.names = {};
    var nm = String(raw || '').replace(/\s+/g, ' ').trim();

    if (kind === 'ai') {
      var live = aiById(key);
      if (!live) return;
      var before = live.name;
      var next = (nm || defaultNameFor(live.provider)).slice(0, NAME_MAX);
      next = uniqueName(next, memberList(), key);
      live.name = next;
      settings.names[key] = next;
      if (draftAis) {
        draftAis.forEach(function (x) { if (x.id === key) x.name = next; });
        renderAiCards();
        renderRoleSummary();
      }
      saveSettings();
      render();
      renderRoster(true);
      battleMetaUpdate();
      if (next !== before) toast('이름을 ‘' + next + '’로 바꿨어요!');
      return;
    }

    if (kind === 'ext') {
      var who = String(key);
      var cleaned = nm.slice(0, 24);
      if (!cleaned || cleaned === who) delete settings.names[who];
      else settings.names[who] = cleaned;
      saveSettings();
      render();
      renderRoster(true);
      toast('이 비서를 ‘' + nameOf(who) + '’라고 부를게요!');
    }
  }

  function toggleAiFromRoster(id) {
    var a = aiById(id);
    if (!a) return;
    a.on = !a.on;
    saveSettings();
    render();
    renderRoster(true);
    toast(a.name + (a.on ? ' 켰어요 🔵' : ' 껐어요 🔴'));
  }

  /* 사이드 메뉴 ✕ — 설정 창을 열지 않고 바로 방에서 빼기 (API AI 0명까지 가능) */
  function removeAiFromRoster(id) {
    if (!settings) return;
    var a = aiById(id);
    if (!a) return;
    var name = a.name;
    settings.ais = memberList().filter(function (x) { return x.id !== id; });
    /* 지난 대화 말풍선에 이름이 남도록 settings.names는 지우지 않아요 */
    if (draftAis) {
      draftAis = draftAis.filter(function (x) { return x.id !== id; });
      renderAiCards();
      renderRoleSummary();
    }
    saveSettings();
    render();
    renderRoster(true);
    battleMetaUpdate();
    toast(name + '를 방에서 뺐어요. 다시 넣으려면 ⚙️에서 추가해 주세요.');
  }

  function pullNow() {
    if (!dbBase()) { toast('공용 공책이 연결되지 않았어요. ⚙️에서 주소를 넣어 주세요.'); return; }
    pull(false);
    toast('공용 공책에서 새 글을 확인하고 있어요…');
  }

  function welcomeHTML() {
    return '<div class="welcome">' +
      '<div class="welcome-emoji">💬</div>' +
      '<h3>여기가 우리 단톡방이에요</h3>' +
      '<ol>' +
      '<li>오른쪽 위 <b>⚙️</b>를 눌러 AI 열쇠(API 키)를 넣어 주세요.</li>' +
      '<li>AI마다 <b>담당 역할</b>을 정해 두면, <b>전체</b>에게 말할 때 각자 맡은 일만 해요.</li>' +
      '<li>같은 AI라도 이름만 다르게 여러 명 넣을 수 있어요. (예: 제미나이1호, 제미나이2호)</li>' +
      '<li>아래에 하고 싶은 말을 쓰고 <b>전송</b>을 누르면 AI들이 차례로 답해요.</li>' +
      '<li><b>🔗</b>를 누르면 이 방의 비밀 링크가 복사돼요. 나만 쓰려면 아무한테도 보내지 않으면 돼요.</li>' +
      '<li><b>🤖</b>를 누르면 다른 AI 비서에게 보낼 <b>초대 문구</b>가 복사돼요. (공용 공책을 먼저 연결해 주세요)</li>' +
      '<li>⚙️에서 AI들 티어(아이언~챌린저)를 정해 주고, <b>🏆 승급전 평가</b>를 누르면 AI끼리 100점 만점으로 서로 평가해 <b>최대 ±3계단</b> 승급·강등을 추천해요.</li>' +
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
    var ai = aiById(m.who);
    var col = colorsOf(ai);
    var name = nameOf(m.who);
    /* 내 비서가 아니면 글에 함께 실려 온 roleTag(담당 역할)를 그대로 보여 줘요 */
    var role = roleOf(m.who) || (m.roleTag ? String(m.roleTag).trim() : '');
    return '<div class="msg ai" style="--c1:' + col.c1 + ';--c2:' + col.c2 + '">' +
      '<div class="avatar">' + esc(String(name).charAt(0) || 'A') + '</div>' +
      '<div class="msg-body">' +
      '<div class="who">' + tierTag(ai && ai.tier, 'sm') + '<b>' + esc(name) + '</b>' + (role ? '<em>· ' + esc(role) + '</em>' : '') + '</div>' +
      '<div class="row"><div class="bubble' + (m.err ? ' bubble-err' : '') + '">' + esc(m.text) + '</div>' +
      '<div class="stamp">' + fmtTime(m.ts) + '</div></div>' +
      '</div></div>';
  }
  function typingHTML(id) {
    var ai = aiById(id);
    var col = colorsOf(ai);
    var name = nameOf(id);
    var role = roleOf(id);
    return '<div class="msg ai" style="--c1:' + col.c1 + ';--c2:' + col.c2 + '">' +
      '<div class="avatar">' + esc(String(name).charAt(0) || 'A') + '</div>' +
      '<div class="msg-body">' +
      '<div class="who">' + tierTag(ai && ai.tier, 'sm') + '<b>' + esc(name) + '</b>' + (role ? '<em>· ' + esc(role) + '</em>' : '') + '</div>' +
      '<div class="row"><div class="bubble typing"><span>' + (pendingBattle[id] ? '평가 중' : '생각 중') + '</span><i></i><i></i><i></i></div></div>' +
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
      var named = scanMentions(text).ids.map(aiById).filter(Boolean);
      var offNamed = named.filter(function (a) { return !a.on; });
      var msg;
      if (!memberList().length) {
        msg = '아직 이 방에 AI 친구가 없어요. ⚙️에서 AI를 추가하거나, 🤖 초대 문구로 외부 비서를 불러 보세요!';
      } else if (offNamed.length) {
        msg = '불러준 ' + offNamed.map(function (a) { return a.name; }).join(', ') + '가 지금 꺼져 있어요. ⚙️에서 켜 주세요!';
      } else {
        msg = '지금은 AI 친구가 모두 꺼져 있어요. 오른쪽 위 ⚙️에서 켜 주세요!';
      }
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

  /* 본문에 @이름 을 직접 썼거나 칩으로 넣었을 때 → 그 AI만 부름 */
  function pickTargets(text) {
    var on = enabledAis().map(function (a) { return a.id; });
    if (hasAllMention(text)) return on;
    var named = scanMentions(text).ids;
    if (named.length) {
      return named.filter(function (id) {
        var a = aiById(id);
        return a && a.on;
      });
    }
    return on;
  }

  function respond(id, done, opts) {
    if (pending.indexOf(id) < 0) pending.push(id);
    if (opts && opts.battle) pendingBattle[id] = true;
    render();
    askAI(id, opts).then(function (text) {
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
    delete pendingBattle[id];
  }

  function friendlyError(id, err) {
    var name = nameOf(id);
    var code = err && err.code;
    if (code === 'NO_KEY') return name + ' 열쇠(API 키)가 아직 없어요. ⚙️ 설정에서 넣어 주면 ' + (roleOf(id) || '단톡방 친구') + ' 일을 맡을게요!';
    if (code === 'GONE') return name + '가 설정에서 빠졌어요. ⚙️에서 다시 확인해 주세요.';
    if (code === 'NETWORK') return name + '랑 연결이 안 됐어요. 인터넷이 되는지 한 번 확인해 주세요!';
    if (code === 'EMPTY') return name + '가 오늘은 말이 없네요ㅎㅎ 한 번 더 말 걸어 봐 주세요.';
    var st = err && err.status;
    if (st === 401 || st === 403) return name + '가 열쇠를 거절했어요. 열쇠가 맞는지 ⚙️ 설정에서 확인해 주세요!';
    if (st === 429) {
      var rTried = (err && isArr(err.rateLimited)) ? err.rateLimited : [];
      var rBits = [];
      if (rTried.length) {
        /* 말풍선이 길어지지 않게 회사 이름(google/ 등)은 빼고 모델 이름만 짧게 보여 줘요 */
        var rNames = rTried.map(function (m) { return String(m).split('/').pop(); });
        rBits.push('시도: ' + rNames.slice(0, 3).join(', ') + (rNames.length > 3 ? ' 외' : ''));
      }
      return name + '가 잠깐 숨을 고르고 있어요.' + (rBits.length ? ' (' + rBits.join(' · ') + ')' : '') +
        ' 1분 뒤에 다시 말 걸어 주세요!';
    }
    if (st === 404) {
      var triedModels = (err && isArr(err.triedModels)) ? err.triedModels : [];
      var rawMsg = errText(err).replace(/\s+/g, ' ').trim();
      if (rawMsg.length > 110) rawMsg = rawMsg.slice(0, 110) + '…';
      var bits = [];
      if (triedModels.length) bits.push('시도한 모델: ' + triedModels.slice(0, 3).join(', ') + (triedModels.length > 3 ? ' 외' : ''));
      if (rawMsg) bits.push(rawMsg);
      return name + '가 쓸 수 있는 모델을 못 찾았어요. 모델 이름이 바뀌었거나 이 열쇠로는 못 쓰는 모델이에요.' +
        (bits.length ? ' (' + bits.join(' / ') + ')' : '') +
        ' 계속 그러면 ⚙️ 설정에서 열쇠를 다시 확인해 주세요.';
    }
    if (st >= 500) {
      var sTried = (err && isArr(err.triedModels)) ? err.triedModels : [];
      var sRaw = errText(err).replace(/\s+/g, ' ').trim();
      if (sRaw.length > 80) sRaw = sRaw.slice(0, 80) + '…';
      var sBits = [];
      if (sTried.length) sBits.push('시도: ' + sTried.slice(0, 3).join(', ') + (sTried.length > 3 ? ' 외' : ''));
      sBits.push('HTTP ' + st);
      if (sRaw) sBits.push(sRaw);
      return name + ' 쪽에 잠깐 문제가 생겼어요. 조금 뒤에 다시 해 봐 주세요. (' + sBits.join(' · ') + ')';
    }
    var detail = '';
    try { detail = String((err.data && err.data.error && err.data.error.message) || '').toLowerCase(); } catch (e) { }
    if (st === 400 && (detail.indexOf('api key') > -1 || detail.indexOf('api_key') > -1 || detail.indexOf('invalid_argument') > -1)) {
      return name + ' 열쇠(API 키)가 잘못된 것 같아요. ⚙️ 설정에서 다시 확인해 주세요!';
    }
    if (st === 400) return name + '가 요청을 이해하지 못했어요. 잠시 뒤 다시 해 봐 주세요.';
    return name + '가 대답을 못 했어요. 잠시 뒤 다시 해 봐 주세요.';
  }

  /* ---------- 🏆 주간 승급전 (AI 상대평가) ---------- */
  function battlePromptFor(id) {
    var me = aiById(id);
    var others = enabledAis().filter(function (a) { return a.id !== id; });
    var lines = [];
    lines.push('🏆 주간 승급전 평가 — 이번 주 실적(조회수·완성도·실수 여부 등)을 바탕으로 서로 솔직하게 상대평가하고, 승급/유지/강등 추천을 한 마디씩 남기세요!');
    lines.push('나: ' + (me ? me.name : '나') + ' (' + tierOf(me).name + ' 티어, ' + (String((me && me.role) || '').trim() || '역할 없음') + ')');
    if (others.length) {
      lines.push('평가 대상: ' + others.map(function (a) {
        return a.name + '(' + (String(a.role || '').trim() || '역할 없음') + ' · ' + tierOf(a).name + ')';
      }).join(', '));
    } else {
      lines.push('평가 대상: 동료가 없어요. 지금은 나 자신만 냉정하게 자기평가해 주세요.');
    }
    lines.push('점수: 동료마다 이번 주 성과를 **100점 만점**으로 매기세요. (일의 양·완성도, 조회수·반응, 실수 여부, 약속·순서 준수)')
    lines.push('추천 계단: 점수에 따라 **최대 +3계단 승급 ~ 최대 -3계단 강등** 중 하나만 고르세요. (90~100점 +3 / 80~89 +2 / 70~79 +1 / 60~69 유지(0) / 50~59 -1 / 40~49 -2 / 40점 미만 -3)');
    lines.push('형식: 동료 한 명마다 “이름 — 00점 / 잘한 점 / 아쉬운 점 / 추천: +2”를 2줄 이내로, 마무리에 내 점수와 내 티어 각오 한 줄. 전체 8줄 이내.');
    return lines.join(String.fromCharCode(10));
  }

  function battleMetaText() {
    var on = enabledAis();
    var names;
    if (on.length) names = on.map(function (a) { return a.name + '(' + tierOf(a).name + ')'; }).join(' · ');
    else if (!memberList().length) names = '없음 (아직 AI 친구가 없어요 — ⚙️에서 추가해 주세요)';
    else names = '없음 (켜진 API AI가 없어요 — ☰에서 불빛을 눌러 켜 주세요)';
    var when = (settings && settings.lastBattleAt)
      ? '지난 승급전: ' + fmtDateTime(settings.lastBattleAt)
      : '아직 승급전을 한 번도 안 했어요.';
    return '평가 대상: ' + names + ' · ' + when;
  }

  function battleMetaUpdate() {
    var meta = $('#battleMeta');
    if (meta && settings) meta.textContent = battleMetaText();
  }

  function setBattleBusy(busy) {
    rankBusy = busy;
    var chipBtn = $('#btnBattle');
    if (chipBtn) {
      chipBtn.classList.toggle('busy', busy);
      chipBtn.disabled = busy;
      chipBtn.textContent = busy ? '⏳ 평가 중…' : '🏆 승급전 평가';
    }
    var modalBtn = $('#battleBtnModal');
    if (modalBtn) {
      modalBtn.disabled = busy;
      modalBtn.textContent = busy ? '⏳ AI들이 서로 평가하는 중…' : '🏆 승급전 평가 시작';
    }
  }

  /* 승급전: 켜진 AI들을 한 명씩 불러 서로를 상대평가하게 해요 */
  function startRankBattle() {
    if (rankBusy) { toast('이미 승급전 평가가 진행 중이에요. 조금만 기다려 주세요!'); return; }
    var on = enabledAis();
    if (!modal.hidden) closeSettings();
    if (!on.length) {
      var noAi = memberList().length
        ? '켜진 API AI가 없어요. ☰ 사이드 메뉴에서 불빛을 누르거나 ⚙️에서 AI를 켜 주세요!'
        : '켜진 API AI가 없어요. ⚙️에서 AI 친구를 추가하거나, 🤖 초대 문구로 외부 비서를 불러 보세요!';
      pushMessage({ who: 'system', text: noAi });
      render();
      toast(noAi);
      return;
    }
    var lineup = on.map(function (a) { return a.name + '(' + tierOf(a).name + ')'; }).join(' · ');
    pushMessage({
      who: 'system',
      text: '🏆 주간 승급전 평가 시작! ' + lineup + ' — 이번 주 실적을 100점 만점으로 서로 상대평가합니다. (점수에 따라 최대 +3계단 승급 ~ 최대 -3계단 강등 추천, 켜진 AI ' + on.length + '명을 차례로 부릅니다)'
    });
    settings.lastBattleAt = Date.now();
    saveSettings();
    setBattleBusy(true);
    render();

    var ids = on.map(function (a) { return a.id; });
    var i = 0;
    function next() {
      if (i >= ids.length) {
        setBattleBusy(false);
        pushMessage({ who: 'system', text: '🏆 승급전 평가 끝! 추천이 +2·-3처럼 여러 계단이면 ⚙️ 설정의 ▲ 승급 / ▼ 강등을 그만큼 눌러 주면 돼요.' });
        render();
        return;
      }
      var id = ids[i++];
      respond(id, function () { setTimeout(next, 240); }, { battle: true });
    }
    setTimeout(next, 260);
  }

  /* ---------- AI에게 묻기 ---------- */
  function systemPrompt(id, opts) {
    var me = aiById(id) || { name: 'AI', persona: '', role: '' };
    var mine = String(me.role || '').trim() || '정해진 역할 없이 단톡방 친구처럼 돕기';
    var persona = String(me.persona || '').trim();
    var myTier = tierOf(me);
    var lines = [];
    lines.push('당신은 ' + me.name + '입니다. 이 단톡방에서 당신의 담당 역할은 [' + mine + ']입니다.');
    if (persona) lines.push('말투와 성격: ' + persona);
    lines.push('');
    lines.push('이 방의 멤버와 역할 (롤 티어 = 이 방의 직급):');
    lines.push('- ' + USER_NAME + ' (지시하는 사람, 사장님 · 티어 없음)');
    lines.push('- ' + me.name + ' (당신): ' + mine + ' · ' + myTier.name + ' 티어');
    enabledAis().forEach(function (other) {
      if (other.id === id) return;
      lines.push('- ' + other.name + ': ' + (String(other.role || '').trim() || '정해진 역할 없음') + ' · ' + tierOf(other).name + ' 티어');
    });
    lines.push('');
    lines.push('티어(직급) 규칙:');
    lines.push('1. 아이언 < 브론즈 < 실버 < 골드 < 플래티넘 < 에메랄드 < 다이아 < 마스터 < 그랜드마스터 < 챌린저 순서입니다.');
    lines.push('2. 티어가 높을수록 실력을 인정받습니다. 자기 티어에 대한 자부심과 승급 의지가 말투에 은근히 묻어나게 하세요.');
    lines.push('3. 티어 자랑으로 대화를 채우지는 말고 맡은 일로 증명하세요. 나보다 낮은 티어 동료도 무시하지 마세요.');
    lines.push('');
    lines.push('지켜야 할 것:');
    lines.push('1. 답할 때는 자기 담당 역할의 일을 실제 결과물로 내놓으세요. (원고면 원고, 검수면 고칠 점과 고친 결과)');
    lines.push('2. 다른 AI의 담당 영역은 대신 하지 말고, 필요하면 그 AI에게 넘기세요. 예: "이건 ' + firstOtherName(id) + '가 하면 좋겠어요."');
    lines.push('3. 앞에 다른 AI가 이미 답했다면 그 내용을 이어받아, 겹치는 말은 빼고 내 역할에서 보탤 것만 말하세요.');
    lines.push('4. 카카오톡 단톡방처럼 짧고 편한 반말로, 보통 2~6문장. 길게 설명하지 마세요.');
    lines.push('5. 모르면 모른다고 말하고, 없는 내용을 지어내지 마세요.');
    if (opts && opts.battle) {
      lines.push('');
      lines.push('지금은 주간 승급전 상대평가 시간입니다.');
      lines.push('- 동료를 100점 만점으로 상대평가하세요. 이 방의 대화 기록에서 드러난 실적(일의 양과 완성도, 조회수·반응, 실수 여부)이 근거입니다.');
      lines.push('- 점수에 따라 최대 +3계단 승급 ~ 최대 -3계단 강등 중 하나(+3/+2/+1/유지(0)/-1/-2/-3)를 근거와 함께 추천하세요. (90~100점 +3 / 80~89 +2 / 70~79 +1 / 60~69 유지 / 50~59 -1 / 40~49 -2 / 40점 미만 -3)');
      lines.push('- 없는 조회수나 수치를 지어내지 말고, 마무리에 내 점수와 내 티어에 대한 각오를 한 줄 붙이세요.');
      lines.push('- 재미있지만 서로에게 솔직하게, 짧게 말하세요. 욕설·비하는 금지입니다.');
    }
    return lines.join(String.fromCharCode(10));
  }

  function firstOtherName(id) {
    var others = enabledAis().filter(function (a) { return a.id !== id; });
    return others.length ? others[0].name : '다른 AI';
  }

  function buildHistory(selfId) {
    var slice = messages.filter(function (m) { return !m.err && m.who !== 'system'; }).slice(-24);
    var out = [];
    slice.forEach(function (m) {
      var role, text;
      if (m.who === 'me') { role = 'user'; text = m.text; }
      else if (m.who === selfId) { role = 'assistant'; text = m.text; }
      else if (isAiMessage(m.who)) { role = 'user'; text = '[' + nameOf(m.who) + '] ' + m.text; }
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

  /* ---------- 모델 이름 자동 찾기 (모델 404 대비) ----------
     AI 회사가 모델 이름을 바꾸거나 없애면 예전 이름은 404가 나요. 그래서
     1) 원래 쓰던 모델로 먼저 해 보고, 404면 열쇠로 쓸 수 있는 모델 목록을 받아 와서
        가장 알맞은 모델(가볍고 빠른 것 · 최신 것)을 골라 다시 해 봐요.
     2) 목록도 못 받으면 미리 적어 둔 모델 이름들을 차례로 해 봐요.
     3) 이번에 성공한 모델은 창을 닫을 때까지 기억해 둬요. (다음부터는 바로 그 모델로)
     4) 서버가 500·503으로 잠깐 막히면(과부하 등) 아직 안 해 본 예비 모델로 최대 2번 더 해 봐요.
     5) '잠깐 숨을 고르고 있어요'(429)가 나면 그 모델은 기억하지 않고 다른 예비 모델로 최대 3번 더 해 봐요.
        (OpenRouter는 ':free' 모델마다 레이트리밋이 따로라서 옆 무료 모델로 바꾸면 바로 되는 때가 많아요.) */
  var GEMINI_BASE = 'https://generativelanguage.googleapis.com';
  var MODEL_DEFAULT = {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o-mini',
    claude: 'claude-3-5-haiku-latest',
    groq: 'openai/gpt-oss-120b',
    openrouter: 'google/gemma-4-31b-it:free'
  };
  var MODEL_FALLBACKS = {
    gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'],
    openai: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano'],
    claude: ['claude-3-5-haiku-latest', 'claude-haiku-4-5-20251001', 'claude-3-7-sonnet-latest', 'claude-sonnet-4-5-20250929'],
    /* Groq·OpenRouter 기본 모델 (2026-11 기준 실제로 열려 있는 이름)
       - Groq: llama-3.3-70b-versatile·llama-3.1-8b-instant는 2026-08-16에 서비스 종료 → gpt-oss로 대체
       - OpenRouter: ':free' 무료 모델만 사용 (이름이 바뀌면 목록에서 자동으로 찾아요) */
    groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
    openrouter: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-lightning:free', 'inclusionai/ling-3.2-flash:free']
  };
  /* 목록을 받아 왔을 때 앞에 놓을 모델 (무료로 쓰기 좋은 것부터) */
  var MODEL_PREFERRED = {
    groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
    openrouter: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-lightning:free', 'inclusionai/ling-3.2-flash:free']
  };
  /* OpenAI와 같은 모양(chat/completions)으로 물어보는 곳들 */
  var OPENAI_COMPAT = {
    openai: { url: 'https://api.openai.com/v1/chat/completions', models: 'https://api.openai.com/v1/models' },
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', models: 'https://api.groq.com/openai/v1/models' },
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', models: 'https://openrouter.ai/api/v1/models' }
  };
  var modelMemo = {}; /* 'provider|열쇠' → 잘 동작한 모델 이름 (창을 닫으면 사라져요) */

  /* 오류 안에 담긴 회사 쪽 설명을 꺼내요 (없으면 빈 글자) */
  function errText(err) {
    try { return String((err && err.data && err.data.error && err.data.error.message) || ''); } catch (e) { return ''; }
  }

  /* 모델이 없어서(404) 실패한 건지 — 회사마다 표시가 달라요 */
  function isModelMissing(err) {
    if (!err) return false;
    if (err.status === 404) return true;
    var e = (err.data && err.data.error) || null;
    if (!e) return false;
    var tag = String(e.status || e.code || e.type || '').toLowerCase();
    return tag === 'not_found' || tag === '404' || tag.indexOf('model_not_found') > -1;
  }

  /* thinking 설정을 모르는 모델이라 거절당한 건지 (400) */
  function isThinkingIssue(err) {
    if (!err || err.status !== 400) return false;
    return errText(err).toLowerCase().indexOf('thinking') > -1;
  }

  /* 모델 이름에서 버전·가벼운 정도를 뽑아 순서를 정해요 */
  function modelRank(name) {
    var ver = parseFloat((/(\d+(?:\.\d+)?)/.exec(name) || [0, '0'])[1]) || 0;
    var light = /(flash|lite|mini|nano|haiku)/.test(name) ? 1 : 0;
    var heavy = /(pro|opus|ultra|max|thinking)/.test(name) ? 1 : 0;
    var draft = /(preview|exp|experimental)/.test(name) ? 1 : 0;
    return { ver: ver, light: light, heavy: heavy, draft: draft };
  }

  /* 값싸고 빠른 모델 → 최신 모델 → 시험판 순서로 줄을 세워요 */
  function rankModels(list) {
    var seen = {};
    return list.filter(function (n) {
      if (!n || seen[n]) return false;
      seen[n] = true;
      return true;
    }).sort(function (a, b) {
      var ka = modelRank(a), kb = modelRank(b);
      if (ka.heavy !== kb.heavy) return ka.heavy - kb.heavy;
      if (ka.light !== kb.light) return kb.light - ka.light;
      if (kb.ver !== ka.ver) return kb.ver - ka.ver;
      if (ka.draft !== kb.draft) return ka.draft - kb.draft;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
  }

  /* 목록 앞쪽에 쓰고 싶은 모델을 먼저 놓아요 (없는 이름은 그냥 건너뜀) */
  function preferModel(list, first) {
    var out = [];
    (first || []).forEach(function (m) { if (list.indexOf(m) > -1 && out.indexOf(m) < 0) out.push(m); });
    return out.concat(list.filter(function (m) { return out.indexOf(m) < 0; }));
  }

  /* Gemini: 이 열쇠로 글쓰기(generateContent)가 되는 flash 계열 모델 이름들 */
  function geminiModelNames(key) {
    var acc = [];
    function page(token, depth) {
      var url = GEMINI_BASE + '/v1beta/models?pageSize=1000&key=' + encodeURIComponent(key) +
        (token ? '&pageToken=' + encodeURIComponent(token) : '');
      return callJson(url, { method: 'GET' }).then(function (data) {
        ((data && data.models) || []).forEach(function (m) {
          var name = String((m && m.name) || '').replace(/^models\//, '');
          var methods = (m && m.supportedGenerationMethods) || [];
          if (name && methods.indexOf('generateContent') > -1) acc.push(name);
        });
        var next = data && data.nextPageToken;
        if (next && depth < 2) return page(next, depth + 1);
        return acc;
      });
    }
    return page('', 0).then(function (all) {
      return rankModels(all.filter(function (n) {
        return /^gemini-/.test(n) && n.indexOf('flash') > -1 &&
          !/(image|tts|audio|live|vision|embedding|learnlm|gemma)/.test(n);
      }));
    });
  }

  /* OpenAI·Groq·OpenRouter: 이 열쇠로 쓸 수 있는 채팅 모델 이름들 */
  function openaiLikeModelNames(provider, key) {
    var ep = OPENAI_COMPAT[provider] || OPENAI_COMPAT.openai;
    return callJson(ep.models, {
      method: 'GET', headers: { 'Authorization': 'Bearer ' + key }
    }).then(function (data) {
      var ids = ((data && data.data) || []).map(function (m) { return String((m && m.id) || ''); });
      var list;
      if (provider === 'groq') {
        /* 말을 못 하는 모델(음성·가드레일 등)은 빼요 */
        list = ids.filter(function (id) { return !/(whisper|tts|orpheus|canopy|guard|embed|moderation|rerank|playai)/i.test(id); });
      } else if (provider === 'openrouter') {
        /* 무료 모델만 써요 (:free 로 끝나는 이름) */
        list = ids.filter(function (id) { return /:free$/.test(id); });
      } else {
        list = ids.filter(function (id) {
          return /^gpt-/.test(id) && !/(audio|realtime|tts|transcribe|image|search|moderation|embedding|codex|instruct|dall|sora)/.test(id);
        });
      }
      return preferModel(rankModels(list), MODEL_PREFERRED[provider] || []);
    });
  }

  function openaiModelNames(key) { return openaiLikeModelNames('openai', key); }
  function groqModelNames(key) { return openaiLikeModelNames('groq', key); }
  function openrouterModelNames(key) { return openaiLikeModelNames('openrouter', key); }

  /* Claude: 이 열쇠로 쓸 수 있는 채팅 모델 이름들 */
  function claudeModelNames(key) {
    return callJson('https://api.anthropic.com/v1/models?limit=100', {
      method: 'GET',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    }).then(function (data) {
      var ids = ((data && data.data) || []).map(function (m) { return String((m && m.id) || ''); });
      return rankModels(ids.filter(function (id) { return /^claude-/.test(id); }));
    });
  }

  /* 500·503에서 예비 모델로 다시 시도하는 최대 횟수 (한 모델이 성공하면 바로 끝) */
  var SERVER_RETRY_MAX = 2;

  /* 429(잠깐 숨 고르기)에서 다른 모델로 다시 시도하는 최대 횟수
     — OpenRouter는 ':free' 모델마다 레이트리밋이 따로라서 옆 모델로 넘어가면 바로 되는 때가 많아요 */
  var RATE_LIMIT_RETRY_MAX = 3;

  /* 서버 쪽이 잠깐 막힌 건지 (500 · 502 · 503 · 504 …) */
  function isServerTrouble(err) {
    return !!(err && typeof err.status === 'number' && err.status >= 500);
  }

  /* 잠깐 숨 고르라는 건지 (429 Too Many Requests) */
  function isRateLimit(err) {
    return !!(err && err.status === 429);
  }

  /* 모델을 차례로 시도: 원래 모델 → (404면) 자동으로 찾은 모델 → 미리 적어 둔 모델
     → (500·503이면) 아직 안 해 본 예비 모델로 최대 2번 더
     → (429면) 다른 예비 모델로 최대 3번 더 */
  function askWithModelFallback(provider, key, attempt, discover) {
    var memoKey = provider + '|' + key;
    var memo = modelMemo[memoKey];
    var defaultModel = MODEL_DEFAULT[provider];
    var pending = [];
    var tried = [];
    var lastErr = null;
    var stage = 0;
    var serverRetries = 0;
    var rateRetries = 0;
    var rateLimited = []; /* 429였던 모델 이름들 (모두 429면 안내에 짧게 보여 줘요) */
    var discovered = null; /* 목록 조회로 알아낸 모델들 (한 번 받아 오면 다시 안 받아요) */

    if (memo && memo !== defaultModel) pending.push(memo);
    pending.push(defaultModel);

    function finish() {
      var err = lastErr || { status: 404, code: 'HTTP' };
      err.triedModels = tried.slice();
      if (isRateLimit(err) && rateLimited.length) err.rateLimited = rateLimited.slice();
      err.provider = provider;
      throw err;
    }

    /* 아직 안 해 본 모델만 추려 줄을 세우고 하나 시도해요 (남는 게 없으면 null) */
    function queueFrom(list) {
      pending = (list || []).filter(function (m) { return tried.indexOf(m) < 0; });
      return pending.length ? next() : null;
    }

    /* 모델 목록 조회는 한 번만 (실패하면 빈 목록으로 굳혀서 다시 안 물어봐요) */
    function fetchModels() {
      if (stage === 0) stage = 1; /* advance()가 목록을 또 받아 오지 않게 */
      return discover(key).then(function (models) {
        discovered = models || [];
        return discovered;
      }, function (err) {
        discovered = [];
        throw err;
      });
    }

    /* 500·503: 모델 목록 조회(404용)는 건너뛰고, 아직 안 해 본 예비 모델부터 바로 넣어요 */
    function retryWithBackup() {
      if (pending.length) return next();
      return queueFrom(discovered) || queueFrom(MODEL_FALLBACKS[provider]) || finish();
    }

    /* 429: 남은 후보 → 목록 조회로 알아낸 다른 모델 → 미리 적어 둔 예비 모델 순서로 넘어가요.
       같은 모델을 다시 부르면 또 429라서, 이때 고른 모델은 modelMemo에 남기지 않아요. */
    function retryAfterRateLimit() {
      if (pending.length) return next();
      var q = queueFrom(discovered) || queueFrom(MODEL_FALLBACKS[provider]);
      if (q) return q;
      if (discovered !== null) return finish();
      /* 목록을 아직 안 받아 왔으면 한 번 받아 와서 다른 모델(예: 다른 ':free')을 찾아요 */
      return fetchModels().then(function () {
        return queueFrom(discovered) || finish();
      }, function () { return finish(); });
    }

    function next() {
      if (!pending.length) return advance();
      var model = pending.shift();
      if (tried.indexOf(model) > -1) return next();
      tried.push(model);
      return attempt(model).then(function (text) {
        /* 이름이 바뀌어 404를 피해 찾아낸 모델만 기억해요.
           잠깐 503이나 429라 넘어간 예비 모델은 기억해 두지 않고, 다음엔 원래 모델부터 다시 시도해요. */
        if (lastErr && isModelMissing(lastErr)) modelMemo[memoKey] = model;
        return text;
      }, function (err) {
        if (isRateLimit(err)) {
          lastErr = err;
          if (rateLimited.indexOf(model) < 0) rateLimited.push(model);
          if (rateRetries < RATE_LIMIT_RETRY_MAX) { rateRetries++; return retryAfterRateLimit(); }
          return finish();
        }
        if (isModelMissing(err)) { lastErr = err; return next(); }
        if (isServerTrouble(err)) {
          lastErr = err;
          if (serverRetries < SERVER_RETRY_MAX) { serverRetries++; return retryWithBackup(); }
          return finish();
        }
        throw err;
      });
    }

    function advance() {
      if (stage === 0) {
        return fetchModels().then(function () {
          return queueFrom(discovered) || advance();
        }, function () { return advance(); });
      }
      if (stage === 1) {
        stage = 2;
        return queueFrom(MODEL_FALLBACKS[provider]) || finish();
      }
      return finish();
    }

    return next();
  }

  function geminiText(data) {
    var cand = data && data.candidates && data.candidates[0];
    var parts = (cand && cand.content && cand.content.parts) || [];
    var text = parts.map(function (p) { return p.text || ''; }).join('').trim();
    if (!text) throw { code: 'EMPTY' };
    return text;
  }

  function askGemini(key, sys, hist) {
    var contents = toGemini(hist);
    return askWithModelFallback('gemini', key, function (model) {
      function post(withThinking) {
        var gen = { temperature: 0.9, maxOutputTokens: 700 };
        if (withThinking) gen.thinkingConfig = { thinkingBudget: 0 };
        var url = GEMINI_BASE + '/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
        return callJson(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents: contents,
            generationConfig: gen
          })
        }).then(geminiText);
      }
      /* thinking 설정을 모르는 모델이면 그 설정만 빼고 한 번 더 */
      return post(true).then(null, function (err) {
        if (isThinkingIssue(err)) return post(false);
        throw err;
      });
    }, geminiModelNames);
  }

  /* OpenAI와 같은 모양인 곳(OpenAI · Groq · OpenRouter)에 물어봐요 */
  function askOpenaiLike(provider, key, sys, hist) {
    var msgs = [{ role: 'system', content: sys }].concat(hist.map(function (h) {
      return { role: h.role, content: h.text };
    }));
    var ep = OPENAI_COMPAT[provider] || OPENAI_COMPAT.openai;
    var discover = provider === 'groq' ? groqModelNames
      : provider === 'openrouter' ? openrouterModelNames
      : openaiModelNames;
    return askWithModelFallback(provider, key, function (model) {
      /* 예전 모델은 max_tokens·temperature, 새 모델은 max_completion_tokens 를 써요 */
      function post(oldStyle) {
        var body = { model: model, messages: msgs };
        if (oldStyle) { body.max_tokens = 600; body.temperature = 0.9; }
        else body.max_completion_tokens = 600;
        return callJson(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify(body)
        }).then(function (data) {
          var ch = data && data.choices && data.choices[0];
          var text = ch && ch.message && ch.message.content;
          if (!text) throw { code: 'EMPTY' };
          return String(text).trim();
        });
      }
      return post(true).then(null, function (err) {
        if (err && err.status === 400 && /max_tokens|max_completion_tokens|temperature/i.test(errText(err))) {
          return post(false);
        }
        throw err;
      });
    }, discover);
  }

  function askOpenai(key, sys, hist) { return askOpenaiLike('openai', key, sys, hist); }

  function askClaude(key, sys, hist) {
    var msgs = hist.map(function (h) { return { role: h.role, content: h.text }; });
    return askWithModelFallback('claude', key, function (model) {
      return callJson('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: model, max_tokens: 600, system: sys, messages: msgs })
      }).then(function (data) {
        var text = ((data && data.content) || []).map(function (b) { return b.text || ''; }).join('').trim();
        if (!text) throw { code: 'EMPTY' };
        return text;
      });
    }, claudeModelNames);
  }

  function askAI(id, opts) {
    var ai = aiById(id);
    if (!ai) return Promise.reject({ code: 'GONE' });
    var provider = ai.provider;
    var key = String(ai.apiKey || '').trim();
    if (!key) return Promise.reject({ code: 'NO_KEY' });
    var sys = systemPrompt(id, opts);
    var hist = buildHistory(id);
    if (opts && opts.battle) hist.push({ role: 'user', text: battlePromptFor(id) });

    if (OPENAI_COMPAT[provider]) return askOpenaiLike(provider, key, sys, hist);
    if (provider === 'claude') return askClaude(key, sys, hist);
    return askGemini(key, sys, hist);
  }

  /* ---------- 공용 공책 (선택) ---------- */
  function dbBase() { return cleanDbUrl(settings.dbUrl); }

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
      messages.forEach(function (m) { known[sig(m)] = m; });
      var added = 0;
      var tagged = 0;
      Object.keys(data).forEach(function (key) {
        var x = data[key];
        if (!x || typeof x.text !== 'string' || !x.who || typeof x.ts !== 'number') return;
        if (x.ts <= (settings.clearedAt || 0)) return;
        var s = sig({ who: x.who, ts: x.ts, text: x.text });
        var tag = (x.roleTag || x.role);
        tag = (tag && typeof tag === 'string' && tag.trim()) ? tag.trim() : '';
        var prev = known[s];
        if (prev) {
          /* 예전에 받아 둔 글에 담당 역할이 없으면 지금이라도 채워 넣어요 */
          if (tag && prev.roleTag !== tag) { prev.roleTag = tag; tagged++; }
          return;
        }
        var got = { who: x.who, text: x.text, ts: x.ts };
        if (tag) got.roleTag = tag;
        known[s] = got;
        messages.push(got);
        added++;
      });
      if (added || tagged) {
        if (added) messages.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
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
    var connected = !!dbBase();
    function apply(el, emptyText) {
      if (!el) return;
      if (!connected) { el.textContent = emptyText || ''; el.className = 'db-status'; return; }
      if (dbState === 'ok') { el.textContent = '✓ 공용 공책에 연결됐어요 (3초마다 새 대화를 확인해요)'; el.className = 'db-status ok'; }
      else if (dbState === 'bad') { el.textContent = '연결이 안 돼요. 주소와 규칙(rules)을 확인해 주세요.'; el.className = 'db-status bad'; }
      else { el.textContent = '확인 중…'; el.className = 'db-status'; }
    }
    apply(dbStatusEl, '');
    apply(drawerDbStatusEl, '공용 공책이 연결되지 않았어요. ⚙️에서 연결하면 외부 비서도 여기 보여요.');
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

  /* ---------- 🤖 비서 초대 문구 (다른 AI 비서에게 붙여넣을 글) ---------- */
  function aiInviteText() {
    var base = dbBase();
    var crumb = dbPath();
    var lines = [];
    lines.push('[' + USER_NAME + '님의 비밀 AI 단톡방 초대]');
    lines.push('- 방 이름: ' + settings.roomName);
    lines.push('- 내 호칭: (불릴 이름, 예: 피클2호)');
    lines.push('- 새 글 확인 주기: ' + checkEveryPhrase(checkEvery()));
    lines.push('- 단톡방 주소: ' + inviteUrl());
    lines.push('- 공용 공책 직접 읽기(GET): ' + base + '/' + crumb);
    lines.push('- 공용 공책 글쓰기(POST): ' + base + '/' + crumb);
    lines.push('  형식(JSON): {"id":"임의ID","who":"비서이름","roleTag":"담당역할","text":"메시지","ts":현재ms}');
    lines.push('이 방에 들어가서 ' + USER_NAME + '님(@멘션 또는 최근 대화)에게 인사하고, 앞으로 이 주소로 대화에 참여해 줘!');
    return lines.join(String.fromCharCode(10));
  }

  function copyAiInvite() {
    /* 공용 공책이 없으면 다른 비서가 이 방을 볼 수 없으니 먼저 설정으로 안내해요 */
    if (!dbBase()) {
      openSettings();
      toast('먼저 ⚙️ 설정에서 ‘공용 공책 주소’를 입력해야 다른 비서들이 이 방을 볼 수 있어요!');
      var dbField = $('#setDbUrl');
      if (dbField) {
        try {
          if (dbField.scrollIntoView) dbField.scrollIntoView({ block: 'center' });
          dbField.focus({ preventScroll: true });
        } catch (e) { }
      }
      return;
    }
    var text = aiInviteText();
    function done(ok) {
      toast(ok
        ? '비서 초대 문구를 복사했어요! 다른 비서 채팅창에 붙여넣기 하세요'
        : '복사가 안 됐어요. 다시 한 번 눌러 주세요.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
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
    draftAis = memberList().map(cloneAi);
    renderAiCards();
    renderRoleSummary();
    renderDbStatus();
    var meta = $('#battleMeta');
    if (meta) meta.textContent = battleMetaText();
    setBattleBusy(rankBusy);
    var panel = $('#addAiPanel');
    if (panel) panel.hidden = true;
    var sheetBody = $('.sheet-body');
    if (sheetBody) sheetBody.scrollTop = 0;
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }
  function closeSettings() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    draftAis = null;
  }

  function renderAiCards() {
    if (!draftAis) return;
    if (!draftAis.length) {
      aiCardsEl.innerHTML = '<p class="ai-empty">아직 AI 친구가 없어요. 아래 <b>＋ AI 친구 추가</b>를 눌러 넣어 주세요.<br>외부 비서(아이·피클2호 등)만으로도 채팅은 그대로 쓸 수 있어요.</p>';
      return;
    }
    aiCardsEl.innerHTML = draftAis.map(function (a) {
      var info = providerInfo(a.provider);
      var col = colorsOf(a);
      return '<div class="ai-card' + (a.on ? ' on' : '') + '" data-ai="' + esc(a.id) + '" style="--c1:' + col.c1 + ';--c2:' + col.c2 + '">' +
        '<div class="ai-card-head">' +
        '<div class="avatar">' + esc(String(a.name).charAt(0) || 'A') + '</div>' +
        '<div class="ai-card-title">' +
        '<span class="ai-name-label">AI 이름 (@로 부를 이름)</span>' +
        '<input class="ai-name" data-f="name" value="' + esc(a.name) + '" maxlength="' + NAME_MAX + '" placeholder="예: 야오이" aria-label="AI 이름">' +
        '<div class="ai-kind">' + esc(info.label) + ' · 이름을 고치면 바로 바뀌어요</div>' +
        '</div>' +
        '<label class="switch" title="켜기 / 끄기">' +
        '<input type="checkbox" data-f="on"' + (a.on ? ' checked' : '') + ' aria-label="' + esc(a.name) + ' 켜기">' +
        '<span class="slider"></span>' +
        '</label>' +
        '<button type="button" class="ai-del" data-del="' + esc(a.id) + '" title="이 AI 지우기" aria-label="' + esc(a.name) + ' 지우기">✕</button>' +
        '</div>' +
        '<div class="tier-row">' +
        '<span class="field-label">티어(직급)</span>' +
        '<span class="tier-slot">' + tierTag(a.tier, 'card') + '</span>' +
        '<span class="tier-btns">' + tierStepHTML(a.id, a.tier, false) + '</span>' +
        '</div>' +
        '<label class="field">' +
        '<span class="field-label">담당 역할</span>' +
        '<input class="ai-role" data-f="role" value="' + esc(a.role) + '" maxlength="' + ROLE_MAX + '" placeholder="예: 블로그 원고 담당">' +
        '</label>' +
        '<div class="role-chips">' + ROLE_PRESETS.map(function (r) {
          return '<button type="button" class="role-chip' + (a.role === r ? ' active' : '') + '" data-role="' + esc(r) + '">' + esc(shortRole(r)) + '</button>';
        }).join('') + '</div>' +
        '<div class="field">' +
        '<span class="field-label">AI 열쇠 (API 키)</span>' +
        '<div class="key-row">' +
        '<input class="ai-key" data-f="key" type="password" aria-label="' + esc(a.name) + ' API 키" value="' + esc(a.apiKey) + '" placeholder="열쇠를 붙여 넣으세요" autocomplete="off" spellcheck="false">' +
        '<button type="button" class="ghost-btn sm" data-reveal>보기</button>' +
        '</div>' +
        '</div>' +
        '<label class="field">' +
        '<span class="field-label">성격 한 줄 (선택)</span>' +
        '<input class="ai-persona" data-f="persona" value="' + esc(a.persona) + '" maxlength="' + PERSONA_MAX + '" placeholder="예: 다정한 요리 선생님">' +
        '</label>' +
        '<div class="ai-foot">열쇠 받는 곳: <a href="' + info.keyUrl + '" target="_blank" rel="noopener">' + esc(info.keySite) + '</a></div>' +
        '</div>';
    }).join('');
  }

  /* 화면에 적힌 값을 편집 중인 목록(draftAis)으로 읽어 와요 */
  function readCards() {
    if (!draftAis) return;
    draftAis.forEach(function (a) {
      var card = aiCardsEl.querySelector('.ai-card[data-ai="' + a.id + '"]');
      if (!card) return;
      var nm = card.querySelector('[data-f="name"]').value.trim();
      a.name = (nm || defaultNameFor(a.provider)).slice(0, NAME_MAX);
      a.role = card.querySelector('[data-f="role"]').value.trim().slice(0, ROLE_MAX);
      a.on = card.querySelector('[data-f="on"]').checked;
      a.apiKey = card.querySelector('[data-f="key"]').value.trim();
      a.persona = card.querySelector('[data-f="persona"]').value.trim().slice(0, PERSONA_MAX);
    });
  }

  function renderRoleSummary() {
    var el = $('#roleSummary');
    if (!el || !draftAis) return;
    var rows = ['<div class="role-row me"><span class="dot" style="--c1:#191919;--c2:#191919"></span><b>' + esc(USER_NAME) + '</b><span class="role-text">시키는 사람 (사장님)</span></div>'];
    draftAis.forEach(function (a) {
      var col = colorsOf(a);
      rows.push('<div class="role-row' + (a.on ? '' : ' off') + '" data-ai="' + esc(a.id) + '" style="--c1:' + col.c1 + ';--c2:' + col.c2 + '">' +
        '<span class="dot"></span><b>' + esc(a.name) + '</b>' +
        tierTag(a.tier, 'sm') +
        '<span class="role-text">' + esc(a.role || '역할이 아직 없어요') + '</span>' +
        (a.on ? '' : '<span class="role-off">꺼짐</span>') +
        '<span class="tier-steps">' + tierStepHTML(a.id, a.tier, true) + '</span>' +
        '</div>');
    });
    var onCount = draftAis.filter(function (a) { return a.on; }).length;
    var note;
    if (!draftAis.length) {
      note = '아직 AI 친구가 없어요. 아래 <b>＋ AI 친구 추가</b>로 직접 넣거나, 🤖 초대 문구로 부른 외부 비서(아이·피클2호 등)는 ☰ 사이드 메뉴에 보여요.';
    } else if (!onCount) {
      note = '켜 둔 AI가 없어서 지금은 아무도 답하지 않아요. 오른쪽 스위치나 ☰ 사이드 메뉴 불빛을 눌러 켜 주세요.';
    } else if (onCount > 1) {
      note = '‘전체 (각자 역할대로)’에게 말하면 위에서부터 한 명씩, 앞사람 답변을 보고 자기 역할만 해요. ▲▼로 티어를 바로 올리고 내릴 수 있어요.';
    } else {
      note = 'AI를 두 명 이상 켜면 역할을 나눠서 이어서 일해요. ▲▼로 티어를 바로 올리고 내릴 수 있어요.';
    }
    el.innerHTML = rows.join('') + '<p class="role-note">' + note + '</p>';
  }

  /* 설정 창 안에서 값을 고치는 대로 ‘역할 한눈에 보기’도 같이 맞춰요 */
  function syncSummary() {
    readCards();
    renderRoleSummary();
  }

  /* ▲ 승급 / ▼ 강등 — 누르는 즉시 반영(저장 안 눌러도 유지) */
  function changeTier(id, delta) {
    if (!draftAis) return;
    readCards();
    var target = null;
    for (var i = 0; i < draftAis.length; i++) if (draftAis[i].id === id) target = draftAis[i];
    if (!target) return;
    var idx = tierIndex(target.tier);
    if (idx < 0) idx = tierIndex(TIER_DEFAULT);
    var nx = idx + delta;
    if (nx < 0 || nx >= TIERS.length) return;
    target.tier = TIERS[nx].key;
    var live = aiById(id);
    if (live) {
      live.tier = target.tier;
      saveSettings();
    }
    battleMetaUpdate();
    var body = $('.sheet-body');
    var sc = body ? body.scrollTop : 0;
    renderAiCards();
    renderRoleSummary();
    if (body) body.scrollTop = sc;
    render();
    toast(target.name + ' → ' + TIERS[nx].name + (delta > 0 ? ' 승급! 🎉' : ' 강등…'));
  }

  /* 이름은 고치고 손을 떼는 순간 바로 반영 (배지·칩·말풍선까지) */
  function applyNameNow(id, raw) {
    if (!draftAis) return;
    var nm = String(raw || '').trim().slice(0, NAME_MAX);
    var draft = null;
    for (var i = 0; i < draftAis.length; i++) if (draftAis[i].id === id) draft = draftAis[i];
    if (!draft) return;
    var live = aiById(id);
    var before = live ? live.name : draft.name;
    if (!nm) nm = defaultNameFor(draft.provider);
    nm = uniqueName(nm, draftAis, id);
    draft.name = nm;
    var card = aiCardsEl.querySelector('.ai-card[data-ai="' + id + '"]');
    if (card) {
      var input = card.querySelector('[data-f="name"]');
      if (input) input.value = nm;
      var av = card.querySelector('.avatar');
      if (av) av.textContent = String(nm).charAt(0) || 'A';
      var chk = card.querySelector('[data-f="on"]');
      if (chk) chk.setAttribute('aria-label', nm + ' 켜기');
      var delBtn = card.querySelector('[data-del]');
      if (delBtn) delBtn.setAttribute('aria-label', nm + ' 지우기');
    }
    if (live) {
      live.name = nm;
      if (!settings.names || typeof settings.names !== 'object') settings.names = {};
      settings.names[id] = nm;
      saveSettings();
    }
    readCards();
    renderRoleSummary();
    render();
    battleMetaUpdate();
    if (nm !== before) toast('이름을 ‘' + nm + '’로 바꿨어요!');
  }

  /* ---------- AI 추가 / 삭제 (설정 창 안에서) ---------- */
  /* ＋ AI 친구 추가 — 이름 칸에 보여 줄 예시 (이미 있는 같은 종류 수에 맞춰 번호) */
  function addNameExample(provider, list) {
    var n = (list || []).filter(function (a) { return a.provider === provider; }).length;
    return '예: ' + defaultNameFor(provider) + (n ? String(n + 1) : '') + ', 유튜브1호';
  }

  function openAddPanel() {
    if (!draftAis) return;
    readCards();
    var sel = $('#newAiProvider');
    var provider = (sel && sel.value) || 'gemini';
    var nameInput = $('#newAiName');
    nameInput.value = '';
    $('#newAiRole').value = '';
    nameInput.placeholder = addNameExample(provider, draftAis);
    $('#addAiPanel').hidden = false;
    try { nameInput.focus(); } catch (e) { }
  }

  function closeAddPanel() {
    var panel = $('#addAiPanel');
    if (panel) panel.hidden = true;
  }

  function addAiMember() {
    if (!draftAis) return;
    readCards();
    var sel = $('#newAiProvider');
    var provider = (sel && sel.value) || 'gemini';
    if (PROVIDERS.indexOf(provider) < 0) provider = 'gemini';
    var name = $('#newAiName').value.trim();
    var role = $('#newAiRole').value.trim();
    if (!name) {
      var sameProvider = draftAis.filter(function (a) { return a.provider === provider; }).length;
      name = defaultNameFor(provider) + (sameProvider ? (sameProvider + 1) : '');
    }
    name = uniqueName(name, draftAis, '');
    var apiKey = '';
    for (var i = 0; i < draftAis.length; i++) {
      if (draftAis[i].provider === provider && draftAis[i].apiKey) { apiKey = draftAis[i].apiKey; break; }
    }
    var ai = {
      id: newMemberId(provider, draftAis),
      provider: provider,
      name: name.slice(0, NAME_MAX),
      role: role.slice(0, ROLE_MAX),
      tier: (function () {
        var sel = $('#newAiTier');
        var v = sel ? sel.value : TIER_DEFAULT;
        return tierIndex(v) > -1 ? v : TIER_DEFAULT;
      })(),
      on: true,
      apiKey: apiKey,
      persona: '',
      colorIndex: nextColorIndex(provider, draftAis)
    };
    draftAis.push(ai);
    renderAiCards();
    renderRoleSummary();
    closeAddPanel();
    toast(ai.name + '를 추가했어요. 아래 ‘저장’을 눌러야 반영돼요!');
    var card = aiCardsEl.querySelector('.ai-card[data-ai="' + ai.id + '"]');
    if (card && card.scrollIntoView) {
      try { card.scrollIntoView({ block: 'center' }); } catch (e) { }
    }
  }

  function removeAiMember(id) {
    if (!draftAis) return;
    readCards();
    var gone = null;
    draftAis = draftAis.filter(function (a) {
      if (a.id === id) { gone = a; return false; }
      return true;
    });
    renderAiCards();
    renderRoleSummary();
    if (gone) toast(gone.name + '를 목록에서 뺐어요. ‘저장’을 누르면 반영돼요.');
  }

  function uniqueName(name, list, exceptId) {
    var base = String(name || '').trim() || 'AI';
    var used = {};
    (list || []).forEach(function (a) {
      if (exceptId && a.id === exceptId) return;
      used[String(a.name).toLowerCase()] = true;
    });
    var out = base.slice(0, NAME_MAX);
    var n = 2;
    while (used[out.toLowerCase()]) {
      out = (base.slice(0, NAME_MAX - 3) + ' ' + n).slice(0, NAME_MAX);
      n++;
    }
    return out;
  }

  function saveSettingsFromModal() {
    if (!draftAis) draftAis = memberList().map(cloneAi);
    readCards();
    var db = cleanDbUrl($('#setDbUrl').value);
    if (db && !isHttpUrl(db)) { toast('공용 공책 주소는 https://로 시작해야 해요'); return; }

    var used = {};
    var renamed = 0;
    var next = draftAis.map(function (a) {
      var nm = String(a.name || '').trim() || defaultNameFor(a.provider);
      var base = nm.slice(0, NAME_MAX);
      var out = base;
      var n = 2;
      while (used[out.toLowerCase()]) {
        out = (base.slice(0, NAME_MAX - 3) + ' ' + n).slice(0, NAME_MAX);
        n++;
      }
      if (out !== a.name) renamed++;
      used[out.toLowerCase()] = true;
      return {
        id: a.id,
        provider: PROVIDERS.indexOf(a.provider) > -1 ? a.provider : 'gemini',
        name: out,
        role: String(a.role || '').slice(0, ROLE_MAX),
        tier: tierIndex(a.tier) > -1 ? a.tier : TIER_DEFAULT,
        on: !!a.on,
        apiKey: String(a.apiKey || ''),
        persona: String(a.persona || '').slice(0, PERSONA_MAX),
        colorIndex: typeof a.colorIndex === 'number' ? a.colorIndex : 0
      };
    });

    settings.roomName = ($('#setRoomName').value.trim() || '우리들 단톡방').slice(0, 24);
    settings.ais = next;
    var names = (settings.names && typeof settings.names === 'object') ? settings.names : {};
    next.forEach(function (a) { names[a.id] = a.name; });
    settings.names = names;
    settings.dbUrl = db;
    settings.dbOff = !db; /* 칸을 비우고 저장하면 이 기기에만 저장 */
    saveSettings();
    updateHash();
    roomInput.value = settings.roomName;
    document.title = settings.roomName + ' · 초간단 AI 단톡방';
    closeSettings();
    render();
    restartSync();
    toast(renamed ? '저장했어요! 이름이 겹친 AI는 뒤에 번호를 붙였어요.' : '저장했어요!');
  }

  /* ---------- 입력창 ---------- */
  function autoGrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }
  function insertMention(name) {
    var focused = document.activeElement === inputEl;
    var start = focused ? (inputEl.selectionStart || 0) : inputEl.value.length;
    var end = focused ? (inputEl.selectionEnd || 0) : inputEl.value.length;
    var val = inputEl.value;
    var token = '@' + name + ' ';
    inputEl.value = val.slice(0, start) + token + val.slice(end);
    var pos = start + token.length;
    inputEl.setSelectionRange(pos, pos);
    inputEl.focus();
    autoGrow();
  }
  /* ‘전체’ 칩: 본문에 박힌 @이름(공백 포함)을 통째로 지워요 */
  function clearMentions() {
    var text = inputEl.value;
    var ranges = scanMentions(text).ranges.slice().sort(function (a, b) { return b[0] - a[0]; });
    ranges.forEach(function (r) { text = text.slice(0, r[0]) + text.slice(r[1]); });
    text = text.replace(/@(전체|모두|다들)/g, ' ');
    text = text.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
    inputEl.value = text;
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
    var aiInviteBtn = $('#btnAiInvite');
    if (aiInviteBtn) aiInviteBtn.addEventListener('click', copyAiInvite);
    $('#btnSettings').addEventListener('click', openSettings);
    badgesEl.addEventListener('click', function (e) {
      if (e.target.closest('.badge')) openSettings();
    });

    chipsEl.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var m = chip.getAttribute('data-mention');
      if (m === '__all') clearMentions();
      else insertMention(m);
    });

    chatEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-settings]')) openSettings();
    });

    modal.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) closeSettings();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeSettings();
      else if (e.key === 'Escape' && drawerEl && !drawerEl.hidden) closeDrawer();
    });

    /* ☰ 사이드 메뉴: 열기/닫기 · 불빛으로 AI 켜기/끄기 · 이름 바로 바꾸기 · 확인 주기 */
    var menuBtn = $('#btnMenu');
    if (menuBtn) menuBtn.addEventListener('click', toggleDrawer);
    if (drawerEl) {
      drawerEl.addEventListener('click', function (e) {
        if (e.target.closest('[data-drawer-close]')) { closeDrawer(); return; }
        var delRosterBtn = e.target.closest('[data-roster-del]');
        if (delRosterBtn) {
          e.preventDefault();
          removeAiFromRoster(delRosterBtn.getAttribute('data-roster-del'));
          return;
        }
        var lightBtn = e.target.closest('[data-toggle-ai]');
        if (lightBtn) {
          e.preventDefault();
          toggleAiFromRoster(lightBtn.getAttribute('data-toggle-ai'));
        }
      });
    }
    if (rosterEl) {
      rosterEl.addEventListener('change', function (e) {
        var inp = e.target.closest('[data-rename]');
        if (!inp) return;
        renameFromRoster(inp.getAttribute('data-rename'), inp.getAttribute('data-kind'), inp.value);
      });
      rosterEl.addEventListener('keydown', function (e) {
        if (!e.target.getAttribute || !e.target.getAttribute('data-rename')) return;
        if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      });
    }
    if (checkEveryEl) checkEveryEl.addEventListener('change', function () { setCheckEvery(checkEveryEl.value); });
    var pullBtn = $('#drawerPull');
    if (pullBtn) pullBtn.addEventListener('click', pullNow);

    /* AI 카드: 열쇠 보기 · 켜기/끄기 · 역할 칩 · 삭제 */
    aiCardsEl.addEventListener('click', function (e) {
      var tierUp = e.target.closest('[data-tier-up]');
      if (tierUp) { e.preventDefault(); changeTier(tierUp.getAttribute('data-tier-up'), 1); return; }
      var tierDown = e.target.closest('[data-tier-down]');
      if (tierDown) { e.preventDefault(); changeTier(tierDown.getAttribute('data-tier-down'), -1); return; }
      var del = e.target.closest('[data-del]');
      if (del) {
        e.preventDefault();
        removeAiMember(del.getAttribute('data-del'));
        return;
      }
      var btn = e.target.closest('[data-reveal]');
      if (btn) {
        var field = btn.closest('.key-row').querySelector('.ai-key');
        var show = field.type === 'password';
        field.type = show ? 'text' : 'password';
        btn.textContent = show ? '숨기기' : '보기';
        return;
      }
      var chip = e.target.closest('[data-role]');
      if (!chip) return;
      var card = chip.closest('.ai-card');
      var field2 = card.querySelector('[data-f="role"]');
      field2.value = chip.getAttribute('data-role');
      card.querySelectorAll('.role-chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
      syncSummary();
    });
    aiCardsEl.addEventListener('change', function (e) {
      var f = e.target.getAttribute('data-f');
      if (f === 'on') {
        var card = e.target.closest('.ai-card');
        if (card) card.classList.toggle('on', e.target.checked);
        syncSummary();
        return;
      }
      /* 이름은 손을 떼는 순간 바로 반영 */
      if (f === 'name') {
        var host = e.target.closest('.ai-card');
        if (host) applyNameNow(host.getAttribute('data-ai'), e.target.value);
      }
    });
    aiCardsEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.getAttribute('data-f') === 'name') {
        e.preventDefault();
        e.target.blur();
      }
    });
    aiCardsEl.addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-f');
      if (f === 'name') {
        var card = e.target.closest('.ai-card');
        var av = card && card.querySelector('.avatar');
        if (av) av.textContent = String(e.target.value.trim()).charAt(0) || 'A';
      }
      if (f === 'role' || f === 'name') syncSummary();
    });

    /* 역할 분담 한눈에 보기에서도 바로 승급/강등 */
    var summaryEl = $('#roleSummary');
    if (summaryEl) {
      summaryEl.addEventListener('click', function (e) {
        var tierUp = e.target.closest('[data-tier-up]');
        if (tierUp) { e.preventDefault(); changeTier(tierUp.getAttribute('data-tier-up'), 1); return; }
        var tierDown = e.target.closest('[data-tier-down]');
        if (tierDown) { e.preventDefault(); changeTier(tierDown.getAttribute('data-tier-down'), -1); }
      });
    }

    /* 🏆 승급전 평가 */
    var battleChip = $('#btnBattle');
    if (battleChip) battleChip.addEventListener('click', startRankBattle);
    var battleModalBtn = $('#battleBtnModal');
    if (battleModalBtn) battleModalBtn.addEventListener('click', startRankBattle);

    /* AI 추가 패널 */
    var addBtn = $('#addAiBtn');
    if (addBtn) addBtn.addEventListener('click', openAddPanel);
    var addCancel = $('#addAiCancel');
    if (addCancel) addCancel.addEventListener('click', closeAddPanel);
    var addConfirm = $('#addAiConfirm');
    if (addConfirm) addConfirm.addEventListener('click', addAiMember);
    var providerSel = $('#newAiProvider');
    if (providerSel) {
      providerSel.addEventListener('change', function () {
        $('#newAiName').placeholder = addNameExample(providerSel.value, draftAis);
      });
    }
    var newName = $('#newAiName');
    if (newName) {
      newName.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addAiMember(); }
      });
    }
    var newRole = $('#newAiRole');
    if (newRole) {
      newRole.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addAiMember(); }
      });
    }

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
    if (creds.db && isHttpUrl(creds.db) && cleanDbUrl(creds.db) !== cleanDbUrl(settings.dbUrl)) {
      settings.dbUrl = cleanDbUrl(creds.db);
      settings.dbOff = false;
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
