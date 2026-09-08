import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, openModal, closeModal, confirmDialog, escapeHtml, setLoading, formatRupiah } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

const CACHE_KEY = 'owner.pricing.page';

async function fetchData() {
  const [pricing, branches] = await Promise.all([Api.call('pricing.list'), Api.call('owner.branches.list')]);
  return { pricing, branches };
}

export async function renderOwnerPricing(container) {
  await withCache(container, CACHE_KEY, fetchData, (data) => draw(container, data.pricing, data.branches));
}

async function reload(container) {
  const myToken = captureToken(container);
  const data = await fetchData();
  if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
  Cache.set(CACHE_KEY, data);
  draw(container, data.pricing, data.branches);
}

function draw(container, pricing, branches) {
  container.innerHTML = `
    <div class="card-header" style="margin-bottom:4px"><h3>Paket &amp; Harga Dasar (Terpusat)</h3></div>
    <p class="hint" style="margin-top:0">Harga dasar berlaku untuk semua cabang. Cabang bisa menambah markup sendiri di atas harga dasar ini (lihat tabel di bawah).</p>
    <div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" id="btn-add-pkg">${Icons.plus}Tambah Paket</button></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Paket</th><th>Kecepatan</th><th>Harga Dasar</th><th>Keterangan</th><th></th></tr></thead>
        <tbody>
          ${pricing.length ? pricing.map(p => `
            <tr>
              <td><strong>${escapeHtml(p.package_name)}</strong></td>
              <td>${escapeHtml(p.speed || '-')}</td>
              <td>${formatRupiah(p.base_price)}</td>
              <td>${escapeHtml(p.description || '-')}</td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${p.id}">${Icons.edit}</button>
                  <button class="btn btn-ghost btn-sm" data-act="del" data-id="${p.id}">${Icons.trash}</button>
                </div>
              </td>
            </tr>`).join('') : `<tr><td colspan="5" class="empty-state">Belum ada paket. Tambahkan dulu.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="section-title">Markup Harga per Cabang</div>
    <p class="hint" style="margin-top:0">Harga akhir pelanggan di suatu cabang = Harga Dasar + Markup cabang tsb. Admin cabang juga bisa mengatur markup ini sendiri dari akun mereka.</p>
    <div class="field-row" style="max-width:520px">
      <div class="field"><label>Cabang</label><select id="sel-branch">${branches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Paket</label><select id="sel-pkg">${pricing.map(p => `<option value="${p.id}">${escapeHtml(p.package_name)}</option>`).join('')}</select></div>
    </div>
    <div id="markup-table"></div>
  `;

  container.querySelector('#btn-add-pkg').onclick = () => openPkgForm(container, null);
  container.querySelectorAll('[data-act="edit"]').forEach(b => b.onclick = () => openPkgForm(container, pricing.find(x => x.id === b.dataset.id)));
  container.querySelectorAll('[data-act="del"]').forEach(b => b.onclick = () => onDeletePkg(container, b.dataset.id));

  function renderMarkupSection() {
    if (!branches.length || !pricing.length) {
      container.querySelector('#markup-table').innerHTML = `<p class="text-muted">Butuh minimal 1 cabang dan 1 paket untuk mengatur markup.</p>`;
      return;
    }
    const branchId = container.querySelector('#sel-branch').value;
    const pkgId = container.querySelector('#sel-pkg').value;
    const pkg = pricing.find(p => p.id === pkgId);
    const markupRow = pkg?.branch_markups.find(m => m.branch_id === branchId);
    const markup = markupRow ? markupRow.markup : 0;
    const base = pkg ? Number(pkg.base_price) : 0;

    container.querySelector('#markup-table').innerHTML = `
      <div class="card" style="max-width:520px;margin-top:10px">
        <div class="field">
          <label>Markup (Rp) — boleh 0</label>
          <input type="number" id="markup-input" value="${markup}" />
        </div>
        <p class="hint">Harga akhir pelanggan baru cabang ini utk paket ini: <strong>${formatRupiah(base + Number(markup))}</strong></p>
        <button class="btn btn-primary btn-sm" id="btn-save-markup">Simpan Markup</button>
      </div>
    `;
    container.querySelector('#btn-save-markup').onclick = async (e) => {
      const btn = e.target;
      setLoading(btn, true);
      try {
        await Api.call('owner.branch_markup.save', { branch_id: branchId, package_id: pkgId, markup: Number(container.querySelector('#markup-input').value) || 0 });
        toast('Markup disimpan', 'success');
        reload(container);
      } catch (err) { toast(err.message, 'error'); setLoading(btn, false); }
    };
  }

  if (branches.length && pricing.length) {
    container.querySelector('#sel-branch').onchange = renderMarkupSection;
    container.querySelector('#sel-pkg').onchange = renderMarkupSection;
    renderMarkupSection();
  } else {
    renderMarkupSection();
  }
}

function openPkgForm(container, pkg) {
  const overlay = openModal(`
    <div class="modal-header"><h3>${pkg ? 'Edit Paket' : 'Tambah Paket'}</h3></div>
    <form id="pkg-form">
      <div class="modal-body">
        <div class="field"><label>Nama Paket</label><input name="package_name" required value="${escapeHtml(pkg?.package_name || '')}" placeholder="mis. Paket 10 Mbps" /></div>
        <div class="field-row">
          <div class="field"><label>Kecepatan</label><input name="speed" value="${escapeHtml(pkg?.speed || '')}" placeholder="mis. 10 Mbps" /></div>
          <div class="field"><label>Harga Dasar (Rp)</label><input type="number" name="base_price" required value="${pkg?.base_price || ''}" /></div>
        </div>
        <div class="field"><label>Keterangan</label><input name="description" value="${escapeHtml(pkg?.description || '')}" /></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-cancel">Batal</button>
        <button type="submit" class="btn btn-primary" id="btn-save">Simpan</button>
      </div>
    </form>
  `);
  overlay.querySelector('#btn-cancel').onclick = closeModal;
  overlay.querySelector('#pkg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = overlay.querySelector('#btn-save');
    setLoading(btn, true);
    try {
      await Api.call('owner.pricing.save', {
        id: pkg?.id, package_name: fd.get('package_name'), speed: fd.get('speed'),
        base_price: Number(fd.get('base_price')), description: fd.get('description')
      });
      closeModal();
      toast('Paket disimpan', 'success');
      reload(container);
    } catch (err) { toast(err.message, 'error'); setLoading(btn, false); }
  });
}

async function onDeletePkg(container, id) {
  if (!(await confirmDialog('Hapus paket ini?', { danger: true, okLabel: 'Hapus' }))) return;
  try { await Api.call('owner.pricing.delete', { id }); toast('Paket dihapus', 'success'); reload(container); }
  catch (err) { toast(err.message, 'error'); }
}
