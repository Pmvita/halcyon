const SHELL = ["/", "/home", "/manifest.json"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open("halcyon-shell-v1").then((cache) => cache.addAll(SHELL)));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
