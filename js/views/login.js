import { Api } from '../api.js';
import { State } from '../state.js';
import { toast, setLoading } from '../ui.js';

export function renderLogin(onSuccess) {
  const wrap = document.createElement('div');
  wrap.className = 'login-screen';
  wrap.innerHTML = `
    <form class="login-card" id="login-form" autocomplete="off">
      <div class="login-logo">
        <img src="icons/logo192.png" alt="${State.appName}" class="logo-badge" />
        <h1 id="app-name-heading">${State.appName}</h1>
      </div>
      <p class="sub">Masuk untuk mengelola pelanggan &amp; koneksi WiFi cabang Anda.</p>
      <div class="field">
        <label>Username</label>
        <input type="text" name="username" required autofocus placeholder="owner / admin.cabang1" />
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" name="password" required placeholder="••••••••" />
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="btn-submit">Masuk</button>
      <p class="hint" style="text-align:center;margin-top:14px">Lupa password? Hubungi Owner.</p>
    </form>
  `;

  // Ambil nama aplikasi terbaru dari server (kalau Owner pernah menggantinya di menu Pengaturan),
  // supaya halaman login juga ikut update meski belum ada sesi login tersimpan di browser ini.
  Api.call('app.info').then((info) => {
    if (info?.app_name) wrap.querySelector('#app-name-heading').textContent = info.app_name;
  }).catch(() => {});

  wrap.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = wrap.querySelector('#btn-submit');
    const fd = new FormData(e.target);
    setLoading(btn, true);
    try {
      const res = await Api.call('auth.login', { username: fd.get('username').trim(), password: fd.get('password') });
      State.save(res.token, res.user, res.app_name);
      toast('Selamat datang, ' + (res.user.full_name || res.user.username), 'success');
      onSuccess();
    } catch (err) {
      toast(err.message || 'Login gagal', 'error');
    } finally {
      setLoading(btn, false);
      btn.textContent = 'Masuk';
    }
  });

  return wrap;
}
