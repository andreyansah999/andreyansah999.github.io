import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { formatRupiah, formatDate, toast } from '../ui.js';
import { withCache } from '../cache.js';

const FILTERS = [
  { value: 'day', label: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'custom', label: 'Custom' }
];
const DEFAULT_FILTER = 'month';

export async function renderAdminDashboard(container) {
  await loadFilter(container, DEFAULT_FILTER);
}

async function loadFilter(container, filter, range) {
  const params = { filter };
  let cacheKey = 'admin.dashboard:' + filter;
  if (filter === 'custom' && range) {
    params.start = range.start; params.end = range.end;
    cacheKey += ':' + range.start + ':' + range.end;
  }
  await withCache(container, cacheKey, () => Api.call('admin.dashboard', params), (data) => draw(container, data, filter, range));
}

function draw(container, data, filter, customRange) {
  // Draft rentang custom: kalau belum pernah diisi pengguna, mulai dari rentang yang lagi
  // ditampilkan (period_start/end dari filter sebelumnya) supaya tinggal disesuaikan.
  const draft = customRange || { start: data.period_start, end: data.period_end };
  const periodLabel = filter === 'custom' ? `${formatDate(data.period_start)} - ${formatDate(data.period_end)}` : data.period_label;

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
    ${filter === 'custom' ? `
      <div class="toolbar" style="margin-top:-4px">
        <input type="date" id="custom-start" value="${draft.start}" style="max-width:160px" />
        <span class="text-muted">s/d</span>
        <input type="date" id="custom-end" value="${draft.end}" style="max-width:160px" />
        <button type="button" class="btn btn-primary btn-sm" id="btn-apply-custom">Terapkan</button>
      </div>
    ` : ''}
    <div class="grid grid-4">
      ${statCard('green', 'card', formatRupiah(data.revenue), 'Pendapatan ' + periodLabel)}
      ${statCard('red', 'expense', formatRupiah(data.expense), 'Pengeluaran ' + periodLabel)}
      ${statCard('blue', 'card', formatRupiah(data.revenue - data.expense), 'Laba Bersih ' + periodLabel)}
    </div>
    <div class="card" style="margin-top:18px">
      <div class="card-header"><h3>Catatan</h3></div>
      <p class="text-muted">Pengeluaran (mis. tagihan WiFi ke penyedia) dicatat oleh Owner dan ditampilkan di sini khusus untuk cabang Anda.</p>
    </div>
  `;

  container.querySelectorAll('#period-filter [data-filter]').forEach(btn => {
    btn.onclick = () => {
      const f = btn.dataset.filter;
      if (f === 'custom') {
        // Cuma tampilkan date picker dulu (pakai data filter sebelumnya) - belum fetch
        // sampai pengguna benar-benar pilih tanggal & klik Terapkan.
        draw(container, data, 'custom', draft);
      } else {
        loadFilter(container, f);
      }
    };
  });

  if (filter === 'custom') {
    container.querySelector('#btn-apply-custom').onclick = () => {
      const start = container.querySelector('#custom-start').value;
      const end = container.querySelector('#custom-end').value;
      if (!start || !end) { toast('Isi tanggal "dari" dan "sampai" dulu', 'error'); return; }
      loadFilter(container, 'custom', { start, end });
    };
  }
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
