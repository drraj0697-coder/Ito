/*
 * GitHub Pages-safe, online-first service worker.
 * It caches only this PWA's static shell. The external Flask API is not in this
 * origin and is never intercepted or cached here.
 */
const CACHE = 'medq-online-pages-shell-v1';
const BASE = new URL('./', self.registration.scope);
const SHELL = ['', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']
  .map(file => new URL(file, BASE).href);
const CONFIG_URL = new URL('config.js', BASE).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // config.js is public deployment configuration; always obtain its latest
  // version and do not cache it in the PWA shell.
  if (url.href === CONFIG_URL) {
    event.respondWith(fetch(request));
    return;
  }

  // Never intercept a cross-origin Flask API request.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(BASE.pathname)) {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match(SHELL[0]))));
  }
});
