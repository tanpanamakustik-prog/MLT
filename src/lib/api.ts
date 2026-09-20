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
const KUNCI_SERVER = 'mlt.server';

/* Alamat yang ditanam saat build. Dipakai sebagai nilai awal, bukan sebagai
   keputusan akhir. */
const BAWAAN_API = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/**
 * Alamat server yang sedang dipakai.
 *
 * Urutannya: yang disimpan pengguna, lalu yang ditanam saat build.
 *
 * Bisa diubah dari dalam aplikasi karena alamat yang ditanam saat build tidak
 * bertahan: router membagikan alamat lewat DHCP dan nomornya berganti sendiri,
 * lalu APK di ponsel semua orang menunjuk ke alamat yang sudah dipakai
 * perangkat lain. Membangun ulang APK setiap kali itu terjadi bukan jawaban.
 */
export const ambilAkarApi = (): string => {
  try {
    return (localStorage.getItem(KUNCI_SERVER) ?? BAWAAN_API).replace(/\/$/, '');
  } catch {
    return BAWAAN_API;
  }
};

export const simpanAkarApi = (alamat: string) => {
  const bersih = alamat.trim().replace(/\/$/, '');
  if (bersih) localStorage.setItem(KUNCI_SERVER, bersih);
  else localStorage.removeItem(KUNCI_SERVER);
};

/** Aplikasi berjalan di dalam APK, bukan di peramban biasa. */
export const diAplikasi = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).Capacitor;

/** Melengkapi jalur berkas unggahan menjadi URL utuh untuk APK. */
export const urlBerkas = (jalur: string | null | undefined): string | undefined =>
  jalur ? (jalur.startsWith('http') ? jalur : ambilAkarApi() + jalur) : undefined;

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

export class GalatJaringan extends Error {
  constructor(public alamat: string) {
    /* Menyebut alamat yang dicoba, bukan sekadar "gagal": penyebab tersering
       adalah alamat yang sudah tidak berlaku, dan tanpa disebut tidak ada yang
       bisa menebaknya dari layar ponsel. */
    super(
      alamat
        ? `Tidak dapat menghubungi server di ${alamat}. Periksa apakah alamatnya masih benar dan ponsel berada di jaringan yang sama.`
        : 'Tidak dapat menghubungi server.'
    );
    this.name = 'GalatJaringan';
  }
}

async function permintaan<T>(metode: string, jalur: string, isi?: unknown): Promise<T> {
  const token = ambilToken();
  const akar = ambilAkarApi();
  let res: Response;
  try {
    res = await fetch(`${akar}/api${jalur}`, {
      method: metode,
      headers: {
        ...(isi !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isi !== undefined ? JSON.stringify(isi) : undefined,
    });
  } catch {
    throw new GalatJaringan(akar);
  }

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
