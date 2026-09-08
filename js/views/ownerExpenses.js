/**
 * ownerExpenses.js — Laporan Pengeluaran (khusus Owner). Dipakai untuk mencatat
 * pengeluaran seperti tagihan WiFi per cabang, yang otomatis tampil di kartu
 * "Pengeluaran Bulan Ini" dan tabel Ringkasan per Cabang di Dashboard.
 */
import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, openModal, closeModal, confirmDialog, escapeHtml, setLoading, formatRupiah, formatDate } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

const CACHE_KEY = 'owner.expenses.page';
const CATEGORY_LABEL = { wifi_bill: 'Tagihan WiFi', lainnya: 'Lainnya' };

async function fetchData() {
  const [expenses, branches] = await Promise.all([Api.call('owner.expenses.list'), Api.call('owner.branches.list')]);
  return { expenses, branches };
}

export async function renderOwnerExpenses(container) {
  await withCache(container, CACHE_KEY, fetchData, (data) => draw(container, data.expenses, data.branches));
}

async function reload(container) {
  const myToken = captureToken(container);
  const data = await fetchData();
  if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
  Cache.set(CACHE_KEY, data);
  draw(container, data.expenses, data.branches);
}

function draw(container, expenses, branches) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  container.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-add">${Icons.plus}Tambah Pengeluaran</button>
    </div>
    <div class="card stat-card" style="margin-bottom:16px">
      <div class="stat-icon red">${Icons.expense}</div>
      <div>
        <div class="stat-value">${formatRupiah(total)}</div>
        <div class="stat-label">Total Seluruh Pengeluaran Tercatat</div>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tanggal</th><th>Cabang</th><th>Nama Pengeluaran</th><th>Nominal</th><th>Deskripsi</th><th></th></tr></thead>
        <tbody>
          ${expenses.length ? expenses.map(e => `
            <tr>
              <td>${formatDate(e.expense_date)}</td>
              <td>${escapeHtml(e.branch_name)}</td>
              <td>${escapeHtml(CATEGORY_LABEL[e.category] || e.category)}</td>
              <td>${formatRupiah(e.amount)}</td>
              <td>${escapeHtml(e.description || '-')}</td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${e.id}">${Icons.edit}</button>
                  <button class="btn btn-ghost btn-sm" data-act="del" data-id="${e.id}">${Icons.trash}</button>
                </div>
              </td>
            </tr>`).join('') : `<tr><td colspan="6" class="empty-state">${Icons.expense}<div>Belum ada pengeluaran tercatat.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#btn-add').onclick = () => {
    if (!branches.length) { toast('Tambahkan cabang terlebih dahulu.', 'error'); return; }
    openForm(container, null, branches);
  };
  container.querySelectorAll('[data-act="edit"]').forEach(b => b.onclick = () => openForm(container, expenses.find(x => x.id === b.dataset.id), branches));
  container.querySelectorAll('[data-act="del"]').forEach(b => b.onclick = () => onDelete(container, b.dataset.id));
}

function openForm(container, expense, branches) {
  const today = new Date().toISOString().slice(0, 10);
  const overlay = openModal(`
    <div class="modal-header"><h3>${expense ? 'Edit' : 'Tambah'} Pengeluaran</h3></div>
    <form id="expense-form">
      <div class="modal-body">
        <div class="field">
          <label>Nama Pengeluaran</label>
          <select name="category">
            <option value="wifi_bill" ${expense?.category !== 'lainnya' ? 'selected' : ''}>Tagihan WiFi</option>
            <option value="lainnya" ${expense?.category === 'lainnya' ? 'selected' : ''}>Lainnya</option>
          </select>
        </div>
        <div class="field">
          <label>Cabang</label>
          <select name="branch_id" required>
            ${branches.map(b => `<option value="${b.id}" ${expense?.branch_id === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label>Nominal (Rp)</label><input type="number" name="amount" required value="${expense?.amount || ''}" /></div>
          <div class="field"><label>Tanggal</label><input type="date" name="expense_date" value="${expense?.expense_date ? String(expense.expense_date).slice(0, 10) : today}" /></div>
        </div>
        <div class="field"><label>Deskripsi</label><textarea name="description" rows="2" placeholder="mis. Bayar tagihan internet bulan September">${escapeHtml(expense?.description || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="btn-save">Simpan</button>
      </div>
    </form>
  `);
  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = overlay.querySelector('#btn-save');
    setLoading(btn, true);
    try {
      await Api.call('owner.expenses.save', {
        id: expense?.id, category: fd.get('category'), branch_id: fd.get('branch_id'),
        amount: Number(fd.get('amount')), description: fd.get('description'), expense_date: fd.get('expense_date')
      });
      closeModal();
      toast('Pengeluaran disimpan', 'success');
      reload(container);
    } catch (err) { toast(err.message, 'error'); setLoading(btn, false); }
  });
}

async function onDelete(container, id) {
  if (!(await confirmDialog('Hapus data pengeluaran ini?', { danger: true, okLabel: 'Hapus' }))) return;
  try { await Api.call('owner.expenses.delete', { id }); toast('Pengeluaran dihapus', 'success'); reload(container); }
  catch (err) { toast(err.message, 'error'); }
}
