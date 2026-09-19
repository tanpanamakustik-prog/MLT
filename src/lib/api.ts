/**
 * Alamat server API.
 *
 * Kosong di web: halaman dan API disajikan dari asal yang sama, jadi jalur
 * relatif sudah benar. Di APK tidak: Capacitor menyajikan berkas web dari
 * http://localhost di dalam ponsel, sehingga "/api" menunjuk ke ponsel itu
 * sendiri dan tidak ada satu pun permintaan yang sampai. Nilainya diisi saat
 * build lewat VITE_API_BASE.
 *
 * Bukan rahasia — ini alamat publik server, bukan kunci. Yang tidak boleh
 * masuk bundel peramban adalah kunci secret, dan server menolak menyala bila
 * menemukannya berawalan VITE_.
 */
export const AKAR_API = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/** Melengkapi jalur berkas unggahan menjadi URL utuh untuk APK. */
export const urlBerkas = (jalur: string | null | undefined): string | undefined =>
  jalur ? (jalur.startsWith('http') ? jalur : AKAR_API + jalur) : undefined;

const KUNCI_TOKEN = 'mlt.token';

export const ambilToken = () => localStorage.getItem(KUNCI_TOKEN);
export const simpanToken = (t: string) => localStorage.setItem(KUNCI_TOKEN, t);
export const hapusToken = () => localStorage.removeItem(KUNCI_TOKEN);

export class GalatApi extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'GalatApi';
  }
}

/* Dipasang oleh PenyediaAuth. Ketika server menolak token, seluruh aplikasi
   harus kembali ke halaman masuk, termasuk permintaan yang berjalan di latar
   sebuah halaman yang sudah ditinggalkan. */
let saatSesiBerakhir: (() => void) | null = null;
export const pasangPenanganSesiBerakhir = (fn: () => void) => {
  saatSesiBerakhir = fn;
};

async function permintaan<T>(metode: string, jalur: string, isi?: unknown): Promise<T> {
  const token = ambilToken();
  const res = await fetch(`${AKAR_API}/api${jalur}`, {
    method: metode,
    headers: {
      ...(isi !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isi !== undefined ? JSON.stringify(isi) : undefined,
  });

  if (res.status === 401) {
    hapusToken();
    saatSesiBerakhir?.();
    throw new GalatApi('Sesi berakhir. Silakan masuk kembali.', 401);
  }

  const teks = await res.text();
  const data = teks ? JSON.parse(teks) : null;
  if (!res.ok) throw new GalatApi(data?.pesan ?? 'Permintaan gagal diproses.', res.status);
  return data as T;
}

export const api = {
  get: <T,>(jalur: string) => permintaan<T>('GET', jalur),
  post: <T,>(jalur: string, isi?: unknown) => permintaan<T>('POST', jalur, isi ?? {}),
  put: <T,>(jalur: string, isi?: unknown) => permintaan<T>('PUT', jalur, isi ?? {}),
  patch: <T,>(jalur: string, isi?: unknown) => permintaan<T>('PATCH', jalur, isi ?? {}),
  hapus: <T,>(jalur: string) => permintaan<T>('DELETE', jalur),
};

/** Menyusun query string, melewati nilai kosong agar tidak mengirim filter hampa. */
export function kueri(obj: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
