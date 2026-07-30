import { Serwist, NetworkFirst } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Never serve stale Next.js bundles — mismatched chunks crash the app after deploy.
      matcher: ({ url, request }) =>
        request.destination === "script" ||
        request.destination === "style" ||
        url.pathname.startsWith("/_next/static/"),
      handler: new NetworkFirst({
        cacheName: "static-resources",
        networkTimeoutSeconds: 3,
        plugins: [],
      }),
    },
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 5,
        plugins: [],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        plugins: [],
      }),
    },
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new NetworkFirst({
        cacheName: "images",
        networkTimeoutSeconds: 5,
        plugins: [],
      }),
    },
  ],
});

serwist.addEventListeners();

// Drop old caches from previous SW strategies (e.g. StaleWhileRevalidate).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key === "static-resources" || key.startsWith("serwist-precache"))
          .map(async (key) => {
            // Keep current precache; clear outdated static-resources filled by SWR.
            if (key === "static-resources") await caches.delete(key);
          })
      );
    })()
  );
});
