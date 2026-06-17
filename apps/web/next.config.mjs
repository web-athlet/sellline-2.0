import { fileURLToPath } from 'node:url';
import path from 'node:path';
import withPWAInit from '@ducanh2912/next-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Monorepo root — required so Next's standalone output traces workspace deps
// (@nextgen/utils, @nextgen/types) instead of only apps/web/node_modules.
const monorepoRoot = path.join(__dirname, '..', '..');

// API base the SW should cache. Defaults to the public API host but is overridable
// per-environment so the cache rule still matches behind a different origin.
const apiCacheHost = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.nextgen-crm.com').replace(
  /\/+$/,
  '',
);

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  // Explicit update flow (Block 2): never silently activate a new SW — the
  // PWAUpdatePrompt posts SKIP_WAITING when the user opts in. Losing unsaved
  // form data to a background swap is worse than a one-click reload.
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: false,
    clientsClaim: true,
    runtimeCaching: [
      {
        // NetworkFirst for the live CRM resources — fresh data wins, cache is the
        // offline fallback. 5-min TTL keeps stale reads short-lived.
        // The API uses URI versioning (setGlobalPrefix('api') + version '1'), so
        // real routes are /api/v1/... — match any /api/vN/ to stay version-proof.
        urlPattern: new RegExp(
          `^${apiCacheHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/v\\d+/(contacts|deals|leads)`,
        ),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 300 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif|ico)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static',
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Next 14.2 still nests this under `experimental` (top-level only from Next 15).
  experimental: { outputFileTracingRoot: monorepoRoot },
  transpilePackages: ['@nextgen/utils', '@nextgen/types'],
};

export default withPWA(nextConfig);
