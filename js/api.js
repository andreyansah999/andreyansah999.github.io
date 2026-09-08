/**
 * api.js
 * Client kecil untuk memanggil Apps Script Web App.
 * Body dikirim sebagai text/plain (bukan application/json) supaya browser TIDAK
 * mengirim CORS preflight (OPTIONS) yang tidak didukung Apps Script Web App.
 */
import { CONFIG } from './config.js';
import { State } from './state.js';
import { Cache } from './cache.js';

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Aksi baca (tidak mengubah data) -> aman dijawab dari cache lokal.
// Aksi lain (save/delete/record/set/import/dll) dianggap aksi tulis -> begitu SUKSES,
// seluruh cache lokal dibersihkan supaya kunjungan berikutnya ke halaman manapun (mis.
// Dashboard setelah catat pembayaran) mengambil data segar dari server, bukan angka lama.
const READ_PATTERNS = [/\.list$/, /\.get$/, /\.monitor$/, /\.queue$/, /\.me$/, /dashboard$/];
const READ_EXACT = new Set(['ping', 'app.info', 'owner.activity', 'admin.branch_info']);
function isReadAction(action) {
  return READ_EXACT.has(action) || READ_PATTERNS.some((re) => re.test(action));
}

async function call(action, params = {}) {
  const body = Object.assign({}, params, { action, token: State.token });
  let res;
  try {
    res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new ApiError('NETWORK_ERROR', 'Tidak bisa menghubungi server. Periksa koneksi internet Anda.');
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new ApiError('BAD_RESPONSE', 'Respons server tidak valid. Pastikan API_URL di config.js sudah benar.');
  }

  if (!json.success) {
    const err = new ApiError(json.error?.code, json.error?.message || 'Terjadi kesalahan.');
    if (err.code === 'UNAUTHORIZED') {
      State.clear();
      location.hash = '#/login';
    }
    throw err;
  }
  if (!isReadAction(action)) Cache.clearAll();
  return json.data;
}

export const Api = { call, ApiError };
