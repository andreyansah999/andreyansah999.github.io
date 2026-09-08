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
  let selectedBranch = ''; // Filter cabang

  async function reload() {
    const myToken = captureToken(container);
    const fresh = await fetcher();
    if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
    Cache.set(cacheKey, fresh);
    initView(container, opts, cacheKey, fetcher, fresh);
  }

  function getBranches() {
    // Ambil list unique cabang dari data
    const branches = [...new Set(rows.map(r => r.branch_id))].sort();
    return branches.map(bid => {
      const branchName = rows.find(r => r.branch_id === bid)?.branch_name || bid;
      return { id: bid, name: branchName };
    });
  }

  function draw() {
    const filteredRows = rows.filter(r => {
      // Filter cabang
      if (selectedBranch && r.branch_id !== selectedBranch) return false;
      
      // Filter text
      if (!filterText) return true;
      const t = filterText.toLowerCase();
      return r.name.toLowerCase().includes(t) || (r.pppoe_username || '').toLowerCase().includes(t);
    });

    const branches = getBranches();
    const totalRows = filteredRows.length;
    const onlineCount = filteredRows.filter(r => r.is_online === 'online').length;
    const offlineCount = filteredRows.filter(r => r.is_online === 'offline').length;

    container.innerHTML = `
      <div class="toolbar">
        <div class="search-box">${Icons.search}<input type="text" id="q" placeholder="Cari pelanggan / PPPoE..." value="${escapeHtml(filterText)}" /></div>
        ${showBranch && branches.length > 0 ? `
          <select id="branch-filter" style="padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--card-bg); color: var(--text); font-size: 14px;">
            <option value="">📍 Semua Cabang</option>
            ${branches.map(b => `<option value="${escapeHtml(b.id)}" ${selectedBranch === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
          </select>
        ` : ''}
        <div class="spacer"></div>
        <button class="btn btn-ghost" id="btn-refresh">${Icons.refresh}Muat Ulang</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="padding: 12px; background: var(--card-bg); border-radius: 8px; border-left: 4px solid var(--primary);">
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Total Pelanggan</div>
          <div style="font-size: 24px; font-weight: 600;">${totalRows}</div>
        </div>
        <div style="padding: 12px; background: var(--card-bg); border-radius: 8px; border-left: 4px solid #10b981;">
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Online</div>
          <div style="font-size: 24px; font-weight: 600; color: #10b981;">${onlineCount}</div>
        </div>
        <div style="padding: 12px; background: var(--card-bg); border-radius: 8px; border-left: 4px solid #ef4444;">
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Offline</div>
          <div style="font-size: 24px; font-weight: 600; color: #ef4444;">${offlineCount}</div>
        </div>
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
      <p class="hint" style="margin-top:12px">Status Online/Offline, IP, dan Uptime dilaporkan otomatis oleh router Mikrotik tiap cabang secara berkala. Kalau data terlihat lama tidak update, cek koneksi router ke internet.</p>
    `;

    container.querySelector('#q').addEventListener('input', (e) => { filterText = e.target.value; draw(); });
    
    if (showBranch) {
      const branchFilter = container.querySelector('#branch-filter');
      if (branchFilter) {
        branchFilter.addEventListener('change', (e) => { selectedBranch = e.target.value; draw(); });
      }
    }

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
