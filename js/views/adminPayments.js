import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, openModal, closeModal, confirmDialog, escapeHtml, setLoading, formatRupiah, formatDate } from '../ui.js';
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
        <thead><tr><th>Tanggal Bayar</th><th>Pelanggan</th><th>Periode</th><th>Jumlah</th><th>Metode</th><th>Catatan</th><th></th></tr></thead>
        <tbody>
          ${payments.length ? payments.map(p => `
            <tr${p.amount > 0 ? '' : ' class="text-muted"'}>
              <td>${formatDate(p.paid_date)}</td>
              <td>${escapeHtml(p.customer_name)}</td>
              <td>${escapeHtml(p.period)}</td>
              <td>${formatRupiah(p.amount)}</td>
              <td>${escapeHtml(p.method)}</td>
              <td>${escapeHtml(p.note || '-')}</td>
              <td>
                ${p.amount > 0
                  ? `<button class="btn btn-ghost btn-sm" data-act="void" data-id="${p.id}" title="Salah catat? Batalkan pembayaran ini">${Icons.trash}</button>`
                  : `<span class="badge badge-muted">Dibatalkan</span>`}
              </td>
            </tr>`).join('') : `<tr><td colspan="7" class="empty-state">${Icons.card}<div>Belum ada pembayaran tercatat.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#btn-add').onclick = () => openForm(container, customers);
  container.querySelectorAll('[data-act="void"]').forEach(btn => {
    btn.onclick = () => onVoid(container, payments.find(p => p.id === btn.dataset.id));
  });
}

async function onVoid(container, payment) {
  if (!payment) return;
  const ok = await confirmDialog(
    `Batalkan pembayaran ${payment.customer_name} sebesar ${formatRupiah(payment.amount)} (periode ${payment.period})? ` +
    `Nominal akan diubah jadi Rp 0 - baris tetap tersimpan sebagai arsip, dan laporan keuangan otomatis ikut terkoreksi.`,
    { danger: true, okLabel: 'Batalkan Pembayaran' }
  );
  if (!ok) return;
  try {
    await Api.call('admin.payments.void_by_id', { payment_id: payment.id });
    toast('Pembayaran dibatalkan', 'success');
    reload(container);
  } catch (err) { toast(err.message, 'error'); }
}

/**
 * Label periode (Indonesia, "Agustus 2026" dst) untuk `owed` bulan terakhir yang berakhir di
 * `periodStr` ("yyyy-MM"), terlama lebih dulu. Cuma untuk ditampilkan ke pengguna (bukan
 * dikirim ke server) - lihat Owner.gs monthsOwed_ untuk cara `months_overdue` dihitung.
 */
function arrearsPeriodLabels(periodStr, owed) {
  const [y, m] = periodStr.split('-').map(Number);
  const curIdx = y * 12 + (m - 1);
  const labels = [];
  for (let i = owed - 1; i >= 0; i--) {
    const idx = curIdx - i;
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    labels.push(new Date(yy, mm - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }));
  }
  return labels;
}

function openForm(container, customers) {
  const options = customers.map(c => `<option value="${c.id}" data-price="${c.price}" data-owed="${c.months_overdue || 0}">${escapeHtml(c.name)} — ${escapeHtml(c.package_name)} (${formatRupiah(c.price)})</option>`).join('');
  const now = new Date();
  const period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const today = now.toISOString().slice(0, 10);

  const overlay = openModal(`
    <div class="modal-header"><h3>Catat Pembayaran</h3></div>
    <form id="payment-form">
      <div class="modal-body">
        <div class="field"><label>Pelanggan</label><select name="customer_id" id="sel-customer" required><option value="">- Pilih Pelanggan -</option>${options}</select></div>
        <div id="arrears-notice"></div>
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
    const price = Number(opt?.dataset.price) || 0;
    // Kalau pelanggan menunggak >=2 bulan, total tagihan yang disarankan dikalikan sejumlah
    // bulan tunggakannya, bukan cuma 1 bulan - supaya admin tidak kurang catat nominal.
    const owed = Math.max(1, Number(opt?.dataset.owed) || 1);
    const notice = overlay.querySelector('#arrears-notice');
    if (owed >= 2) {
      const periodInput = overlay.querySelector('input[name="period"]');
      notice.innerHTML = `
        <div class="field" style="background:var(--danger-light);border-radius:10px;padding:10px 12px;margin-bottom:4px">
          <strong style="color:var(--danger)">Pelanggan ini menunggak ${owed} bulan</strong>
          <div class="text-muted" style="font-size:.8rem">Periode: ${arrearsPeriodLabels(periodInput.value, owed).join(', ')}. Total tagihan disarankan: ${formatRupiah(price * owed)} (${formatRupiah(price)} × ${owed} bulan) - nominal boleh disesuaikan kalau pelanggan cuma bayar sebagian.</div>
        </div>`;
      overlay.querySelector('#amount-input').value = price * owed;
    } else {
      notice.innerHTML = '';
      overlay.querySelector('#amount-input').value = price || '';
    }
  });
  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = overlay.querySelector('#btn-save');
    if (!fd.get('customer_id')) { toast('Pilih pelanggan dulu', 'error'); return; }
    const payload = {
      customer_id: fd.get('customer_id'), period: fd.get('period'), paid_date: fd.get('paid_date'),
      amount: Number(fd.get('amount')), method: fd.get('method'), note: fd.get('note')
    };
    setLoading(btn, true);
    try {
      await Api.call('admin.payments.record', payload);
    } catch (err) {
      // Server mendeteksi kemungkinan input dobel (pembayaran lain utk pelanggan yang sama
      // baru dicatat < 1 menit lalu) - tanya dulu ke pengguna, jangan langsung ditolak.
      if (err.code === 'DUPLICATE_SUSPECTED') {
        setLoading(btn, false);
        const proceed = await confirmDialog(err.message, { danger: true, okLabel: 'Ya, Tetap Catat' });
        if (!proceed) return;
        setLoading(btn, true);
        try {
          await Api.call('admin.payments.record', Object.assign({}, payload, { confirm_duplicate: true }));
        } catch (err2) {
          toast(err2.message, 'error'); setLoading(btn, false); return;
        }
      } else {
        toast(err.message, 'error'); setLoading(btn, false); return;
      }
    }
    closeModal();
    toast('Pembayaran tercatat. WiFi otomatis dinyalakan kembali bila sebelumnya mati karena telat.', 'success');
    reload(container);
  });
}
