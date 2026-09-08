/**
 * importCustomers.js — wizard "Impor dari SQL": upload/tempel file .sql -> deteksi tabel &
 * kolom -> user memetakan kolom ke field pelanggan -> pilih cabang tujuan (khusus Owner) ->
 * pratinjau -> kirim ke backend per-batch dengan progress.
 */
import { Api } from '../api.js';
import { parseSqlInserts, resolveColumns } from '../lib/sqlImport.js';
import { toast, openModal, closeModal, escapeHtml, formatRupiah } from '../ui.js';

const TARGET_FIELDS = [
  { key: '', label: '(Lewati kolom ini)' },
  { key: 'name', label: 'Nama Pelanggan *' },
  { key: 'phone', label: 'No. Telepon' },
  { key: 'address', label: 'Alamat' },
  { key: 'package_name', label: 'Nama Paket (dicocokkan otomatis)' },
  { key: 'custom_price', label: 'Harga Langganan (Rp)' },
  { key: 'pppoe_username', label: 'Username PPPoE' },
  { key: 'mac_address', label: 'MAC Address' },
  { key: 'install_date', label: 'Tanggal Pasang' },
  { key: 'due_date_day', label: 'Tgl Jatuh Tempo (angka hari)' },
  { key: 'notes', label: 'Catatan' },
];

const BATCH_SIZE = 200;

export function openImportWizard({ importAction, branches, showBranch }) {
  const state = { tables: [], tableIdx: 0, columns: [], mapping: [], branchId: showBranch ? '' : null };

  const overlay = openModal(`<div id="wizard-body"></div>`, { wide: true, persistent: true });
  renderUpload();

  function body() { return overlay.querySelector('#wizard-body'); }

  function renderUpload() {
    body().innerHTML = `
      <div class="modal-header"><h3>Impor Pelanggan dari File SQL</h3></div>
      <div class="modal-body">
        <p class="hint" style="margin-top:0">Unggah file <code>.sql</code> hasil export (mis. dari phpMyAdmin) yang berisi perintah <code>INSERT INTO ...</code> data pelanggan lama Anda. Tidak ada data yang dikirim ke pihak lain — file diproses langsung di browser Anda.</p>
        <div class="field"><label>File .sql</label><input type="file" id="file-input" accept=".sql,.txt" /></div>
        <p class="hint">atau tempel isi file di sini:</p>
        <div class="field"><textarea id="sql-text" rows="8" placeholder="INSERT INTO pelanggan (...) VALUES (...);"></textarea></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-close">Batal</button>
        <button type="button" class="btn btn-primary" id="btn-parse">Lanjut: Deteksi Data</button>
      </div>
    `;
    body().querySelector('#btn-close').onclick = closeModal;
    body().querySelector('#file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      body().querySelector('#sql-text').value = await file.text();
    });
    body().querySelector('#btn-parse').onclick = () => {
      const text = body().querySelector('#sql-text').value;
      if (!text.trim()) { toast('Pilih file atau tempel isi SQL dulu', 'error'); return; }
      let tables;
      try { tables = parseSqlInserts(text); } catch (err) { toast('Gagal membaca file: ' + err.message, 'error'); return; }
      if (!tables.length) { toast('Tidak ditemukan perintah INSERT INTO pada file/teks ini.', 'error'); return; }
      state.tables = tables;
      state.tableIdx = tables.length === 1 ? 0 : -1;
      if (state.tableIdx === -1) renderTablePicker(); else selectTable(0);
    };
  }

  function renderTablePicker() {
    body().innerHTML = `
      <div class="modal-header"><h3>Pilih Tabel Sumber</h3></div>
      <div class="modal-body">
        <p class="hint" style="margin-top:0">Ditemukan beberapa tabel di file ini. Pilih yang berisi data pelanggan:</p>
        ${state.tables.map((t, i) => `
          <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:pointer">
            <input type="radio" name="tbl" value="${i}" ${i === 0 ? 'checked' : ''} />
            <div><strong>${escapeHtml(t.table)}</strong><div class="text-muted" style="font-size:.8rem">${t.rows.length} baris</div></div>
          </label>`).join('')}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-back">Kembali</button>
        <button type="button" class="btn btn-primary" id="btn-next">Lanjut</button>
      </div>
    `;
    body().querySelector('#btn-back').onclick = renderUpload;
    body().querySelector('#btn-next').onclick = () => {
      const idx = Number(body().querySelector('input[name=tbl]:checked').value);
      selectTable(idx);
    };
  }

  function selectTable(idx) {
    state.tableIdx = idx;
    const table = state.tables[idx];
    state.columns = resolveColumns(table);
    state.mapping = state.columns.map((colName) => guessMapping(colName));
    renderMapping();
  }

  function guessMapping(colName) {
    const c = colName.toLowerCase();
    if (/nama|name/.test(c)) return 'name';
    if (/telp|phone|hp|whatsapp|wa\b/.test(c)) return 'phone';
    if (/alamat|address/.test(c)) return 'address';
    if (/paket|package|plan/.test(c)) return 'package_name';
    if (/harga|price|tarif/.test(c)) return 'custom_price';
    if (/pppoe|ppp_user|username/.test(c)) return 'pppoe_username';
    if (/mac/.test(c)) return 'mac_address';
    if (/pasang|install/.test(c)) return 'install_date';
    if (/jatuh_tempo|due_date|tempo/.test(c)) return 'due_date_day';
    if (/catatan|note|keterangan/.test(c)) return 'notes';
    return '';
  }

  function renderMapping() {
    const table = state.tables[state.tableIdx];
    body().innerHTML = `
      <div class="modal-header"><h3>Petakan Kolom — tabel "${escapeHtml(table.table)}" (${table.rows.length} baris)</h3></div>
      <div class="modal-body">
        <p class="hint" style="margin-top:0">Cocokkan tiap kolom SQL ke field pelanggan di aplikasi. Kolom "Nama Pelanggan" wajib dipetakan.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Kolom SQL</th><th>Contoh Data</th><th>Dipetakan Ke</th></tr></thead>
            <tbody>
              ${state.columns.map((col, i) => `
                <tr>
                  <td><strong>${escapeHtml(col)}</strong></td>
                  <td class="text-muted" style="font-size:.8rem">${table.rows.slice(0, 3).map(r => escapeHtml(String(r[i] ?? ''))).join(', ') || '-'}</td>
                  <td>
                    <select data-col="${i}" class="map-select">
                      ${TARGET_FIELDS.map(f => `<option value="${f.key}" ${state.mapping[i] === f.key ? 'selected' : ''}>${f.label}</option>`).join('')}
                    </select>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-back">Kembali</button>
        <button type="button" class="btn btn-primary" id="btn-next">Lanjut: Pratinjau</button>
      </div>
    `;
    body().querySelectorAll('.map-select').forEach(sel => sel.onchange = (e) => {
      state.mapping[Number(e.target.dataset.col)] = e.target.value;
    });
    body().querySelector('#btn-back').onclick = () => (state.tables.length > 1 ? renderTablePicker() : renderUpload());
    body().querySelector('#btn-next').onclick = () => {
      if (!state.mapping.includes('name')) { toast('Petakan minimal satu kolom ke "Nama Pelanggan"', 'error'); return; }
      renderPreview();
    };
  }

  function buildMappedRows() {
    const table = state.tables[state.tableIdx];
    return table.rows.map((row) => {
      const obj = {};
      state.mapping.forEach((target, i) => { if (target) obj[target] = row[i]; });
      return obj;
    });
  }

  function renderPreview() {
    const mapped = buildMappedRows();
    const withName = mapped.filter(r => String(r.name || '').trim());
    const skippedCount = mapped.length - withName.length;

    body().innerHTML = `
      <div class="modal-header"><h3>Pratinjau Impor</h3></div>
      <div class="modal-body">
        ${showBranch ? `
          <div class="field">
            <label>Impor ke Cabang</label>
            <select id="branch-select">
              <option value="">- Pilih Cabang -</option>
              ${branches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
            </select>
          </div>` : ''}
        <p><strong>${withName.length}</strong> pelanggan siap diimpor. ${skippedCount > 0 ? `<span style="color:var(--warning)">${skippedCount} baris dilewati karena nama kosong.</span>` : ''}</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nama</th><th>Telepon</th><th>Paket</th><th>Harga</th><th>PPPoE</th><th>Jatuh Tempo</th></tr></thead>
            <tbody>
              ${withName.slice(0, 10).map(r => `
                <tr>
                  <td>${escapeHtml(r.name || '')}</td>
                  <td>${escapeHtml(r.phone || '-')}</td>
                  <td>${escapeHtml(r.package_name || '-')}</td>
                  <td>${r.custom_price ? formatRupiah(r.custom_price) : '-'}</td>
                  <td>${escapeHtml(r.pppoe_username || '-')}</td>
                  <td>${escapeHtml(String(r.due_date_day || '-'))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${withName.length > 10 ? `<p class="hint">...dan ${withName.length - 10} baris lainnya.</p>` : ''}
        <div id="progress-slot"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-back">Kembali</button>
        <button type="button" class="btn btn-primary" id="btn-import">Impor ${withName.length} Pelanggan</button>
      </div>
    `;
    body().querySelector('#btn-back').onclick = renderMapping;
    body().querySelector('#btn-import').onclick = () => runImport(withName);
  }

  async function runImport(rows) {
    let branchId = state.branchId;
    if (showBranch) {
      branchId = body().querySelector('#branch-select')?.value;
      if (!branchId) { toast('Pilih cabang tujuan dulu', 'error'); return; }
    }

    const btn = body().querySelector('#btn-import');
    const backBtn = body().querySelector('#btn-back');
    btn.disabled = true;
    if (backBtn) backBtn.disabled = true;

    const batches = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) batches.push(rows.slice(i, i + BATCH_SIZE));

    let imported = 0;
    const allSkipped = [];
    const progressSlot = body().querySelector('#progress-slot');

    for (let i = 0; i < batches.length; i++) {
      progressSlot.innerHTML = `<p class="hint"><span class="spinner" style="border-top-color:var(--primary);border-color:var(--border)"></span> Mengimpor batch ${i + 1} dari ${batches.length}...</p>`;
      try {
        const res = await Api.call(importAction, { branch_id: branchId, rows: batches[i] });
        imported += res.imported;
        allSkipped.push(...res.skipped);
      } catch (err) {
        progressSlot.innerHTML = `<p style="color:var(--danger)">Impor berhenti di batch ${i + 1}: ${err.message}. ${imported} pelanggan sudah berhasil diimpor sebelum error ini.</p>`;
        btn.disabled = false;
        if (backBtn) backBtn.disabled = false;
        return;
      }
    }

    body().innerHTML = `
      <div class="modal-header"><h3>Impor Selesai</h3></div>
      <div class="modal-body">
        <p><strong style="color:var(--success)">${imported}</strong> pelanggan berhasil diimpor.</p>
        ${allSkipped.length ? `<p style="color:var(--warning)">${allSkipped.length} baris dilewati:</p>
          <div class="table-wrap" style="max-height:220px;overflow-y:auto">
            <table><thead><tr><th>Baris</th><th>Alasan</th></tr></thead><tbody>
              ${allSkipped.slice(0, 50).map(s => `<tr><td>${s.row}</td><td>${escapeHtml(s.reason)}</td></tr>`).join('')}
            </tbody></table>
          </div>` : ''}
      </div>
      <div class="modal-footer"><button class="btn btn-primary" id="btn-done">Selesai</button></div>
    `;
    body().querySelector('#btn-done').onclick = () => { closeModal(); onImportDone(); };
  }

  let onImportDone = () => {};
  return {
    onDone(cb) { onImportDone = cb; }
  };
}
