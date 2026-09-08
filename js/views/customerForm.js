/**
 * customerForm.js — form tambah/edit pelanggan, dipakai bersama oleh Owner (semua cabang)
 * dan Admin (cabang sendiri, branch_id disembunyikan & dipaksa dari sesi).
 */
import { Api } from '../api.js';
import { toast, openModal, closeModal, escapeHtml, setLoading } from '../ui.js';

export function openCustomerForm({ customer, branches, forcedBranchId, pricing, saveAction, onSaved }) {
  const branchField = forcedBranchId ? '' : `
    <div class="field">
      <label>Cabang</label>
      <select name="branch_id" required>
        ${branches.map(b => `<option value="${b.id}" ${customer?.branch_id === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
      </select>
    </div>`;

  const packageOptions = `<option value="">- Tanpa Paket / Harga Manual -</option>` +
    pricing.map(p => `<option value="${p.id}" ${customer?.package_id === p.id ? 'selected' : ''}>${escapeHtml(p.package_name)} (Rp ${Number(p.base_price).toLocaleString('id-ID')})</option>`).join('');

  const overlay = openModal(`
    <div class="modal-header"><h3>${customer ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h3></div>
    <form id="customer-form">
      <div class="modal-body">
        <div class="field"><label>Nama Pelanggan</label><input name="name" required value="${escapeHtml(customer?.name || '')}" /></div>
        <div class="field-row">
          <div class="field"><label>No. Telepon</label><input name="phone" value="${escapeHtml(customer?.phone || '')}" /></div>
          <div class="field"><label>Tanggal Pasang</label><input type="date" name="install_date" value="${customer?.install_date ? String(customer.install_date).slice(0, 10) : ''}" /></div>
        </div>
        <div class="field"><label>Alamat</label><input name="address" value="${escapeHtml(customer?.address || '')}" /></div>
        ${branchField}
        <div class="field-row">
          <div class="field"><label>Paket Langganan</label><select name="package_id">${packageOptions}</select></div>
          <div class="field"><label>Harga Manual (opsional)</label><input type="number" name="custom_price" placeholder="Kosongkan = ikut harga paket" value="${customer?.custom_price || ''}" /></div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Username PPPoE (Mikrotik)</label>
            <input name="pppoe_username" value="${escapeHtml(customer?.pppoe_username || '')}" placeholder="mis. rumah-budi01" />
          </div>
          <div class="field"><label>Tanggal Jatuh Tempo (tiap bulan)</label><input type="number" min="1" max="28" name="due_date_day" value="${customer?.due_date_day || 1}" /></div>
        </div>
        <div class="field"><label>MAC Address (opsional)</label><input name="mac_address" value="${escapeHtml(customer?.mac_address || '')}" /></div>
        <div class="field"><label>Catatan</label><textarea name="notes" rows="2">${escapeHtml(customer?.notes || '')}</textarea></div>
        <p class="hint">Isi "Username PPPoE" persis sama dengan nama secret PPPoE di Mikrotik cabang ini, supaya sistem bisa mengontrol koneksinya otomatis.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="btn-save">Simpan</button>
      </div>
    </form>
  `, { wide: true });

  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = overlay.querySelector('#btn-save');
    setLoading(btn, true);
    try {
      const payload = {
        id: customer?.id,
        name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address'),
        install_date: fd.get('install_date'), package_id: fd.get('package_id'),
        custom_price: fd.get('custom_price'), pppoe_username: fd.get('pppoe_username'),
        due_date_day: fd.get('due_date_day'), mac_address: fd.get('mac_address'), notes: fd.get('notes')
      };
      if (!forcedBranchId) payload.branch_id = fd.get('branch_id');
      await Api.call(saveAction, payload);
      closeModal();
      toast('Pelanggan disimpan', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
      setLoading(btn, false);
    }
  });
}
