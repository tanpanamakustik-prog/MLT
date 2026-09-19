import { db, type Kueri } from './db.js';
import type { Pengguna } from './auth.js';

/* Nilai lama dan baru dipangkas sebelum disimpan. Audit log tumbuh terus tanpa
   pernah dibaca seluruhnya, dan satu dokumen pesanan bisa menghasilkan JSON
   beberapa kilobyte; dibiarkan utuh, tabel ini yang pertama menghabiskan jatah
   500 MB database. Yang dibutuhkan saat menelusuri perubahan adalah bentuk
   nilainya, bukan tiap baris isinya. */
const BATAS_NILAI = 2000;

function ringkas(nilai: unknown): string | null {
  if (nilai === undefined) return null;
  const teks = JSON.stringify(nilai);
  if (teks == null) return null;
  return teks.length > BATAS_NILAI ? teks.slice(0, BATAS_NILAI) + '…(dipotong)' : teks;
}

/**
 * Jejak audit untuk aksi yang mengubah uang, stok, atau harga.
 *
 * Dicatat di luar transaksi pemanggilnya secara sengaja: kegagalan menulis log
 * tidak boleh membatalkan transaksi bisnis yang sudah sah. Yang wajib utuh
 * adalah stok dan pesanannya; catatan audit adalah lapisan pengawasan.
 */
export async function catatAudit(opsi: {
  user?: Pengguna;
  aksi: string;
  entitas: string;
  entitasId?: number;
  ringkasan?: string;
  nilaiLama?: unknown;
  nilaiBaru?: unknown;
  k?: Kueri;
}) {
  try {
    await (opsi.k ?? db).jalankan(
      `INSERT INTO audit_log (user_id, nama_user, aksi, entitas, entitas_id, ringkasan, nilai_lama, nilai_baru)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        opsi.user?.id ?? null,
        opsi.user?.nama ?? 'sistem',
        opsi.aksi,
        opsi.entitas,
        opsi.entitasId ?? null,
        opsi.ringkasan ?? null,
        ringkas(opsi.nilaiLama),
        ringkas(opsi.nilaiBaru),
      ]
    );
  } catch (e) {
    console.error('[audit] gagal mencatat:', e);
  }
}
