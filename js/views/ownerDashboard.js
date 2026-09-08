import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { formatRupiah } from '../ui.js';
import { withCache } from '../cache.js';

export async function renderOwnerDashboard(container) {
  await withCache(container, 'owner.dashboard', () => Api.call('owner.dashboard'), (data) => draw(container, data));
}

function draw(container, data) {
  container.innerHTML = `
    <div class="grid grid-4">
      ${statCard('blue', 'branch', data.total_branches, 'Total Cabang')}
      ${statCard('blue', 'users', data.total_customers, 'Total Pelanggan')}
      ${statCard('amber', 'wifi', data.wifi_off_customers, 'WiFi Sedang Mati')}
      ${statCard('red', 'alert', data.overdue_customers, 'Sudah Jatuh Tempo', '#/unpaid')}
    </div>
    <div class="grid grid-4" style="margin-top:16px">
      ${statCard('green', 'card', formatRupiah(data.revenue_this_month), 'Pendapatan Bulan Ini')}
      ${statCard('red', 'expense', formatRupiah(data.expense_this_month), 'Pengeluaran Bulan Ini', '#/expenses')}
      ${statCard('blue', 'card', formatRupiah(data.revenue_this_month - data.expense_this_month), 'Laba Bersih Bulan Ini')}
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-header">
        <h3>Ringkasan per Cabang</h3>
        <span class="sub">${data.overdue_customers} pelanggan sudah jatuh tempo dari semua cabang</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Cabang</th><th>Pelanggan</th><th>Aktif</th><th>Jatuh Tempo</th><th>WiFi Mati</th><th>Pendapatan</th><th>Pengeluaran</th><th>Laba Bersih</th>
          </tr></thead>
          <tbody>
            ${data.per_branch.length ? data.per_branch.map(b => `
              <tr>
                <td><strong>${b.branch_name}</strong></td>
                <td>${b.total_customers}</td>
                <td>${b.active_customers}</td>
                <td>${b.overdue_customers > 0 ? `<span class="badge badge-danger">${b.overdue_customers}</span>` : '0'}</td>
                <td>${b.wifi_off > 0 ? `<span class="badge badge-warning">${b.wifi_off}</span>` : '0'}</td>
                <td>${formatRupiah(b.revenue_this_month)}</td>
                <td>${formatRupiah(b.expense_this_month)}</td>
                <td>${formatRupiah(b.revenue_this_month - b.expense_this_month)}</td>
              </tr>`).join('') : `<tr><td colspan="8" class="empty-state">Belum ada cabang. Tambahkan lewat menu "Cabang".</td></tr>`}
          </tbody>
        </table>
      </div>
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
