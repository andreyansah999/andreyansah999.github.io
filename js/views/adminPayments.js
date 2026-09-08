import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, openModal, closeModal, escapeHtml, setLoading, formatRupiah, formatDate } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

const CACHE_KEY = 'admin.payments.page';

async function fetchData() {
  const [payments, customers] = await Promise.all([Api.call('admin.payments.list'), Api.call('admin.customers.list')]);
  return { payments, customers };
}

export async function renderAdminPayments(container) {
  await withCache(container, CACHE_KEY, fetchData, (data) => draw(container, data.payments, data.customers));
}

async function reload(container) {
  const myToken = captureToken(container);
  const data = await fetchData();
  if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
  Cache.set(CACHE_KEY, data);
  draw(container, data.payments, data.customers);
}

function draw(container, payments, customers) {
  container.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-add">${Icons.plus}Catat Pembayaran</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tanggal Bayar</th><th>Pelanggan</th><th>Periode</th><th>Jumlah</th><th>Metode</th><th>Catatan</th></tr></thead>
        <tbody>
          ${payments.length ? payments.map(p => `
            <tr>
              <td>${formatDate(p.paid_date)}</td>
              <td>${escapeHtml(p.customer_name)}</td>
              <td>${escapeHtml(p.period)}</td>
              <td>${formatRupiah(p.amount)}</td>
              <td>${escapeHtml(p.method)}</td>
              <td>${escapeHtml(p.note || '-')}</td>
            </tr>`).join('') : `<tr><td colspan="6" class="empty-state">${Icons.card}<div>Belum ada pembayaran tercatat.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#btn-add').onclick = () => openForm(container, customers);
}

function openForm(container, customers) {
  const options = customers.map(c => `<option value="${c.id}" data-price="${c.price}">${escapeHtml(c.name)} — ${escapeHtml(c.package_name)} (${formatRupiah(c.price)})</option>`).join('');
  const now = new Date();
  const period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const today = now.toISOString().slice(0, 10);

  const overlay = openModal(`
    <div class="modal-header"><h3>Catat Pembayaran</h3></div>
    <form id="payment-form">
      <div class="modal-body">
        <div class="field"><label>Pelanggan</label><select name="customer_id" id="sel-customer" required><option value="">- Pilih Pelanggan -</option>${options}</select></div>
        <div class="field-row">
          <div class="field"><label>Periode (Bulan)</label><input type="month" name="period" value="${period}" required /></div>
          <div class="field"><label>Tanggal Bayar</label><input type="date" name="paid_date" value="${today}" required /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Jumlah (Rp)</label><input type="number" name="amount" id="amount-input" required /></div>
          <div class="field"><label>Metode</label>
            <select name="method"><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="lainnya">Lainnya</option></select>
          </div>
        </div>
        <div class="field"><label>Catatan</label><input name="note" /></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="btn-save">Simpan</button>
      </div>
    </form>
  `);

  overlay.querySelector('#sel-customer').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    overlay.querySelector('#amount-input').value = opt?.dataset.price || '';
  });
  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = overlay.querySelector('#btn-save');
    if (!fd.get('customer_id')) { toast('Pilih pelanggan dulu', 'error'); return; }
    setLoading(btn, true);
    try {
      await Api.call('admin.payments.record', {
        customer_id: fd.get('customer_id'), period: fd.get('period'), paid_date: fd.get('paid_date'),
        amount: Number(fd.get('amount')), method: fd.get('method'), note: fd.get('note')
      });
      closeModal();
      toast('Pembayaran tercatat. WiFi otomatis dinyalakan kembali bila sebelumnya mati karena telat.', 'success');
      reload(container);
    } catch (err) { toast(err.message, 'error'); setLoading(btn, false); }
  });
}
