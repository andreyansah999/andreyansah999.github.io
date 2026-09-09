/**
 * unpaidShared.js — halaman terpisah khusus menampilkan pelanggan yang BELUM lunas
 * bulan ini (menunggu/jatuh tempo/terlambat), dengan aksi cepat catat bayar & on-off wifi.
 * Data sumbernya sama dengan halaman Pelanggan (listAction), hanya disaring di sini.
 */
import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, statusBadge, escapeHtml, formatRupiah } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';
import { openPaymentForm } from './paymentForm.js';

export async function renderUnpaidShared(container, opts) {
  const cacheKey = 'unpaid:' + opts.listAction;
  const fetcher = () => Api.call(opts.listAction);
  await withCache(container, cacheKey, fetcher, (all) => initView(container, opts, cacheKey, fetcher, all));
}

function initView(container, opts, cacheKey, fetcher, all) {
  const { wifiSetAction, recordAction, showBranch } = opts;
  let filterText = '';
  let filterStatus = 'belum_lunas'; // default: tampilkan yang belum lunas saja (tujuan utama halaman ini)

  async function reload() {
    const myToken = captureToken(container);
    const fresh = await fetcher();
    if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
    Cache.set(cacheKey, fresh);
    initView(container, opts, cacheKey, fetcher, fresh);
  }

  // Semua pelanggan aktif dimasukkan (termasuk yang sudah lunas) supaya bisa dipakai
  // untuk mengecek/membandingkan siapa saja yang sudah bayar lewat filter status di bawah.
  const active = all.filter(c => c.status === 'active');
  const counts = {
    lunas: active.filter(c => c.subscription_status === 'lunas').length,
    menunggu: active.filter(c => c.subscription_status === 'menunggu').length,
    jatuh_tempo: active.filter(c => c.subscription_status === 'jatuh_tempo').length,
    terlambat: active.filter(c => c.subscription_status === 'terlambat').length
  };

  function filtered() {
    return active.filter(c => {
      if (filterStatus === 'belum_lunas') { if (c.subscription_status === 'lunas') return false; }
      else if (filterStatus) { if (c.subscription_status !== filterStatus) return false; }
      if (!filterText) return true;
      const t = filterText.toLowerCase();
      return c.name.toLowerCase().includes(t) || String(c.phone || '').includes(t) || (c.pppoe_username || '').toLowerCase().includes(t);
    });
  }

  function renderTableBody() {
    const rows = filtered();
    const tbody = container.querySelector('#table-body');
    if (!tbody) return;
    
    tbody.innerHTML = rows.length ? rows.map(c => `
      <tr>
        ${showBranch ? `<td>${escapeHtml(c.branch_name)}</td>` : ''}
        <td><strong>${escapeHtml(c.name)}</strong>${c.pppoe_username ? `<div class="text-muted" style="font-size:.78rem">${escapeHtml(c.pppoe_username)}</div>` : ''}</td>
        <td>${escapeHtml(c.phone || '-')}</td>
        <td>${escapeHtml(c.package_name)}</td>
        <td>${formatRupiah(c.price)}</td>
        <td>Tgl ${c.due_date_day}</td>
        <td>${statusBadge(c.subscription_status)}</td>
        <td>
          <label class="switch" title="${c.wifi_status === 'on' ? 'Matikan' : 'Nyalakan'} koneksi">
            <input type="checkbox" data-act="wifi" data-id="${c.id}" ${c.wifi_status === 'on' ? 'checked' : ''} />
            <span class="track"></span>
          </label>
        </td>
        <td><button class="btn btn-primary btn-sm" data-act="pay" data-id="${c.id}">${Icons.card}Catat Bayar</button></td>
      </tr>`).join('') : `<tr><td colspan="${showBranch ? 9 : 8}" class="empty-state">${Icons.check}<div>Tidak ada pelanggan yang cocok dengan filter ini.</div></td></tr>`;

    attachTableEvents();
  }

  function attachTableEvents() {
    container.querySelectorAll('[data-act="pay"]').forEach(btn => btn.onclick = () => {
      const customer = active.find(x => x.id === btn.dataset.id);
      openPaymentForm({ customer, recordAction, onSaved: () => reload() });
    });
    container.querySelectorAll('[data-act="wifi"]').forEach(chk => chk.onchange = async () => {
      const action_type = chk.checked ? 'on' : 'off';
      chk.disabled = true;
      try {
        await Api.call(wifiSetAction, { customer_id: chk.dataset.id, action_type });
        toast(action_type === 'on' ? 'Perintah nyalakan terkirim' : 'Perintah matikan terkirim', 'success');
      } catch (err) {
        toast(err.message, 'error');
        chk.checked = !chk.checked;
      } finally { chk.disabled = false; }
    });
  }

  container.innerHTML = `
    <div class="grid grid-4">
      ${statCard('green', counts.lunas, 'Sudah Lunas', 'check')}
      ${statCard('muted', counts.menunggu, 'Belum Jatuh Tempo')}
      ${statCard('amber', counts.jatuh_tempo, 'Masa Tenggang')}
      ${statCard('red', counts.terlambat, 'Terlambat (WiFi Mati)')}
    </div>
    <div class="toolbar" style="margin-top:18px">
      <div class="search-box"><input type="text" id="q" placeholder="Cari nama / telepon / PPPoE..." value="${escapeHtml(filterText)}" /></div>
      <select id="status-filter" style="max-width:220px">
        <option value="belum_lunas" ${filterStatus === 'belum_lunas' ? 'selected' : ''}>Belum Lunas (Semua)</option>
        <option value="menunggu" ${filterStatus === 'menunggu' ? 'selected' : ''}>Belum Jatuh Tempo</option>
        <option value="jatuh_tempo" ${filterStatus === 'jatuh_tempo' ? 'selected' : ''}>Masa Tenggang</option>
        <option value="terlambat" ${filterStatus === 'terlambat' ? 'selected' : ''}>Terlambat</option>
        <option value="lunas" ${filterStatus === 'lunas' ? 'selected' : ''}>Sudah Lunas</option>
        <option value="" ${filterStatus === '' ? 'selected' : ''}>Semua Pelanggan</option>
      </select>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${showBranch ? '<th>Cabang</th>' : ''}
          <th>Nama</th><th>Telepon</th><th>Paket</th><th>Harga</th><th>Jatuh Tempo</th><th>Status</th><th>WiFi</th><th></th>
        </tr></thead>
        <tbody id="table-body"></tbody>
      </table>
    </div>
  `;

  // Event listeners - update hanya filterText/filterStatus, lalu render table body
  container.querySelector('#q').addEventListener('input', (e) => { 
    filterText = e.target.value; 
    renderTableBody(); 
  });
  
  container.querySelector('#status-filter').addEventListener('change', (e) => { 
    filterStatus = e.target.value; 
    renderTableBody(); 
  });

  renderTableBody();
}

function statCard(color, value, label, icon) {
  return `
    <div class="card stat-card">
      <div class="stat-icon ${color}">${Icons[icon || 'alert']}</div>
      <div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>
  `;
}
