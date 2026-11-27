/* 초간단 AI 단톡방 — service worker (앱 껍데기만 저장, 대화·열쇠는 저장 안 함)
   v14: 멤버별 티어 관리 — 내 AI뿐 아니라 외부 비서·새로 합류한 친구까지 ☰ 방 사람들·⚙️ 멤버 티어에서 ▲/▼로 승급·강등
   v13: '잠깐 숨을 고르고 있어요'(429)가 나도 그 모델은 기억하지 않고 다른 예비 모델(예: 다른 ':free')로 최대 3번 더 시도
   v12: 서버가 500·503으로 막혀도 예비 모델로 최대 2번 더 시도 — 오류 말풍선에 시도한 모델·HTTP 코드·원문 표시 */
const CACHE = 'aigc-shell-v14';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.svg'
];

self.addEventListener('install', (e) => {
  /* cache: 'reload' — 브라우저 임시 저장소에 남은 옛 파일이 아니라 서버의 최신 파일을 받아 둬요 */
  const fresh = ASSETS.map((u) => new Request(u, { cache: 'reload' }));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 다른 사이트(AI API, 공용 공책)는 절대 건드리지 않아요.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put('./index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
