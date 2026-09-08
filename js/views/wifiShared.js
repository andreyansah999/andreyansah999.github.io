/**
 * wifiShared.js — kontrol on/off + monitoring koneksi pelanggan, dipakai Owner (lintas cabang)
 * dan Admin (cabang sendiri). Status "online/offline" & "uptime" berasal dari laporan
 * script Mikrotik cabang (lihat backend/Bridge.gs + bridge/mikrotik-agent.rsc).
 */
import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, statusBadge, escapeHtml, formatDateTime } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

export async function renderWifiShared(container, opts) {
  const cacheKey = 'page:' + opts.monitorAction;
  const fetcher = () => Api.call(opts.monitorAction);
  await withCache(container, cacheKey, fetcher, (rows) => initView(container, opts, cacheKey, fetcher, rows));
}

function initView(container, opts, cacheKey, fetcher, rows) {
  const { setAction, showBranch } = opts;
  let filterText = '';

  async function reload() {
    const myToken = captureToken(container);
    const fresh = await fetcher();
    if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
    Cache.set(cacheKey, fresh);
    initView(container, opts, cacheKey, fetcher, fresh);
  }

  function draw() {
    const filteredRows = rows.filter(r => {
      if (!filterText) return true;
      const t = filterText.toLowerCase();
      return r.name.toLowerCase().includes(t) || (r.pppoe_username || '').toLowerCase().includes(t);
    });

    container.innerHTML = `
      <div class="toolbar">
        <div class="search-box">${Icons.search}<input type="text" id="q" placeholder="Cari pelanggan / PPPoE..." value="${escapeHtml(filterText)}" /></div>
        <div class="spacer"></div>
        <button class="btn btn-ghost" id="btn-refresh">${Icons.refresh}Muat Ulang</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${showBranch ? '<th>Cabang</th>' : ''}
            <th>Pelanggan</th><th>PPPoE</th><th>Status Koneksi</th><th>IP</th><th>Uptime</th><th>Update Terakhir</th><th>Kontrol</th>
          </tr></thead>
          <tbody>
            ${filteredRows.length ? filteredRows.map(r => `
              <tr>
                ${showBranch ? `<td>${escapeHtml(r.branch_name)}</td>` : ''}
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td>${escapeHtml(r.pppoe_username || '-')}</td>
                <td>${statusBadge(r.is_online)}</td>
                <td>${escapeHtml(r.ip_address || '-')}</td>
                <td>${escapeHtml(r.uptime || '-')}</td>
                <td>${formatDateTime(r.last_sync)}</td>
                <td>
                  <label class="switch" title="${r.wifi_status === 'on' ? 'Matikan' : 'Nyalakan'} koneksi">
                    <input type="checkbox" data-id="${r.customer_id}" ${r.wifi_status === 'on' ? 'checked' : ''} />
                    <span class="track"></span>
                  </label>
                </td>
              </tr>`).join('') : `<tr><td colspan="${showBranch ? 8 : 7}" class="empty-state">
                ${Icons.wifi}<div>Belum ada data. Pastikan pelanggan sudah diisi "Username PPPoE" dan script Mikrotik cabang sudah berjalan.</div>
              </td></tr>`}
          </tbody>
        </table>
      </div>
      <p class="hint" style="margin-top:12px">Status Online/Offline, IP, dan Uptime dilaporkan otomatis oleh router Mikrotik tiap cabang secara berkala. Kalau data terlihat lama tidak update, cek scheduler script Mikrotik di cabang terkait.</p>
    `;

    container.querySelector('#q').addEventListener('input', (e) => { filterText = e.target.value; draw(); });
    container.querySelector('#btn-refresh').onclick = reload;
    container.querySelectorAll('input[type=checkbox][data-id]').forEach(chk => chk.onchange = async () => {
      const action_type = chk.checked ? 'on' : 'off';
      chk.disabled = true;
      try {
        await Api.call(setAction, { customer_id: chk.dataset.id, action_type });
        toast(action_type === 'on' ? 'Perintah nyalakan terkirim' : 'Perintah matikan terkirim', 'success');
        const r = rows.find(x => x.customer_id === chk.dataset.id);
        if (r) r.wifi_status = action_type;
        Cache.set(cacheKey, rows);
      } catch (err) {
        toast(err.message, 'error');
        chk.checked = !chk.checked;
      } finally { chk.disabled = false; }
    });
  }

  draw();
}
