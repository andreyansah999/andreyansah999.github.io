/**
 * cache.js — cache baca di localStorage (per-browser, per-perangkat) supaya tampilan
 * terasa instan, TANPA mengubah cara data ditulis: setiap aksi tambah/edit/hapus/bayar/
 * on-off wifi tetap langsung dikirim ke Apps Script & Google Sheets saat itu juga
 * (lihat api.js) — cache di sini murni untuk mempercepat tampilan saat membuka halaman,
 * bukan tempat penyimpanan utama.
 *
 * Pola pakainya "stale-while-revalidate": kalau ada data tersimpan dari kunjungan
 * sebelumnya, tampilkan dulu itu (instan), lalu di belakang layar ambil data terbaru
 * dari server dan render ulang begitu datang. Jadi data yang dilihat SELALU disegarkan
 * ulang tiap halaman dibuka — cache cuma menghindari layar kosong/spinner lama di awal.
 */
const PREFIX = 'wifimgr_cache:';

export const Cache = {
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage penuh/private mode: abaikan, tetap jalan tanpa cache */ }
  },
  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) {}
  },
  /** Dipanggil saat login/logout supaya data user lama tidak "kelihatan sekilas" saat user lain login di browser yang sama. */
  clearAll() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  }
};

/**
 * @param {HTMLElement} container - elemen halaman (diberi router.js `container._token` saat
 *   navigasi terjadi). Dipakai untuk mendeteksi apakah pengguna SUDAH PINDAH ke halaman lain
 *   sebelum fetch ini selesai — kalau iya, hasilnya dibuang begitu saja (tidak menimpa
 *   tampilan halaman yang sekarang aktif). Ini mencegah "halaman lain muncul sendiri" saat
 *   pindah-pindah menu dengan cepat.
 * @param {string} key - kunci unik data ini (biasanya nama action API-nya)
 * @param {() => Promise<any>} fetcher - pemanggil API yang mengambil data TERBARU dari server
 * @param {(data:any, fromCache:boolean) => void} onData - dipanggil dgn data cache (kalau ada) lalu dgn data terbaru
 */
export async function withCache(container, key, fetcher, onData) {
  const myToken = container._token;
  const isStale = () => container._token !== myToken;

  const cached = Cache.get(key);
  if (cached !== null && !isStale()) {
    try { onData(cached, true); } catch (e) { console.error(e); }
  }
  try {
    const fresh = await fetcher();
    Cache.set(key, fresh);
    if (!isStale()) onData(fresh, false);
    return fresh;
  } catch (err) {
    if (cached === null) throw err; // tidak ada cache & server gagal -> lempar error spt biasa
    if (!isStale()) console.warn('Gagal menyegarkan data dari server, tetap menampilkan data tersimpan sebelumnya.', err);
    return cached;
  }
}

/**
 * Dipakai view yang punya reload() manual sendiri (di luar withCache, biasanya dipanggil
 * setelah simpan/hapus data) supaya juga tidak menimpa halaman lain kalau pengguna sudah
 * pindah sebelum reload-nya selesai:
 *   async function reload() {
 *     const myToken = captureToken(container);
 *     const fresh = await fetchData();
 *     if (isStale(container, myToken)) return; // pengguna sudah pindah halaman, buang hasilnya
 *     initView(container, fresh);
 *   }
 */
export function captureToken(container) {
  return container._token;
}
export function isStale(container, token) {
  return container._token !== token;
}
