import { Serwist, NetworkFirst, StaleWhileRevalidate } from "serwist";
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
      matcher: ({ request }) => request.destination === "document",
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 5,
        plugins: [],
      }),
    },
    {
      matcher: ({ request }) =>
        request.destination === "script" || request.destination === "style",
      handler: new StaleWhileRevalidate({
        cacheName: "static-resources",
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
  ],
});

serwist.addEventListeners();
