/**
 * state.js — penyimpanan sesi sederhana di localStorage.
 */
import { Cache } from './cache.js';

const KEY = 'wifimgr_session';
const DEFAULT_APP_NAME = 'AnterNet';

export const State = {
  get token() { return this._session().token || null; },
  get user() { return this._session().user || null; },
  get appName() { return this._session().appName || DEFAULT_APP_NAME; },

  _session() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) { return {}; }
  },

  save(token, user, appName) {
    Cache.clearAll(); // hindari data cache akun/user sebelumnya "kelihatan sekilas" saat login user baru
    localStorage.setItem(KEY, JSON.stringify({ token, user, appName: appName || DEFAULT_APP_NAME }));
  },

  /** Update nama aplikasi di sesi berjalan (dipanggil setelah Owner ganti nama di menu Pengaturan), tanpa perlu login ulang. */
  updateAppName(appName) {
    const s = this._session();
    s.appName = appName || DEFAULT_APP_NAME;
    localStorage.setItem(KEY, JSON.stringify(s));
  },

  clear() {
    Cache.clearAll();
    localStorage.removeItem(KEY);
  },

  isLoggedIn() {
    return !!this.token;
  },

  isOwner() {
    return this.user && this.user.role === 'owner';
  }
};
