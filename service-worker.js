/**
 * service-worker.js
 * App-shell caching sederhana supaya PWA bisa diinstal & tetap buka (offline shell) walau
 * koneksi hilang sesaat. Data selalu diambil live dari API (network-first untuk request API).
 */
const CACHE_NAME = 'anternet-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './icons/logo192.png',
  './icons/logo512.png',
  './img/brand-wordmark.png',
  './js/main.js',
  './js/config.js',
  './js/state.js',
  './js/cache.js',
  './js/api.js',
  './js/icons.js',
  './js/ui.js',
  './js/router.js',
  './js/lib/sqlImport.js',
  './js/views/login.js',
  './js/views/customerForm.js',
  './js/views/customersShared.js',
  './js/views/importCustomers.js',
  './js/views/wifiShared.js',
  './js/views/unpaidShared.js',
  './js/views/paymentForm.js',
  './js/views/ownerUnpaid.js',
  './js/views/adminUnpaid.js',
  './js/views/ownerDashboard.js',
  './js/views/ownerBranches.js',
  './js/views/ownerAdmins.js',
  './js/views/ownerCustomers.js',
  './js/views/ownerPricing.js',
  './js/views/ownerExpenses.js',
  './js/views/ownerWifi.js',
  './js/views/ownerActivity.js',
  './js/views/ownerPaymentHistory.js',
  './js/views/ownerSettings.js',
  './js/views/adminDashboard.js',
  './js/views/adminCustomers.js',
  './js/views/adminWifi.js',
  './js/views/adminPayments.js',
  './js/views/adminBranch.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // jangan cache POST (semua panggilan API pakai POST)

  // Jangan cache panggilan ke Apps Script (harus selalu live)
  if (req.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
