/**
 * paymentForm.js — form catat pembayaran untuk SATU pelanggan yang sudah diketahui
 * (dipanggil dari halaman Tagihan). Untuk memilih pelanggan dari daftar dulu, lihat
 * adminPayments.js yang punya alur pilih-pelanggan sendiri.
 */
import { Api } from '../api.js';
import { toast, openModal, closeModal, confirmDialog, escapeHtml, setLoading, formatRupiah } from '../ui.js';

export function openPaymentForm({ customer, recordAction, onSaved }) {
  const now = new Date();
  const period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const today = now.toISOString().slice(0, 10);

  const overlay = openModal(`
    <div class="modal-header"><h3>Catat Pembayaran — ${escapeHtml(customer.name)}</h3></div>
    <form id="payment-form">
      <div class="modal-body">
        <p class="hint" style="margin-top:0">${escapeHtml(customer.package_name || 'Tanpa paket')}${customer.branch_name ? ' · ' + escapeHtml(customer.branch_name) : ''}</p>
        <div class="field-row">
          <div class="field"><label>Periode (Bulan)</label><input type="month" name="period" value="${period}" required /></div>
          <div class="field"><label>Tanggal Bayar</label><input type="date" name="paid_date" value="${today}" required /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Jumlah (Rp)</label><input type="number" name="amount" value="${customer.price || 0}" required /></div>
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

  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = overlay.querySelector('#btn-save');
    const payload = {
      customer_id: customer.id, period: fd.get('period'), paid_date: fd.get('paid_date'),
      amount: Number(fd.get('amount')), method: fd.get('method'), note: fd.get('note')
    };
    setLoading(btn, true);
    try {
      await Api.call(recordAction, payload);
    } catch (err) {
      // Server mendeteksi kemungkinan input dobel (pembayaran lain utk pelanggan yang sama
      // baru dicatat < 1 menit lalu) - tanya dulu ke pengguna, jangan langsung ditolak.
      if (err.code === 'DUPLICATE_SUSPECTED') {
        setLoading(btn, false);
        const proceed = await confirmDialog(err.message, { danger: true, okLabel: 'Ya, Tetap Catat' });
        if (!proceed) return;
        setLoading(btn, true);
        try {
          await Api.call(recordAction, Object.assign({}, payload, { confirm_duplicate: true }));
        } catch (err2) {
          toast(err2.message, 'error'); setLoading(btn, false); return;
        }
      } else {
        toast(err.message, 'error'); setLoading(btn, false); return;
      }
    }
    closeModal();
    toast('Pembayaran tercatat. WiFi otomatis dinyalakan kembali bila sebelumnya mati karena telat.', 'success');
    onSaved();
  });
}
