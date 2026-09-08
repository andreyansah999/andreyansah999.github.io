import { initRouter } from './router.js';

// Terapkan tema tersimpan sebelum render supaya tidak "flash" warna salah
try {
  const theme = localStorage.getItem('wifimgr_theme');
  if (theme) document.documentElement.setAttribute('data-theme', theme);
} catch (e) {}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

initRouter();

const splash = document.getElementById('splash');
if (splash) setTimeout(() => splash.remove(), 250);
