const CACHE_NAME = "message-note-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Supabase へのリクエストは常にネットワーク優先（リアルタイム性を優先）
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin.includes("supabase.co")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (event.request.method === "GET" && res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

// ==========================================================================
// Web Push — アプリを閉じていても届くバックグラウンド通知
// ==========================================================================

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "メッセージノート";
  const options = {
    body: data.body || "あなたを想っています",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: data.room ? `message-note-${data.room}` : "message-note",
    renotify: true,
    data: { url: data.url || "./" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((allClients) => {
      const existing = allClients.find((c) => "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
