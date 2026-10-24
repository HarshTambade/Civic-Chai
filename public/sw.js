const CACHE_VERSION = 'civicchai-v9'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const APP_SHELL = [
  '/',
  '/citizen',
  '/chai-tapri',
  '/voice-agent',
  '/offline',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-light-32x32.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === '/api/public/issues' || url.pathname.startsWith('/api/public/issues/') || url.pathname === '/api/public/registry') {
    event.respondWith((async () => {
      const cache = await caches.open(`${CACHE_VERSION}-public-data`)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch {
        const cached = await cache.match(request)
        if (cached) return cached
        const empty = url.pathname === '/api/public/registry'
          ? { jurisdictions: [], hubs: [], officers: [], documents: [], sla_targets: [], offline: true }
          : url.pathname.startsWith('/api/public/issues/')
            ? { issue: null, offline: true }
            : { issues: [], offline: true }
        return Response.json(empty, { headers: { 'X-CivicChai-Offline': '1' } })
      }
    })())
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const path = url.pathname
      const isPublicAppRoute = ['/', '/citizen', '/chai-tapri', '/voice-agent', '/about', '/how-it-works', '/offline'].includes(path) || path.startsWith('/issues/')
      const cache = await caches.open(SHELL_CACHE)
      try {
        const response = await fetch(request)
        if (response.ok && isPublicAppRoute) await cache.put(request, response.clone())
        return response
      } catch {
        if (!isPublicAppRoute) return (await cache.match('/')) || (await cache.match('/offline')) || Response.error()
        return (await cache.match(request)) || (await cache.match(path)) || (await cache.match('/')) || (await cache.match('/offline')) || Response.error()
      }
    })())
    return
  }

  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response.clone())
      return response
    })())
  }
})
