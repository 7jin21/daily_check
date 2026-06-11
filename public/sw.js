// Inner Mirror Service Worker
// 静的アセット（JS/CSS/画像/フォント）のみキャッシュする。
// ページ・API はキャッシュしない（古いデータを表示しないため）。

const CACHE_NAME = 'inner-mirror-static-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (event.request.method !== 'GET' || url.origin !== location.origin) return

  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|jpg|svg|ico|woff2?)$/.test(url.pathname)

  if (!isStaticAsset) return

  // キャッシュ優先 + バックグラウンドで補充
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached
      const response = await fetch(event.request)
      if (response.ok) cache.put(event.request, response.clone())
      return response
    })
  )
})
