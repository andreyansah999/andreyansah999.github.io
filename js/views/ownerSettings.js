import { Api } from '../api.js';
import { State } from '../state.js';
import { toast, setLoading } from '../ui.js';
import { withCache, Cache } from '../cache.js';

const CACHE_KEY = 'owner.settings.get';

export async function renderOwnerSettings(container) {
  await withCache(container, CACHE_KEY, () => Api.call('owner.settings.get'), (settings) => draw(container, settings));
}

function draw(container, settings) {
  container.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-header"><h3>Pengaturan Umum</h3></div>
        <form id="settings-form">
          <div class="field"><label>Nama Aplikasi</label><input name="app_name" value="${settings.app_name}" /></div>
          <div class="field">
            <label>Kelonggaran Telat Bayar Default (hari)</label>
            <input type="number" min="0" max="60" name="grace_period_days" value="${settings.grace_period_days}" />
            <p class="hint">Dipakai untuk cabang yang TIDAK mengatur kelonggarannya sendiri (lihat menu Cabang).</p>
          </div>
          <div class="field" style="display:flex;align-items:center;gap:10px">
            <label class="switch"><input type="checkbox" name="auto_suspend_enabled" ${settings.auto_suspend_enabled === 'true' ? 'checked' : ''} /><span class="track"></span></label>
            <span>Otomatis matikan WiFi saat telat bayar melewati masa tenggang</span>
          </div>
          <button class="btn btn-primary" id="btn-save" type="submit">Simpan</button>
        </form>
      </div>

      <div class="card">
        <div class="card-header"><h3>Ganti Password Saya</h3></div>
        <form id="password-form">
          <div class="field"><label>Password Lama</label><input type="password" name="old_password" required /></div>
          <div class="field"><label>Password Baru</label><input type="password" name="new_password" required minlength="6" /></div>
          <button class="btn btn-primary" id="btn-pw" type="submit">Ganti Password</button>
        </form>
      </div>
    </div>
  `;

  container.querySelector('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = container.querySelector('#btn-save');
    setLoading(btn, true);
    try {
      const updated = await Api.call('owner.settings.save', {
        app_name: fd.get('app_name'),
        grace_period_days: Number(fd.get('grace_period_days')),
        auto_suspend_enabled: fd.get('auto_suspend_enabled') === 'on'
      });
      Cache.set(CACHE_KEY, updated);
      State.updateAppName(updated.app_name);
      const brandText = document.querySelector('.sidebar-brand strong');
      if (brandText) brandText.textContent = updated.app_name;
      document.title = updated.app_name + ' - ' + (State.user.branch ? State.user.branch.name : 'Owner');
      toast('Pengaturan disimpan', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(btn, false); btn.textContent = 'Simpan'; }
  });

  container.querySelector('#password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = container.querySelector('#btn-pw');
    setLoading(btn, true);
    try {
      await Api.call('auth.change_password', { old_password: fd.get('old_password'), new_password: fd.get('new_password') });
      toast('Password berhasil diganti', 'success');
      e.target.reset();
    } catch (err) { toast(err.message, 'error'); }
    finally { setLoading(btn, false); btn.textContent = 'Ganti Password'; }
  });
}
