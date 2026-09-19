import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GalatPermintaan } from './http.js';

const DIR_UNGGAH = 'uploads';
const MAKS_BYTE = 5 * 1024 * 1024;
const JENIS_DIIZINKAN: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Satu jepretan dalam dua ukuran, dikirim peramban sebagai data URL. */
export interface FotoMasuk {
  penuh: string;
  kecil?: string;
}

function urai(dataUrl: unknown): { isi: Buffer; ekstensi: string } | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;

  const cocok = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!cocok) throw new GalatPermintaan('Format foto tidak dikenali.');

  const ekstensi = JENIS_DIIZINKAN[cocok[1]];
  if (!ekstensi) throw new GalatPermintaan('Foto harus berformat JPG, PNG, atau WebP.');

  const isi = Buffer.from(cocok[2], 'base64');
  if (isi.length > MAKS_BYTE) throw new GalatPermintaan('Ukuran foto melebihi 5 MB.');
  return { isi, ekstensi };
}

/** Nama berkas versi kecil diturunkan dari nama versi penuh, bukan disimpan
    terpisah di database: satu kolom saja sudah cukup menunjuk keduanya. */
export const namaKecil = (url: string) => url.replace(/(\.[a-z]+)$/i, '-kecil$1');

/**
 * Menyimpan foto yang dikirim APK.
 *
 * Capacitor Camera mengembalikan base64, bukan berkas, sehingga jalur multipart
 * tidak terpakai di lapangan. Jenis berkas dibatasi pada gambar: foto absensi
 * dan bukti kirim disajikan kembali lewat URL publik, dan melayani berkas
 * sembarang dari sana membuat server ikut menyebarkan apa pun yang diunggah.
 *
 * Versi kecil disimpan berdampingan bila dikirim. Daftar memuat versi kecil,
 * versi penuh hanya saat fotonya dibuka — selisihnya sekitar dua puluh empat
 * kali lipat pada kuota egress.
 */
export async function simpanFoto(masuk: unknown, awalan: string): Promise<string | null> {
  const nilai = (typeof masuk === 'string' ? { penuh: masuk } : masuk) as FotoMasuk | null | undefined;
  const penuh = urai(nilai?.penuh);
  if (!penuh) return null;

  fs.mkdirSync(DIR_UNGGAH, { recursive: true });
  const nama = `${awalan}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${penuh.ekstensi}`;
  fs.writeFileSync(path.join(DIR_UNGGAH, nama), penuh.isi);

  const kecil = nilai?.kecil ? urai(nilai.kecil) : null;
  if (kecil) {
    fs.writeFileSync(path.join(DIR_UNGGAH, namaKecil(nama)), kecil.isi);
  }

  return `/uploads/${nama}`;
}
