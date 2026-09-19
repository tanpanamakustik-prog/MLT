import { db } from './db.js';
import type { Pengguna } from './auth.js';

/**
 * Jejak audit untuk aksi yang mengubah uang, stok, atau harga.
 *
 * Dicatat di luar transaksi pemanggilnya secara sengaja: kegagalan menulis log
 * tidak boleh membatalkan transaksi bisnis yang sudah sah. Yang wajib utuh
 * adalah stok dan pesanannya; catatan audit adalah lapisan pengawasan.
 */
export function catatAudit(opsi: {
  user?: Pengguna;
  aksi: string;
  entitas: string;
  entitasId?: number;
  ringkasan?: string;
  nilaiLama?: unknown;
  nilaiBaru?: unknown;
}) {
  try {
    db.prepare(
      `INSERT INTO audit_log (user_id, nama_user, aksi, entitas, entitas_id, ringkasan, nilai_lama, nilai_baru)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      opsi.user?.id ?? null,
      opsi.user?.nama ?? 'sistem',
      opsi.aksi,
      opsi.entitas,
      opsi.entitasId ?? null,
      opsi.ringkasan ?? null,
      opsi.nilaiLama === undefined ? null : JSON.stringify(opsi.nilaiLama),
      opsi.nilaiBaru === undefined ? null : JSON.stringify(opsi.nilaiBaru)
    );
  } catch (e) {
    console.error('[audit] gagal mencatat:', e);
  }
}
