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

/**
 * Menyimpan foto yang dikirim APK sebagai data URL.
 *
 * Capacitor Camera mengembalikan base64, bukan berkas, sehingga jalur multipart
 * tidak terpakai di lapangan. Jenis berkas dibatasi pada gambar: foto absensi
 * dan bukti kirim disajikan kembali lewat URL publik, dan melayani berkas
 * sembarang dari sana membuat server ikut menyebarkan apa pun yang diunggah.
 */
export function simpanFotoBase64(dataUrl: unknown, awalan: string): string | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;

  const cocok = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!cocok) throw new GalatPermintaan('Format foto tidak dikenali.');

  const ekstensi = JENIS_DIIZINKAN[cocok[1]];
  if (!ekstensi) throw new GalatPermintaan('Foto harus berformat JPG, PNG, atau WebP.');

  const isi = Buffer.from(cocok[2], 'base64');
  if (isi.length > MAKS_BYTE) throw new GalatPermintaan('Ukuran foto melebihi 5 MB.');

  fs.mkdirSync(DIR_UNGGAH, { recursive: true });
  const nama = `${awalan}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ekstensi}`;
  fs.writeFileSync(path.join(DIR_UNGGAH, nama), isi);
  return `/uploads/${nama}`;
}
