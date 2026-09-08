/**
 * ownerPaymentHistory.js — riwayat pembayaran semua cabang, terpisah dari log Aktivitas,
 * dengan filter cabang & rentang tanggal.
 */
import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { escapeHtml, formatDate, formatRupiah } from '../ui.js';
import { withCache } from '../cache.js';

const CACHE_KEY = 'owner.payments.page';
const METHOD_LABEL = { cash: 'Tunai', transfer: 'Transfer', lainnya: 'Lainnya' };

async function fetchData() {
  const [payments, branches] = await Promise.all([Api.call('owner.payments.list'), Api.call('owner.branches.list')]);
  return { payments, branches };
}

export async function renderOwnerPaymentHistory(container) {
  await withCache(container, CACHE_KEY, fetchData, (data) => initView(container, data));
}

function initView(container, data) {
  const { payments, branches } = data;
  let filterBranch = '';
  let filterMethod = '';
  let filterFrom = '';
  let filterTo = '';

  function filtered() {
    return payments.filter(p => {
      if (filterBranch && p.branch_id !== filterBranch) return false;
      if (filterMethod && p.method !== filterMethod) return false;
      if (filterFrom && p.paid_date < filterFrom) return false;
      if (filterTo && p.paid_date > filterTo) return false;
      return true;
    });
  }

  function renderTable() {
    const rows = filtered();
    const total = rows.reduce((s, p) => s + p.amount, 0);

    container.querySelector('#summary-slot').innerHTML = `
      <div class="card stat-card">
        <div class="stat-icon green">${Icons.card}</div>
        <div>
          <div class="stat-value">${formatRupiah(total)}</div>
          <div class="stat-label">Total ${rows.length} transaksi sesuai filter</div>
        </div>
      </div>
    `;

    container.querySelector('#table-slot').innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tanggal Bayar</th><th>Cabang</th><th>Pelanggan</th><th>Periode</th><th>Jumlah</th><th>Metode</th><th>Diterima Oleh</th><th>Catatan</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(p => `
              <tr>
                <td style="white-space:nowrap">${formatDate(p.paid_date)}</td>
                <td>${escapeHtml(p.branch_name)}</td>
                <td>${escapeHtml(p.customer_name)}</td>
                <td>${escapeHtml(p.period)}</td>
                <td>${formatRupiah(p.amount)}</td>
                <td>${escapeHtml(METHOD_LABEL[p.method] || p.method)}</td>
                <td>${escapeHtml(p.received_by_name)}</td>
                <td>${escapeHtml(p.note || '-')}</td>
              </tr>`).join('') : `<tr><td colspan="8" class="empty-state">${Icons.card}<div>Tidak ada pembayaran yang cocok dengan filter.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="toolbar">
      <select id="branch-filter" style="max-width:200px">
        <option value="">Semua Cabang</option>
        ${branches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
      </select>
      <select id="method-filter" style="max-width:160px">
        <option value="">Semua Metode</option>
        ${Object.entries(METHOD_LABEL).map(([val, label]) => `<option value="${val}">${label}</option>`).join('')}
      </select>
      <input type="date" id="from-filter" title="Dari tanggal" style="max-width:150px" />
      <span class="text-muted">s/d</span>
      <input type="date" id="to-filter" title="Sampai tanggal" style="max-width:150px" />
      <button class="btn btn-ghost btn-sm" id="btn-reset">Reset Filter</button>
      <div class="spacer"></div>
    </div>
    <div id="summary-slot" style="margin-bottom:16px"></div>
    <div id="table-slot"></div>
  `;

  container.querySelector('#branch-filter').addEventListener('change', (e) => { filterBranch = e.target.value; renderTable(); });
  container.querySelector('#method-filter').addEventListener('change', (e) => { filterMethod = e.target.value; renderTable(); });
  container.querySelector('#from-filter').addEventListener('change', (e) => { filterFrom = e.target.value; renderTable(); });
  container.querySelector('#to-filter').addEventListener('change', (e) => { filterTo = e.target.value; renderTable(); });
  container.querySelector('#btn-reset').onclick = () => {
    filterBranch = ''; filterMethod = ''; filterFrom = ''; filterTo = '';
    container.querySelector('#branch-filter').value = '';
    container.querySelector('#method-filter').value = '';
    container.querySelector('#from-filter').value = '';
    container.querySelector('#to-filter').value = '';
    renderTable();
  };

  renderTable();
}
