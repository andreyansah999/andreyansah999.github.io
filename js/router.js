/**
 * router.js — hash router + app shell (sidebar/topbar) + guard login/role.
 */
import { State } from './state.js';
import { Icons } from './icons.js';
import { Api } from './api.js';
import { toast } from './ui.js';

import { renderLogin } from './views/login.js';
import { renderOwnerDashboard } from './views/ownerDashboard.js';
import { renderOwnerBranches } from './views/ownerBranches.js';
import { renderOwnerAdmins } from './views/ownerAdmins.js';
import { renderOwnerCustomers } from './views/ownerCustomers.js';
import { renderOwnerUnpaid } from './views/ownerUnpaid.js';
import { renderOwnerPricing } from './views/ownerPricing.js';
import { renderOwnerExpenses } from './views/ownerExpenses.js';
import { renderOwnerWifi } from './views/ownerWifi.js';
import { renderOwnerActivity } from './views/ownerActivity.js';
import { renderOwnerPaymentHistory } from './views/ownerPaymentHistory.js';
import { renderOwnerSettings } from './views/ownerSettings.js';
import { renderAdminDashboard } from './views/adminDashboard.js';
import { renderAdminCustomers } from './views/adminCustomers.js';
import { renderAdminUnpaid } from './views/adminUnpaid.js';
import { renderAdminWifi } from './views/adminWifi.js';
import { renderAdminPayments } from './views/adminPayments.js';
import { renderAdminBranch } from './views/adminBranch.js';

const OWNER_NAV = [
  { path: 'dashboard', label: 'Dashboard', icon: 'dashboard', render: renderOwnerDashboard },
  { path: 'branches', label: 'Cabang', icon: 'branch', render: renderOwnerBranches },
  { path: 'admins', label: 'Admin Cabang', icon: 'users', render: renderOwnerAdmins },
  { path: 'customers', label: 'Pelanggan', icon: 'users', render: renderOwnerCustomers },
  { path: 'unpaid', label: 'Tagihan', icon: 'alert', render: renderOwnerUnpaid },
  { path: 'pricing', label: 'Harga Berlangganan', icon: 'price', render: renderOwnerPricing },
  { path: 'expenses', label: 'Pengeluaran', icon: 'expense', render: renderOwnerExpenses },
  { path: 'wifi', label: 'Kontrol & Monitor WiFi', icon: 'wifi', render: renderOwnerWifi },
  { path: 'payment_history', label: 'Riwayat Pembayaran', icon: 'card', render: renderOwnerPaymentHistory },
  { path: 'activity', label: 'Aktivitas', icon: 'activity', render: renderOwnerActivity },
  { path: 'settings', label: 'Pengaturan', icon: 'settings', render: renderOwnerSettings },
];

const ADMIN_NAV = [
  { path: 'dashboard', label: 'Dashboard', icon: 'dashboard', render: renderAdminDashboard },
  { path: 'customers', label: 'Pelanggan', icon: 'users', render: renderAdminCustomers },
  { path: 'unpaid', label: 'Tagihan', icon: 'alert', render: renderAdminUnpaid },
  { path: 'wifi', label: 'Kontrol & Monitor WiFi', icon: 'wifi', render: renderAdminWifi },
  { path: 'payments', label: 'Pembayaran', icon: 'card', render: renderAdminPayments },
  { path: 'branch', label: 'Profil Cabang', icon: 'building', render: renderAdminBranch },
];

function currentNav() {
  return State.isOwner() ? OWNER_NAV : ADMIN_NAV;
}

export function initRouter() {
  window.addEventListener('hashchange', route);
  route();
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  return h || 'dashboard';
}

// Setiap navigasi menaikkan token ini. Kalau proses ambil-data suatu halaman baru selesai
// SETELAH pengguna sudah pindah ke halaman lain (mis. jaringan lambat), token yang direkam
// halaman itu sudah tidak sama dengan token terkini -> halaman TIDAK BOLEH lagi menimpa
// tampilan yang sekarang aktif. Ini mencegah "halaman lain muncul sendiri" saat pindah-pindah
// menu dengan cepat. Lihat cache.js (withCache) yang memakai token ini.
let routeToken = 0;

async function route() {
  const app = document.getElementById('app');

  if (!State.isLoggedIn()) {
    app.innerHTML = '';
    app.appendChild(renderLogin(() => { location.hash = '#/dashboard'; }));
    return;
  }

  const path = parseHash();
  const nav = currentNav();
  const item = nav.find((n) => n.path === path) || nav[0];

  if (!document.getElementById('app-shell')) {
    buildShell(app);
    document.title = State.appName + ' - ' + (State.user.branch ? State.user.branch.name : 'Owner');
  }
  syncActiveNav(item.path);
  document.getElementById('topbar-title').textContent = item.label;

  const content = document.getElementById('content');
  routeToken += 1;
  const myToken = routeToken;
  content._token = myToken;
  content.innerHTML = '<div class="empty-state"><span class="spinner" style="border-top-color:var(--primary);border-color:var(--border)"></span></div>';
  setTopbarLoading(true);
  try {
    await item.render(content);
  } catch (e) {
    if (content._token === myToken) {
      content.innerHTML = `<div class="card"><p><strong>Gagal memuat:</strong> ${e.message || e}</p></div>`;
    }
  } finally {
    // Cuma matikan indikator loading kalau navigasi ini masih yang terbaru - kalau pengguna
    // sudah pindah halaman lagi selama proses ini, biarkan navigasi terbaru yang menentukan.
    if (content._token === myToken) setTopbarLoading(false);
  }
}

function setTopbarLoading(isLoading) {
  const el = document.getElementById('topbar-loading');
  if (el) el.hidden = !isLoading;
}

function buildShell(app) {
  const nav = currentNav();
  const user = State.user;
  const initials = (user.full_name || user.username || '?').trim().slice(0, 1).toUpperCase();

  app.innerHTML = `
    <div class="app-shell" id="app-shell">
      <div class="sidebar-backdrop" id="backdrop"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <img src="icons/logo192.png" alt="${State.appName}" class="logo-badge" />
          <div><strong>${State.appName}</strong><span>${user.role === 'owner' ? 'Owner Panel' : 'Admin Cabang'}</span></div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav">
          ${nav.map(n => `<a href="#/${n.path}" class="nav-item" data-path="${n.path}">${Icons[n.icon]}<span>${n.label}</span></a>`).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-avatar">${initials}</div>
            <div class="user-meta">
              <strong>${user.full_name || user.username}</strong>
              <span>${user.branch ? user.branch.name : 'Semua Cabang'}</span>
            </div>
            <button class="icon-btn" id="btn-logout" title="Keluar">${Icons.logout}</button>
          </div>
        </div>
      </aside>
      <div class="main-col">
        <header class="topbar">
          <button class="hamburger" id="btn-hamburger">${Icons.menu}</button>
          <h2 id="topbar-title">Dashboard</h2>
          <span class="topbar-loading" id="topbar-loading" hidden title="Sedang memuat data terbaru..."></span>
          <button class="icon-btn" id="btn-theme" title="Ganti tema">${Icons.moon}</button>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>
  `;

  document.getElementById('btn-hamburger').onclick = () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('backdrop').classList.add('show');
  };
  document.getElementById('backdrop').onclick = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('backdrop').classList.remove('show');
  };
  document.querySelectorAll('.nav-item').forEach((a) => {
    a.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('backdrop').classList.remove('show');
    });
  });
  document.getElementById('btn-logout').onclick = async () => {
    try { await Api.call('auth.logout'); } catch (e) {}
    State.clear();
    document.getElementById('app-shell')?.remove();
    location.hash = '#/login';
    toast('Berhasil keluar', 'success');
    route();
  };
  document.getElementById('btn-theme').onclick = toggleTheme;
  applyThemeIcon();
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('wifimgr_theme', next);
  applyThemeIcon();
}

function applyThemeIcon() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const cur = document.documentElement.getAttribute('data-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  btn.innerHTML = cur === 'dark' ? Icons.sun : Icons.moon;
}

function syncActiveNav(path) {
  document.querySelectorAll('.nav-item').forEach((a) => {
    a.classList.toggle('active', a.dataset.path === path);
  });
}
