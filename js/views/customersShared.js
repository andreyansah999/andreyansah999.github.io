/**
 * customersShared.js — tabel pelanggan dipakai bersama Owner (semua cabang, dengan filter cabang)
 * dan Admin (otomatis terbatas ke cabang sendiri oleh backend).
 */
import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, confirmDialog, statusBadge, escapeHtml, formatRupiah, openModal, closeModal, setLoading } from '../ui.js';
import { openCustomerForm } from './customerForm.js';
import { openImportWizard } from './importCustomers.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

export async function renderCustomersShared(container, opts) {
  const cacheKey = 'page:' + opts.listAction;
  const fetchData = () => fetchAll(opts);
  await withCache(container, cacheKey, fetchData, (data) => initView(container, opts, cacheKey, fetchData, data));
}

async function fetchAll(opts) {
  const { listAction, showBranch } = opts;
  const [customers, branches, pricing] = await Promise.all([
    Api.call(listAction),
    showBranch ? Api.call('owner.branches.list') : Promise.resolve([]),
    Api.call('pricing.list')
  ]);
  return { customers, branches, pricing };
}

function initView(container, opts, cacheKey, fetchData, data) {
  const { saveAction, deleteAction, wifiSetAction, importAction, voidPaymentAction, showBranch } = opts;
  const { customers, branches, pricing } = data;
  let filterText = '';
  let filterBranch = '';
  let filterPayment = '';

  async function reload() {
    const myToken = captureToken(container);
    const fresh = await fetchData();
    if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
    Cache.set(cacheKey, fresh);
    initView(container, opts, cacheKey, fetchData, fresh);
  }

  function filtered() {
    return customers.filter(c => {
      if (filterBranch && c.branch_id !== filterBranch) return false;
      if (filterPayment === 'lunas' && c.subscription_status !== 'lunas') return false;
      if (filterPayment === 'belum_bayar' && c.subscription_status === 'lunas') return false;
      if (filterPayment === 'terlambat' && c.subscription_status !== 'terlambat') return false;
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
        <td>
          <strong>${escapeHtml(c.name)}</strong>
          <div class="text-muted" style="font-size:.78rem">${escapeHtml(c.phone || '-')}${c.pppoe_username ? ' · ' + escapeHtml(c.pppoe_username) : ''}</div>
        </td>
        <td>${escapeHtml(c.package_name)}</td>
        <td>${formatRupiah(c.price)}</td>
        <td>Tgl ${c.due_date_day}</td>
        <td>
          ${statusBadge(c.subscription_status)}
          ${c.subscription_status === 'lunas' ? `<button class="btn btn-ghost btn-sm" data-act="void" data-id="${c.id}" title="Salah catat? Batalkan pembayaran ini">${Icons.edit}</button>` : ''}
        </td>
        <td>
          <label class="switch" title="${c.wifi_status === 'on' ? 'Matikan' : 'Nyalakan'} koneksi">
            <input type="checkbox" data-act="wifi" data-id="${c.id}" ${c.wifi_status === 'on' ? 'checked' : ''} />
            <span class="track"></span>
          </label>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${c.id}">${Icons.edit}</button>
            <button class="btn btn-ghost btn-sm" data-act="del" data-id="${c.id}">${Icons.trash}</button>
          </div>
        </td>
      </tr>`).join('') : `<tr><td colspan="${showBranch ? 8 : 7}" class="empty-state">Tidak ada pelanggan yang cocok.</td></tr>`;

    attachTableEvents();
  }

  function attachTableEvents() {
    container.querySelectorAll('[data-act="edit"]').forEach(b => b.onclick = () => {
      openCustomerForm({
        customer: customers.find(x => x.id === b.dataset.id),
        branches, forcedBranchId: showBranch ? null : true, pricing, saveAction,
        onSaved: () => reload()
      });
    });
    container.querySelectorAll('[data-act="del"]').forEach(b => b.onclick = async () => {
      if (!(await confirmDialog('Hapus pelanggan ini? Riwayat pembayaran tetap tersimpan.', { danger: true, okLabel: 'Hapus' }))) return;
      try { await Api.call(deleteAction, { id: b.dataset.id }); toast('Pelanggan dihapus', 'success'); reload(); }
      catch (err) { toast(err.message, 'error'); }
    });
    container.querySelectorAll('[data-act="void"]').forEach(b => b.onclick = () => {
      const c = customers.find(x => x.id === b.dataset.id);
      openVoidPaymentDialog(c, voidPaymentAction, () => reload());
    });
    container.querySelectorAll('[data-act="wifi"]').forEach(chk => chk.onchange = async () => {
      const action_type = chk.checked ? 'on' : 'off';
      chk.disabled = true;
      try {
        await Api.call(wifiSetAction, { customer_id: chk.dataset.id, action_type });
        toast(action_type === 'on' ? 'Perintah nyalakan wifi terkirim ke antrean' : 'Perintah matikan wifi terkirim ke antrean', 'success');
        const c = customers.find(x => x.id === chk.dataset.id);
        if (c) { c.wifi_status = action_type; c.suspend_reason = action_type === 'off' ? 'manual' : ''; }
        Cache.set(cacheKey, { customers, branches, pricing });
      } catch (err) {
        toast(err.message, 'error');
        chk.checked = !chk.checked;
      } finally { chk.disabled = false; }
    });
  }

  const belumBayarCount = customers.filter(c => c.subscription_status !== 'lunas').length;

  container.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${Icons.search}<input type="text" id="q" placeholder="Cari nama / telepon / PPPoE..." value="${escapeHtml(filterText)}" /></div>
      ${showBranch ? `<select id="branch-filter" style="max-width:200px"><option value="">Semua Cabang</option>${branches.map(b => `<option value="${b.id}" ${filterBranch === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}</select>` : ''}
      <select id="payment-filter" style="max-width:200px">
        <option value="" ${filterPayment === '' ? 'selected' : ''}>Semua Status Bayar</option>
        <option value="belum_bayar" ${filterPayment === 'belum_bayar' ? 'selected' : ''}>Belum Bayar${belumBayarCount ? ' (' + belumBayarCount + ')' : ''}</option>
        <option value="terlambat" ${filterPayment === 'terlambat' ? 'selected' : ''}>Terlambat Saja</option>
        <option value="lunas" ${filterPayment === 'lunas' ? 'selected' : ''}>Sudah Lunas</option>
      </select>
      <div class="spacer"></div>
      <button class="btn btn-ghost" id="btn-import">${Icons.upload}Impor dari SQL</button>
      <button class="btn btn-primary" id="btn-add">${Icons.plus}Tambah Pelanggan</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${showBranch ? '<th>Cabang</th>' : ''}
          <th>Nama</th><th>Paket</th><th>Harga</th><th>Jatuh Tempo</th><th>Status Bayar</th><th>WiFi</th><th></th>
        </tr></thead>
        <tbody id="table-body"></tbody>
      </table>
    </div>
  `;

  // Event listeners - update hanya filterText/filterBranch/filterPayment, lalu render table body
  container.querySelector('#q').addEventListener('input', (e) => { 
    filterText = e.target.value; 
    renderTableBody(); 
  });
  
  const bf = container.querySelector('#branch-filter');
  if (bf) bf.addEventListener('change', (e) => { filterBranch = e.target.value; renderTableBody(); });
  
  container.querySelector('#payment-filter').addEventListener('change', (e) => { 
    filterPayment = e.target.value; 
    renderTableBody(); 
  });

  container.querySelector('#btn-add').onclick = () => {
    if (showBranch && !branches.length) { toast('Tambahkan cabang terlebih dahulu.', 'error'); return; }
    openCustomerForm({ customer: null, branches, forcedBranchId: showBranch ? null : true, pricing, saveAction, onSaved: () => reload() });
  };
  container.querySelector('#btn-import').onclick = () => {
    if (showBranch && !branches.length) { toast('Tambahkan cabang terlebih dahulu.', 'error'); return; }
    const wizard = openImportWizard({ importAction, branches, showBranch });
    wizard.onDone(() => { toast('Data pelanggan hasil impor sudah masuk', 'success'); reload(); });
  };

  renderTableBody();
}

/**
 * Koreksi pelanggan yang salah tercatat "Lunas" (mis. salah pilih nama saat catat bayar).
 * Nominal pembayaran periode ini di riwayat diubah jadi Rp 0 + catatan (bukan dihapus,
 * arsipnya tetap ada), dan status pelanggan dihitung ulang jadi belum bayar lagi.
 */
function openVoidPaymentDialog(customer, voidPaymentAction, onDone) {
  const overlay = openModal(`
    <div class="modal-header"><h3>Koreksi Status Bayar — ${escapeHtml(customer.name)}</h3></div>
    <div class="modal-body">
      <p class="hint" style="margin-top:0">Pelanggan ini tercatat <strong>sudah lunas</strong> bulan ini. Kalau ini salah catat, tindakan ini akan:</p>
      <ul style="margin:0 0 14px 18px;font-size:.85rem;color:var(--text-muted);line-height:1.6">
        <li>Mengubah nominal pembayaran periode ini di Riwayat Pembayaran jadi <strong>Rp 0</strong> (catatan disimpan, tidak dihapus)</li>
        <li>Mengembalikan status pelanggan ke belum bayar (menunggu/jatuh tempo/terlambat sesuai tanggal jatuh temponya)</li>
        <li>Otomatis mengurangi angka "Pendapatan Bulan Ini" di dashboard</li>
      </ul>
      <div class="field"><label>Catatan Koreksi</label><textarea id="void-note" rows="2">Dibatalkan: kesalahan input pembayaran</textarea></div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" id="btn-cancel">Batal</button>
      <button type="button" class="btn btn-danger" id="btn-void">Ya, Koreksi Sekarang</button>
    </div>
  `);
  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#btn-void').onclick = async () => {
    const btn = overlay.querySelector('#btn-void');
    setLoading(btn, true);
    try {
      await Api.call(voidPaymentAction, { customer_id: customer.id, note: overlay.querySelector('#void-note').value });
      closeModal();
      toast('Status pembayaran dikoreksi', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); setLoading(btn, false); }
  };
}
