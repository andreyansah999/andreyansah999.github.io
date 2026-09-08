/**
 * ownerActivity.js — log aktivitas sistem (login, tambah/edit/hapus data, on-off wifi, dll).
 * Histori pembayaran TIDAK ditampilkan di sini lagi - lihat menu "Riwayat Pembayaran" terpisah.
 */
import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { escapeHtml, formatDateTime } from '../ui.js';
import { withCache } from '../cache.js';

const CACHE_KEY = 'owner.activity.page';
const LIMIT_OPTIONS = [20, 50, 100, 'all'];

async function fetchData() {
  // Ambil cukup banyak dari server (500) supaya pilihan "Semua" di filter tampilan tetap
  // berisi walau melebihi batas tampilan default; ini bukan batas TAMPILAN, cuma batas
  // seberapa jauh riwayat yang diambil dari server sekali panggil.
  const [activity, branches] = await Promise.all([Api.call('owner.activity', { limit: 500 }), Api.call('owner.branches.list')]);
  return { activity, branches };
}

export async function renderOwnerActivity(container) {
  await withCache(container, CACHE_KEY, fetchData, (data) => initView(container, data));
}

function initView(container, data) {
  const branchName = {};
  data.branches.forEach(b => { branchName[b.id] = b.name; });
  // Histori pembayaran (record_payment) sengaja disaring keluar - sudah ada halaman sendiri.
  const rows = data.activity.filter(r => r.action !== 'record_payment');

  let filterBranch = '';
  let filterFrom = '';
  let filterTo = '';
  let displayLimit = 20; // default dibatasi 20 baris, bisa diperlebar lewat filter di bawah tabel

  function filtered() {
    return rows.filter(r => {
      if (filterBranch && r.branch_id !== filterBranch) return false;
      const d = String(r.timestamp).slice(0, 10);
      if (filterFrom && d < filterFrom) return false;
      if (filterTo && d > filterTo) return false;
      return true;
    });
  }

  function renderTable() {
    const f = filtered();
    const shown = displayLimit === 'all' ? f : f.slice(0, displayLimit);
    container.querySelector('#table-slot').innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Waktu</th><th>Pelaku</th><th>Cabang</th><th>Aksi</th><th>Detail</th></tr></thead>
          <tbody>
            ${shown.length ? shown.map(r => `
              <tr>
                <td style="white-space:nowrap">${formatDateTime(r.timestamp)}</td>
                <td>${escapeHtml(r.actor_name)} <span class="text-muted">(${escapeHtml(r.role)})</span></td>
                <td>${escapeHtml(branchName[r.branch_id] || (r.branch_id ? r.branch_id : '-'))}</td>
                <td>${escapeHtml(r.action)}</td>
                <td>${escapeHtml(r.detail)}</td>
              </tr>`).join('') : `<tr><td colspan="5" class="empty-state">${Icons.activity}<div>Tidak ada aktivitas yang cocok dengan filter.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="toolbar" style="margin-top:10px">
        <span class="text-muted" style="font-size:.82rem">Menampilkan ${shown.length} dari ${f.length} aktivitas yang cocok.</span>
        <div class="spacer"></div>
        <label class="text-muted" style="font-size:.82rem;white-space:nowrap">Tampilkan:</label>
        <select id="limit-filter" style="max-width:110px">
          ${LIMIT_OPTIONS.map(opt => `<option value="${opt}" ${displayLimit === opt ? 'selected' : ''}>${opt === 'all' ? 'Semua' : opt}</option>`).join('')}
        </select>
      </div>
    `;
    container.querySelector('#limit-filter').addEventListener('change', (e) => {
      displayLimit = e.target.value === 'all' ? 'all' : Number(e.target.value);
      renderTable();
    });
  }

  container.innerHTML = `
    <div class="toolbar">
      <select id="branch-filter" style="max-width:200px">
        <option value="">Semua Cabang</option>
        ${data.branches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
      </select>
      <input type="date" id="from-filter" title="Dari tanggal" style="max-width:150px" />
      <span class="text-muted">s/d</span>
      <input type="date" id="to-filter" title="Sampai tanggal" style="max-width:150px" />
      <button class="btn btn-ghost btn-sm" id="btn-reset">Reset Filter</button>
      <div class="spacer"></div>
    </div>
    <div id="table-slot"></div>
  `;

  container.querySelector('#branch-filter').addEventListener('change', (e) => { filterBranch = e.target.value; renderTable(); });
  container.querySelector('#from-filter').addEventListener('change', (e) => { filterFrom = e.target.value; renderTable(); });
  container.querySelector('#to-filter').addEventListener('change', (e) => { filterTo = e.target.value; renderTable(); });
  container.querySelector('#btn-reset').onclick = () => {
    filterBranch = ''; filterFrom = ''; filterTo = '';
    container.querySelector('#branch-filter').value = '';
    container.querySelector('#from-filter').value = '';
    container.querySelector('#to-filter').value = '';
    renderTable();
  };

  renderTable();
}
