'use strict';

const CACHE_PREFIX = 'wuwei-recipes-';
const CACHE_NAME = CACHE_PREFIX + 'de7dfec73d4a9354';
const base = self.registration.scope;
const index = new URL('index.html', base).href;
const assets = [
  'index.html', 'styles.css', 'app.js', 'recipe-data.js',
  'app.webmanifest', 'icon-192.png', 'icon-512.png', 'hero.jpg',
].map((path) => new URL(path, base).href);
const resourceURLs = new Set(assets);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(assets.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  const navigation = request.mode === 'navigate' && (url.href === base || url.href === index);
  const key = navigation ? index : url.href;
  if (!navigation && !resourceURLs.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !response.redirected) await cache.put(key, response.clone());
    return response;
  })());
});

