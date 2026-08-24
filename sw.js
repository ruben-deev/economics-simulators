// ============================================================================
// Service worker сайта: «сеть прежде всего, кэш — страховка».
//
// Зачем: установка на телефон (PWA) и работа по ссылке без сети — то, что
// раньше умел только скачанный однофайловый dist. Стратегия нарочно
// консервативная: пока сеть есть, всегда отдаётся свежий файл, поэтому
// раскатка новой версии ничем не отличается от сайта без воркера. Кэш
// вступает только когда сети нет — и отдаёт последнее, что видел.
//
// Важно: никакого предзаполнения кэша списком файлов нет. Список пришлось бы
// поддерживать руками, забытый файл ломал бы офлайн молча. Вместо этого
// кэшируется всё, что человек реально открывал, — его игры и будут работать.
// ============================================================================

const CACHE = 'novograd-site-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // сервер рекордов и т.п. — мимо кэша

  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => {
        if (hit) return hit;
        // Навигация без сети и без кэша — отдать витрину, если она есть
        if (req.mode === 'navigate') return caches.match('./');
        return Response.error();
      }),
    ),
  );
});
