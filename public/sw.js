const CACHE = "ligtastow-shell-v3"
const APP_SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/ligtastow-icon.svg", "/icon-192.svg", "/icon-512.svg"]

// Install: cache the app shell and offline page
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

// Activate: clean old caches and take control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

// Fetch: network-first for navigation, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Never cache or intercept API requests, auth callbacks or non-GET
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("code") ||
    url.searchParams.has("recovery") ||
    url.searchParams.has("error")
  ) return

  // Navigation requests: network first, fall back to cached shell or offline page
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          const shell = await caches.match("/")
          if (shell) return shell
          return caches.match("/offline.html")
        })
    )
    return
  }

  // Static assets: cache first, update in background
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)))
          }
          return response
        })
        .catch(() => undefined)

      // Return cache immediately if available, otherwise wait for network
      if (cached) {
        // Stale-while-revalidate: return cache now, update in background
        event.waitUntil(networkFetch)
        return cached
      }
      const networkResponse = await networkFetch
      return networkResponse || Response.error()
    })
  )
})

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting()
})
