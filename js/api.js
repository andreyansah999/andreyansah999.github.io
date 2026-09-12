/**
 * api.js
 * Client kecil untuk memanggil Apps Script Web App.
 * Body dikirim sebagai text/plain (bukan application/json) supaya browser TIDAK
 * mengirim CORS preflight (OPTIONS) yang tidak didukung Apps Script Web App.
 */
import { CONFIG } from './config.js';
import { State } from './state.js';

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// CATATAN cache: call() ini SENGAJA tidak membersihkan cache lokal setelah aksi tulis
// (save/delete/record/set/import/dll) - itu tanggung jawab masing-masing halaman lewat
// pola reload() + Cache.set() miliknya sendiri (lihat ownerBranches.js, customersShared.js,
// wifiShared.js, dst), supaya pindah ke menu LAIN tidak ikut kena layar loading kosong.
// Pembersihan TOTAL cache saat login/logout sudah ditangani State.save()/State.clear()
// di state.js, jadi tidak perlu diulang di sini.

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
  return json.data;
}

export const Api = { call, ApiError };
