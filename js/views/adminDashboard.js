import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { formatRupiah } from '../ui.js';
import { withCache } from '../cache.js';

export async function renderAdminDashboard(container) {
  await withCache(container, 'admin.dashboard', () => Api.call('admin.dashboard'), (data) => draw(container, data));
}

function draw(container, data) {
  container.innerHTML = `
    <div class="grid grid-4">
      ${statCard('blue', 'users', data.total_customers, 'Total Pelanggan')}
      ${statCard('green', 'users', data.active_customers, 'Pelanggan Aktif')}
      ${statCard('red', 'alert', data.overdue_customers, 'Sudah Jatuh Tempo', '#/unpaid')}
      ${statCard('amber', 'wifi', data.wifi_off, 'WiFi Sedang Mati', '#/wifi')}
    </div>
    <div class="grid grid-4" style="margin-top:16px">
      ${statCard('green', 'card', formatRupiah(data.revenue_this_month), 'Pendapatan Bulan Ini')}
      ${statCard('red', 'expense', formatRupiah(data.expense_this_month), 'Pengeluaran Bulan Ini')}
      ${statCard('blue', 'card', formatRupiah(data.revenue_this_month - data.expense_this_month), 'Laba Bersih Bulan Ini')}
    </div>
    <div class="card" style="margin-top:18px">
      <div class="card-header"><h3>Catatan</h3></div>
      <p class="text-muted">Pengeluaran (mis. tagihan WiFi ke penyedia) dicatat oleh Owner dan ditampilkan di sini khusus untuk cabang Anda.</p>
    </div>
  `;
}

function statCard(color, icon, value, label, href) {
  const inner = `
    <div class="card stat-card">
      <div class="stat-icon ${color}">${Icons[icon]}</div>
      <div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>
  `;
  return href ? `<a href="${href}" style="text-decoration:none;color:inherit;display:block">${inner}</a>` : inner;
}
