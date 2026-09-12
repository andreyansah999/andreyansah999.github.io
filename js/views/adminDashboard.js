import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { formatRupiah } from '../ui.js';
import { withCache } from '../cache.js';

const FILTERS = [
  { value: 'day', label: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' }
];
const DEFAULT_FILTER = 'month';

export async function renderAdminDashboard(container) {
  await loadFilter(container, DEFAULT_FILTER);
}

async function loadFilter(container, filter) {
  await withCache(container, 'admin.dashboard:' + filter, () => Api.call('admin.dashboard', { filter }), (data) => draw(container, data, filter));
}

function draw(container, data, filter) {
  container.innerHTML = `
    <div class="grid grid-4">
      ${statCard('blue', 'users', data.total_customers, 'Total Pelanggan')}
      ${statCard('green', 'users', data.active_customers, 'Pelanggan Aktif')}
      ${statCard('red', 'alert', data.overdue_customers, 'Sudah Jatuh Tempo', '#/unpaid')}
      ${statCard('amber', 'wifi', data.wifi_off, 'WiFi Sedang Mati', '#/wifi')}
    </div>

    <div class="card-header" style="margin-top:22px;margin-bottom:8px">
      <h3>Laporan Keuangan</h3>
      <div class="period-filter" id="period-filter">
        ${FILTERS.map(f => `<button type="button" class="period-filter-btn ${f.value === filter ? 'active' : ''}" data-filter="${f.value}">${f.label}</button>`).join('')}
      </div>
    </div>
    <div class="grid grid-4">
      ${statCard('green', 'card', formatRupiah(data.revenue), 'Pendapatan ' + data.period_label)}
      ${statCard('red', 'expense', formatRupiah(data.expense), 'Pengeluaran ' + data.period_label)}
      ${statCard('blue', 'card', formatRupiah(data.revenue - data.expense), 'Laba Bersih ' + data.period_label)}
    </div>
    <div class="card" style="margin-top:18px">
      <div class="card-header"><h3>Catatan</h3></div>
      <p class="text-muted">Pengeluaran (mis. tagihan WiFi ke penyedia) dicatat oleh Owner dan ditampilkan di sini khusus untuk cabang Anda.</p>
    </div>
  `;

  container.querySelectorAll('#period-filter [data-filter]').forEach(btn => {
    btn.onclick = () => loadFilter(container, btn.dataset.filter);
  });
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
