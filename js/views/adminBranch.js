import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, setLoading, escapeHtml, formatRupiah } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

const CACHE_KEY = 'admin.branch.page';

async function fetchData() {
  const [branch, pricing] = await Promise.all([Api.call('admin.branch_info'), Api.call('pricing.list')]);
  return { branch, pricing };
}

export async function renderAdminBranch(container) {
  await withCache(container, CACHE_KEY, fetchData, (data) => draw(container, data.branch, data.pricing));
}

async function reload(container) {
  const myToken = captureToken(container);
  const data = await fetchData();
  if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
  Cache.set(CACHE_KEY, data);
  draw(container, data.branch, data.pricing);
}

function draw(container, branch, pricing) {
  container.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><h3>Profil Cabang</h3></div>
        <form id="branch-form">
          <div class="field"><label>Nama Cabang</label><input value="${escapeHtml(branch.name)}" disabled /></div>
          <div class="field"><label>Alamat</label><input name="address" value="${escapeHtml(branch.address || '')}" /></div>
          <div class="field"><label>Telepon</label><input name="phone" value="${escapeHtml(branch.phone || '')}" /></div>
          <div class="field">
            <label>Kelonggaran Telat Bayar (hari)</label>
            <input type="number" min="0" max="60" name="grace_period_days" placeholder="Kosongkan = ikut default global Owner" value="${branch.grace_period_days ?? ''}" />
            <p class="hint">Berapa hari pelanggan boleh telat dari tanggal jatuh tempo sebelum WiFi-nya otomatis dimatikan sistem.</p>
          </div>
          <button class="btn btn-primary" id="btn-save" type="submit">Simpan</button>
        </form>
      </div>

      <div class="card">
        <div class="card-header"><h3>Kunci Jembatan Mikrotik Cabang Ini</h3></div>
        <p class="hint" style="margin-top:0">Masukkan Branch ID dan API Key ini ke script <code>mikrotik-agent.rsc</code> di router cabang Anda, supaya sistem bisa menyalakan/mematikan koneksi pelanggan & memonitor status koneksi.</p>
        
        <div class="field">
          <label>Branch ID</label>
          <div class="key-display">
            <code id="branch-id-text">${escapeHtml(branch.id)}</code>
            <button class="btn btn-sm btn-ghost copy-btn" data-text="${escapeHtml(branch.id)}" title="Salin Branch ID">
              ${Icons.copy || '📋'}
            </button>
          </div>
        </div>
        
        <div class="field">
          <label>API Key</label>
          <div class="key-display">
            <code id="api-key-text">${escapeHtml(branch.bridge_api_key || '-')}</code>
            <button class="btn btn-sm btn-ghost copy-btn" data-text="${escapeHtml(branch.bridge_api_key || '')}" title="Salin API Key">
              ${Icons.copy || '📋'}
            </button>
          </div>
        </div>
        
        <p class="hint">Kalau API key ini bocor / perlu diganti, minta Owner meng-generate ulang dari menu Cabang.</p>
      </div>
    </div>

    <div class="section-title">Markup Harga Paket untuk Cabang Ini</div>
    <p class="hint" style="margin-top:0">Harga akhir pelanggan baru = Harga Dasar (ditentukan Owner) + Markup cabang Anda.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Paket</th><th>Harga Dasar</th><th>Markup Cabang</th><th>Harga Akhir</th><th></th></tr></thead>
        <tbody>
          ${pricing.length ? pricing.map(p => {
            const m = p.branch_markups.find(x => x.branch_id === branch.id);
            const markup = m ? m.markup : 0;
            return `<tr>
              <td>${escapeHtml(p.package_name)}</td>
              <td>${formatRupiah(p.base_price)}</td>
              <td><input type="number" class="markup-input" data-pkg="${p.id}" value="${markup}" style="width:120px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg)" /></td>
              <td class="final-price" data-pkg="${p.id}">${formatRupiah(Number(p.base_price) + Number(markup))}</td>
              <td><button class="btn btn-primary btn-sm" data-act="save-markup" data-pkg="${p.id}" data-base="${p.base_price}">Simpan</button></td>
            </tr>`;
          }).join('') : `<tr><td colspan="5" class="empty-state">Owner belum menambahkan paket harga.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  // Copy button handler
  container.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const text = btn.dataset.text;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = '✓ Tersalin';
        setTimeout(() => {
          btn.innerHTML = Icons.copy || '📋';
        }, 1500);
        toast('Berhasil disalin ke clipboard', 'success');
      }).catch(() => {
        toast('Gagal menyalin', 'error');
      });
    });
  });

  container.querySelector('#branch-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = container.querySelector('#btn-save');
    setLoading(btn, true);
    try {
      await Api.call('admin.branch_settings.save', {
        address: fd.get('address'), phone: fd.get('phone'),
        grace_period_days: fd.get('grace_period_days') === '' ? '' : Number(fd.get('grace_period_days'))
      });
      toast('Profil cabang disimpan', 'success');
      reload(container);
    } catch (err) { toast(err.message, 'error'); setLoading(btn, false); }
  });

  container.querySelectorAll('.markup-input').forEach(inp => inp.addEventListener('input', () => {
    const row = container.querySelector(`.final-price[data-pkg="${inp.dataset.pkg}"]`);
    const base = Number(container.querySelector(`[data-act="save-markup"][data-pkg="${inp.dataset.pkg}"]`).dataset.base);
    row.textContent = formatRupiah(base + (Number(inp.value) || 0));
  }));

  container.querySelectorAll('[data-act="save-markup"]').forEach(btn => btn.onclick = async () => {
    const pkgId = btn.dataset.pkg;
    const markup = Number(container.querySelector(`.markup-input[data-pkg="${pkgId}"]`).value) || 0;
    setLoading(btn, true);
    try {
      await Api.call('admin.branch_markup.save', { package_id: pkgId, markup });
      toast('Markup disimpan', 'success');
      reload(container);
    } catch (err) { toast(err.message, 'error'); setLoading(btn, false); }
  });
}
