import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, openModal, closeModal, confirmDialog, statusBadge, escapeHtml, setLoading } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

const CACHE_KEY = 'owner.branches.list';

export async function renderOwnerBranches(container) {
  await withCache(container, CACHE_KEY, () => Api.call('owner.branches.list'), (branches) => draw(container, branches));
}

async function reload(container) {
  const myToken = captureToken(container);
  const branches = await Api.call('owner.branches.list');
  if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
  Cache.set(CACHE_KEY, branches);
  draw(container, branches);
}

function draw(container, branches) {
  container.innerHTML = `
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-add">${Icons.plus}Tambah Cabang</button>
    </div>
    ${branches.length ? `<div class="grid grid-3" id="branch-grid"></div>` : `
      <div class="card"><div class="empty-state">${Icons.branch}<div>Belum ada cabang. Tambahkan cabang pertama Anda.</div></div></div>
    `}
  `;

  container.querySelector('#btn-add').onclick = () => openForm(container, null);

  const grid = container.querySelector('#branch-grid');
  if (grid) {
    grid.innerHTML = branches.map(b => `
      <div class="card branch-card" data-id="${b.id}" role="button" tabindex="0">
        <div class="card-header" style="margin-bottom:10px">
          <h3>${escapeHtml(b.name)}</h3>
          ${statusBadge(b.status)}
        </div>
        <div class="branch-card-stats">
          <div><strong>${b.total_customers}</strong><span>Pelanggan</span></div>
          <div><strong>${b.total_admins}</strong><span>Admin</span></div>
          <div><strong>${b.grace_period_days === null ? 'Default' : b.grace_period_days + ' hr'}</strong><span>Kelonggaran</span></div>
        </div>
        <p class="text-muted branch-card-address">${escapeHtml(b.address || 'Alamat belum diisi')}</p>
      </div>
    `).join('');

    grid.querySelectorAll('.branch-card').forEach(card => {
      card.addEventListener('click', () => openDetail(container, branches.find(x => x.id === card.dataset.id)));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
    });
  }
}

function openDetail(container, branch) {
  const overlay = openModal(`
    <div class="modal-header">
      <h3>${escapeHtml(branch.name)}</h3>
    </div>
    <div class="modal-body">
      <div class="branch-card-stats" style="margin-bottom:16px">
        <div><strong>${branch.total_customers}</strong><span>Pelanggan</span></div>
        <div><strong>${branch.total_admins}</strong><span>Admin</span></div>
        <div><strong>${statusBadge(branch.status)}</strong><span>Status</span></div>
      </div>
      <div class="field"><label>Alamat</label><p class="mt-0">${escapeHtml(branch.address || '-')}</p></div>
      <div class="field"><label>Telepon</label><p class="mt-0">${escapeHtml(branch.phone || '-')}</p></div>
      <div class="field"><label>Kelonggaran Telat Bayar</label><p class="mt-0">${branch.grace_period_days === null ? 'Ikut default global' : branch.grace_period_days + ' hari'}</p></div>
      <div class="field">
        <label>API Key Jembatan Mikrotik</label>
        <p class="key-mono" style="display:block;padding:8px">${branch.bridge_api_key}</p>
      </div>
    </div>
    <div class="modal-footer" style="flex-wrap:wrap">
      <button type="button" class="btn btn-ghost" id="btn-close">Tutup</button>
      <button type="button" class="btn btn-ghost" id="btn-key">${Icons.refresh}Buat Ulang Key</button>
      <button type="button" class="btn btn-danger" id="btn-del">${Icons.trash}Hapus</button>
      <button type="button" class="btn btn-primary" id="btn-edit">${Icons.edit}Edit</button>
    </div>
  `, { wide: true });

  overlay.querySelector('#btn-close').onclick = closeModal;
  overlay.querySelector('#btn-edit').onclick = () => openForm(container, branch);
  overlay.querySelector('#btn-key').onclick = () => onRegenerateKey(container, branch);
  overlay.querySelector('#btn-del').onclick = () => onDelete(container, branch.id);
}

function openForm(container, branch) {
  const overlay = openModal(`
    <div class="modal-header"><h3>${branch ? 'Edit Cabang' : 'Tambah Cabang'}</h3></div>
    <form id="branch-form">
      <div class="modal-body">
        <div class="field"><label>Nama Cabang</label><input name="name" required value="${escapeHtml(branch?.name || '')}" /></div>
        <div class="field"><label>Alamat</label><input name="address" value="${escapeHtml(branch?.address || '')}" /></div>
        <div class="field"><label>Telepon</label><input name="phone" value="${escapeHtml(branch?.phone || '')}" /></div>
        <div class="field-row">
          <div class="field">
            <label>Kelonggaran Telat Bayar (hari)</label>
            <input type="number" min="0" max="60" name="grace_period_days" placeholder="Kosongkan = ikut default global" value="${branch?.grace_period_days ?? ''}" />
          </div>
          <div class="field">
            <label>Status</label>
            <select name="status">
              <option value="active" ${branch?.status !== 'inactive' ? 'selected' : ''}>Aktif</option>
              <option value="inactive" ${branch?.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
            </select>
          </div>
        </div>
        <p class="hint">Kelonggaran = berapa hari setelah tanggal jatuh tempo pelanggan boleh telat sebelum WiFi otomatis dimatikan. Kosongkan untuk memakai default global (diatur di menu Pengaturan).</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="btn-save">Simpan</button>
      </div>
    </form>
  `);
  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#branch-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = overlay.querySelector('#btn-save');
    setLoading(btn, true);
    try {
      await Api.call('owner.branches.save', {
        id: branch?.id, name: fd.get('name'), address: fd.get('address'), phone: fd.get('phone'),
        grace_period_days: fd.get('grace_period_days') === '' ? '' : Number(fd.get('grace_period_days')),
        status: fd.get('status')
      });
      closeModal();
      toast('Cabang disimpan', 'success');
      reload(container);
    } catch (err) {
      toast(err.message, 'error');
      setLoading(btn, false);
    }
  });
}

async function onDelete(container, id) {
  if (!(await confirmDialog('Hapus cabang ini? Pastikan tidak ada pelanggan tersisa di cabang ini.', { danger: true, okLabel: 'Hapus' }))) return;
  try {
    await Api.call('owner.branches.delete', { id });
    closeModal();
    toast('Cabang dihapus', 'success');
    reload(container);
  } catch (err) { toast(err.message, 'error'); }
}

async function onRegenerateKey(container, branch) {
  const ok = await confirmDialog(
    `Buat ulang API key jembatan Mikrotik untuk "${branch.name}"? Script Mikrotik cabang ini harus diperbarui dengan key baru, kalau tidak koneksi jembatan akan gagal.`,
    { okLabel: 'Buat Ulang' }
  );
  if (!ok) return;
  try {
    const res = await Api.call('owner.branches.regenerate_key', { id: branch.id });
    openModal(`
      <div class="modal-header"><h3>API Key Baru: ${escapeHtml(branch.name)}</h3></div>
      <div class="modal-body">
        <p>Salin key ini ke script Mikrotik (mikrotik-agent.rsc) cabang <strong>${escapeHtml(branch.name)}</strong>:</p>
        <p class="key-mono" style="display:block;padding:10px;font-size:.85rem">${res.bridge_api_key}</p>
      </div>
      <div class="modal-footer"><button class="btn btn-primary" id="btn-close2">Tutup</button></div>
    `);
    document.getElementById('btn-close2').onclick = closeModal;
    reload(container);
  } catch (err) { toast(err.message, 'error'); }
}
