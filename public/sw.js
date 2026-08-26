// Commute Mate service worker
// Kept intentionally minimal: this app is server-rendered (TanStack Start),
// so we avoid caching HTML/data responses to prevent stale or broken pages.
// This still satisfies installability checks and caches static assets
// (icons, fonts, JS/CSS bundles) for faster repeat loads.

const CACHE_NAME = "commute-mate-static-v1";

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
          caches.keys().then((keys) =>
                  Promise.all(
                            keys
                              .filter((key) => key !== CACHE_NAME)
                              .map((key) => caches.delete(key))
                          )
                                 )
        );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

                        // Only handle GET requests for same-origin static assets.
                        const url = new URL(request.url);
    const isStaticAsset =
          request.method === "GET" &&
          url.origin === self.location.origin &&
          /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname);

                        if (!isStaticAsset) {
                              // Let navigations/data requests hit the network normally.
      return;
                        }

                        event.respondWith(
                              caches.open(CACHE_NAME).then(async (cache) => {
                                      const cached = await cache.match(request);
                                      const network = fetch(request)
                                        .then((response) => {
                                                    if (response.ok) cache.put(request, response.clone());
                                                    return response;
                                        })
                                        .catch(() => cached);
                                      return cached || network;
                              })
                            );
});
