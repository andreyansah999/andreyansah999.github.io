import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, openModal, closeModal, confirmDialog, statusBadge, escapeHtml, setLoading, formatDateTime } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

const CACHE_KEY = 'owner.admins.page';

async function fetchData() {
  const [admins, branches] = await Promise.all([Api.call('owner.admins.list'), Api.call('owner.branches.list')]);
  return { admins, branches };
}

export async function renderOwnerAdmins(container) {
  await withCache(container, CACHE_KEY, fetchData, (data) => draw(container, data.admins, data.branches));
}

async function reload(container) {
  const myToken = captureToken(container);
  const data = await fetchData();
  if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
  Cache.set(CACHE_KEY, data);
  draw(container, data.admins, data.branches);
}

function draw(container, admins, branches) {
  container.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-add">${Icons.plus}Tambah Admin</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nama</th><th>Username</th><th>Cabang</th><th>Status</th><th>Login Terakhir</th><th></th></tr></thead>
        <tbody>
          ${admins.length ? admins.map(a => `
            <tr>
              <td><strong>${escapeHtml(a.full_name)}</strong>${a.phone ? `<div class="text-muted" style="font-size:.78rem">${escapeHtml(a.phone)}</div>` : ''}</td>
              <td>${escapeHtml(a.username)}</td>
              <td>${escapeHtml(a.branch_name)}</td>
              <td>${statusBadge(a.status)}</td>
              <td>${formatDateTime(a.last_login)}</td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${a.id}">${Icons.edit}</button>
                  <button class="btn btn-ghost btn-sm" data-act="del" data-id="${a.id}">${Icons.trash}</button>
                </div>
              </td>
            </tr>`).join('') : `<tr><td colspan="6" class="empty-state">Belum ada admin cabang.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#btn-add').onclick = () => openForm(container, null, branches);
  container.querySelectorAll('[data-act="edit"]').forEach(b => b.onclick = () => openForm(container, admins.find(x => x.id === b.dataset.id), branches));
  container.querySelectorAll('[data-act="del"]').forEach(b => b.onclick = () => onDelete(container, b.dataset.id));
}

function openForm(container, admin, branches) {
  const branchOptions = branches.map(b => `<option value="${b.id}" ${admin?.branch_id === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('');
  const overlay = openModal(`
    <div class="modal-header"><h3>${admin ? 'Edit Admin' : 'Tambah Admin'}</h3></div>
    <form id="admin-form">
      <div class="modal-body">
        <div class="field"><label>Nama Lengkap</label><input name="full_name" required value="${escapeHtml(admin?.full_name || '')}" /></div>
        <div class="field-row">
          <div class="field"><label>Username</label><input name="username" required value="${escapeHtml(admin?.username || '')}" /></div>
          <div class="field"><label>Telepon</label><input name="phone" value="${escapeHtml(admin?.phone || '')}" /></div>
        </div>
        <div class="field">
          <label>Cabang</label>
          <select name="branch_id" required ${!branches.length ? 'disabled' : ''}>${branchOptions || '<option value="">Belum ada cabang</option>'}</select>
        </div>
        <div class="field">
          <label>${admin ? 'Password Baru (kosongkan bila tidak ganti)' : 'Password'}</label>
          <input type="password" name="password" ${admin ? '' : 'required'} placeholder="Minimal 6 karakter" />
        </div>
        ${admin ? `<div class="field"><label>Status</label>
          <select name="status">
            <option value="active" ${admin.status !== 'inactive' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${admin.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select></div>` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="btn-save">Simpan</button>
      </div>
    </form>
  `);
  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = overlay.querySelector('#btn-save');
    setLoading(btn, true);
    try {
      const payload = {
        id: admin?.id, full_name: fd.get('full_name'), username: fd.get('username'),
        phone: fd.get('phone'), branch_id: fd.get('branch_id'), status: fd.get('status') || 'active'
      };
      if (admin) payload.new_password = fd.get('password') || undefined;
      else payload.password = fd.get('password');
      await Api.call('owner.admins.save', payload);
      closeModal();
      toast('Admin disimpan', 'success');
      reload(container);
    } catch (err) {
      toast(err.message, 'error');
      setLoading(btn, false);
    }
  });
}

async function onDelete(container, id) {
  if (!(await confirmDialog('Hapus admin ini? Admin tidak akan bisa login lagi.', { danger: true, okLabel: 'Hapus' }))) return;
  try {
    await Api.call('owner.admins.delete', { id });
    toast('Admin dihapus', 'success');
    reload(container);
  } catch (err) { toast(err.message, 'error'); }
}
