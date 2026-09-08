/**
 * ui.js — helper UI kecil dipakai di semua view: toast, modal, konfirmasi, format angka/tanggal.
 */

export function formatRupiah(n) {
  n = Number(n) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

export function formatDate(str) {
  if (!str) return '-';
  var d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(str) {
  if (!str) return '-';
  var d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function escapeHtml(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let toastTimer = null;
export function toast(message, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'toast show toast-' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

export function openModal(innerHtml, opts = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box ${opts.wide ? 'modal-wide' : ''}">${innerHtml}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay && !opts.persistent) closeModal(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  return overlay;
}

export function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => {
    const overlay = openModal(`
      <div class="modal-header"><h3>${escapeHtml(opts.title || 'Konfirmasi')}</h3></div>
      <div class="modal-body"><p>${escapeHtml(message)}</p></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="cancel">Batal</button>
        <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${escapeHtml(opts.okLabel || 'Ya')}</button>
      </div>
    `, { persistent: true });
    overlay.querySelector('[data-act="cancel"]').onclick = () => { closeModal(); resolve(false); };
    overlay.querySelector('[data-act="ok"]').onclick = () => { closeModal(); resolve(true); };
  });
}

export function setLoading(el, loading) {
  if (!el) return;
  if (loading) { el.dataset.prevHtml = el.innerHTML; el.innerHTML = '<span class="spinner"></span>'; el.disabled = true; }
  else { el.innerHTML = el.dataset.prevHtml || el.innerHTML; el.disabled = false; }
}

export function badge(text, tone) {
  return `<span class="badge badge-${tone}">${escapeHtml(text)}</span>`;
}

export function statusBadge(status) {
  const map = {
    active: ['Aktif', 'success'], inactive: ['Nonaktif', 'muted'], suspended: ['Suspend', 'danger'],
    on: ['Nyala', 'success'], off: ['Mati', 'danger'],
    lunas: ['Lunas', 'success'], menunggu: ['Menunggu', 'muted'], jatuh_tempo: ['Jatuh Tempo', 'warning'], terlambat: ['Terlambat', 'danger'],
    pending: ['Menunggu', 'muted'], sent: ['Terkirim', 'warning'], applied: ['Diterapkan', 'success'], failed: ['Gagal', 'danger'],
    online: ['Online', 'success'], offline: ['Offline', 'danger'], unknown: ['Tidak Diketahui', 'muted']
  };
  const [label, tone] = map[status] || [status || '-', 'muted'];
  return badge(label, tone);
}
