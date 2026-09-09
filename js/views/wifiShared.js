/**
 * wifiShared.js — kontrol on/off + monitoring koneksi pelanggan, dipakai Owner (lintas cabang)
 * dan Admin (cabang sendiri). Status "online/offline" & "uptime" berasal dari laporan
 * script Mikrotik cabang (lihat backend/Bridge.gs + bridge/mikrotik-agent.rsc).
 */
import { Api } from '../api.js';
import { Icons } from '../icons.js';
import { toast, escapeHtml, formatDateTime } from '../ui.js';
import { withCache, Cache, captureToken, isStale } from '../cache.js';

export async function renderWifiShared(container, opts) {
  const cacheKey = 'page:' + opts.monitorAction;
  const fetcher = () => Api.call(opts.monitorAction);
  await withCache(container, cacheKey, fetcher, (rows) => initView(container, opts, cacheKey, fetcher, rows));
}

function initView(container, opts, cacheKey, fetcher, rows) {
  const { setAction, showBranch } = opts;
  let filterText = '';
  let selectedBranch = '';
  let selectedCustomer = null;

  async function reload() {
    const myToken = captureToken(container);
    const fresh = await fetcher();
    if (isStale(container, myToken)) return;
    Cache.set(cacheKey, fresh);
    initView(container, opts, cacheKey, fetcher, fresh);
  }

  function getBranches() {
    const branches = [...new Set(rows.map(r => r.branch_id))].sort();
    return branches.map(bid => {
      const branchName = rows.find(r => r.branch_id === bid)?.branch_name || bid;
      return { id: bid, name: branchName };
    });
  }

  function getStatusBadge(isOnline) {
    if (isOnline === 'online') {
      return `<span style="display: inline-block; padding: 4px 12px; background: #10b981; color: white; border-radius: 6px; font-size: 12px; font-weight: 600;">● Online</span>`;
    } else if (isOnline === 'offline') {
      return `<span style="display: inline-block; padding: 4px 12px; background: #ef4444; color: white; border-radius: 6px; font-size: 12px; font-weight: 600;">● Offline</span>`;
    }
    return `<span style="display: inline-block; padding: 4px 12px; background: var(--border); color: var(--text); border-radius: 6px; font-size: 12px;">−</span>`;
  }

  function showDetailModal(customer) {
    selectedCustomer = customer;
    const modal = document.getElementById('detail-modal');
    if (!modal) return;

    const wifiStatus = customer.wifi_status === 'on' ? 'Menyala' : 'Mati';
    const wifiStatusColor = customer.wifi_status === 'on' ? '#10b981' : '#ef4444';

    modal.querySelector('#modal-content').innerHTML = `
      <div style="padding: 20px;">
        <h3 style="margin-top: 0; margin-bottom: 20px;">${escapeHtml(customer.name)}</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Status Koneksi</div>
            <div style="font-size: 14px; font-weight: 600;">${getStatusBadge(customer.is_online)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Status WiFi</div>
            <div style="display: inline-block; padding: 4px 12px; background: ${wifiStatusColor}; color: white; border-radius: 6px; font-size: 12px; font-weight: 600;">${wifiStatus}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">PPPoE Username</div>
            <div style="font-size: 14px; font-family: 'Courier New', monospace; background: var(--bg); padding: 8px; border-radius: 6px; word-break: break-all;">${escapeHtml(customer.pppoe_username || '-')}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">IP Address</div>
            <div style="font-size: 14px; font-family: 'Courier New', monospace; background: var(--bg); padding: 8px; border-radius: 6px; word-break: break-all;">${escapeHtml(customer.ip_address || '-')}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Uptime</div>
            <div style="font-size: 14px; font-weight: 600; word-break: break-all;">${escapeHtml(customer.uptime || '-')}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Update Terakhir</div>
            <div style="font-size: 14px; word-break: break-all;">${formatDateTime(customer.last_sync) || '-'}</div>
          </div>
        </div>

        ${showBranch ? `
          <div>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">Cabang</div>
            <div style="font-size: 14px; font-weight: 600;">${escapeHtml(customer.branch_name)}</div>
          </div>
        ` : ''}

        <div style="margin-top: 24px; border-top: 1px solid var(--border); padding-top: 16px;">
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px; font-weight: 600;">Kontrol Koneksi WiFi</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" id="btn-turn-on" style="flex: 1;">✓ Nyalakan</button>
            <button class="btn btn-danger" id="btn-turn-off" style="flex: 1; background: #ef4444; border-color: #ef4444;">✕ Matikan</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const btnOn = modal.querySelector('#btn-turn-on');
    const btnOff = modal.querySelector('#btn-turn-off');

    if (btnOn) {
      btnOn.onclick = async () => {
        btnOn.disabled = true;
        btnOff.disabled = true;
        try {
          await Api.call(setAction, { customer_id: customer.customer_id, action_type: 'on' });
          toast('Perintah nyalakan terkirim', 'success');
          customer.wifi_status = 'on';
          Cache.set(cacheKey, rows);
          closeDetailModal();
          renderTableBody();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          btnOn.disabled = false;
          btnOff.disabled = false;
        }
      };
    }

    if (btnOff) {
      btnOff.onclick = async () => {
        btnOn.disabled = true;
        btnOff.disabled = true;
        try {
          await Api.call(setAction, { customer_id: customer.customer_id, action_type: 'off' });
          toast('Perintah matikan terkirim', 'success');
          customer.wifi_status = 'off';
          Cache.set(cacheKey, rows);
          closeDetailModal();
          renderTableBody();
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          btnOn.disabled = false;
          btnOff.disabled = false;
        }
      };
    }
  }

  function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
    selectedCustomer = null;
  }

  function renderTableBody() {
    const filteredRows = rows.filter(r => {
      if (selectedBranch && r.branch_id !== selectedBranch) return false;
      if (!filterText) return true;
      const t = filterText.toLowerCase();
      return r.name.toLowerCase().includes(t) || (r.pppoe_username || '').toLowerCase().includes(t);
    });

    const tbody = container.querySelector('#table-body');
    if (!tbody) return;

    tbody.innerHTML = filteredRows.length ? filteredRows.map(r => `
      <tr>
        ${showBranch ? `<td style="font-size: 13px;">${escapeHtml(r.branch_name)}</td>` : ''}
        <td style="font-size: 13px;">${getStatusBadge(r.is_online)} <strong>${escapeHtml(r.name)}</strong></td>
        <td style="font-size: 13px;"><button class="btn btn-primary btn-sm" data-id="${r.customer_id}" data-action="detail">Detail</button></td>
      </tr>`).join('') : `<tr><td colspan="${showBranch ? 3 : 2}" class="empty-state">
      ${Icons.wifi}<div>Belum ada data. Pastikan pelanggan sudah diisi "Username PPPoE" dan script Mikrotik cabang sudah berjalan.</div>
    </td></tr>`;

    // Attach detail button events
    container.querySelectorAll('[data-action="detail"]').forEach(btn => {
      btn.onclick = () => {
        const customerId = btn.dataset.id;
        const customer = rows.find(r => r.customer_id === customerId);
        if (customer) showDetailModal(customer);
      };
    });
  }

  const branches = getBranches();
  const totalRows = rows.filter(r => !selectedBranch || r.branch_id === selectedBranch).length;
  const onlineCount = rows.filter(r => (!selectedBranch || r.branch_id === selectedBranch) && r.is_online === 'online').length;
  const offlineCount = rows.filter(r => (!selectedBranch || r.branch_id === selectedBranch) && r.is_online === 'offline').length;

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

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
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
      <table style="font-size: 13px;">
        <thead><tr>
          ${showBranch ? '<th style="width: 20%;">Cabang</th>' : ''}
          <th style="flex: 1;">Pelanggan</th>
          <th style="width: 80px;">Aksi</th>
        </tr></thead>
        <tbody id="table-body"></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:12px">Status Online/Offline dilaporkan otomatis oleh router Mikrotik tiap cabang secara berkala.</p>

    <!-- Modal Detail -->
    <div id="detail-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background: var(--card-bg); border-radius: 12px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--card-bg);">
          <h3 style="margin: 0;">Detail Pelanggan</h3>
          <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text);">×</button>
        </div>
        <div id="modal-content"></div>
      </div>
    </div>
  `;

  // Event listeners
  container.querySelector('#q').addEventListener('input', (e) => { 
    filterText = e.target.value; 
    renderTableBody(); 
  });
  
  if (showBranch) {
    const branchFilter = container.querySelector('#branch-filter');
    if (branchFilter) {
      branchFilter.addEventListener('change', (e) => { 
        selectedBranch = e.target.value; 
        renderTableBody(); 
      });
    }
  }

  container.querySelector('#btn-refresh').onclick = reload;

  // Close modal
  const closeBtn = container.querySelector('#close-modal');
  if (closeBtn) closeBtn.onclick = closeDetailModal;

  const modal = container.querySelector('#detail-modal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeDetailModal();
    };
  }

  renderTableBody();
}
