import { db } from './db.js';
import type { Pengguna } from './auth.js';

export class StokTidakCukup extends Error {
  constructor(public namaProduk: string, public tersedia: number, public diminta: number) {
    super(`Stok ${namaProduk} tidak mencukupi: tersedia ${tersedia}, diminta ${diminta}.`);
    this.name = 'StokTidakCukup';
  }
}

/**
 * Satu-satunya pintu perubahan stok.
 *
 * Kolom produk.stok dan tabel mutasi_stok diperbarui dalam pernyataan yang
 * sama, sehingga stok akhir selalu sama dengan penjumlahan buku besarnya.
 * Rute mana pun yang mengubah produk.stok langsung akan memutus jaminan ini,
 * jadi seluruh modul — penjualan, penerimaan kulakan, opname — memanggil
 * fungsi ini.
 *
 * Pemanggil bertanggung jawab membungkusnya dalam db.transaction() bila
 * perubahan beberapa produk harus berhasil atau gagal bersama-sama.
 */
export function ubahStok(opsi: {
  produkId: number;
  delta: number;
  tipe: 'masuk' | 'keluar' | 'adjustment';
  refTipe?: string;
  refId?: number;
  catatan?: string;
  oleh?: Pengguna;
  /* Hanya diberikan pada stock opname: hasil hitung fisik adalah kebenaran,
     termasuk ketika angkanya mengungkap stok sistem yang selama ini kelebihan. */
  izinkanMinus?: boolean;
  /* Waktu kejadian, bila berbeda dari saat pencatatan. Dipakai penerimaan
     barang yang baru diinput keesokan harinya dan oleh skrip data contoh;
     dibiarkan kosong pada pemakaian normal. */
  waktu?: string;
}): { stokSebelum: number; stokSesudah: number } {
  const produk = db.prepare('SELECT id, nama, stok FROM produk WHERE id = ?').get(opsi.produkId) as
    | { id: number; nama: string; stok: number }
    | undefined;
  if (!produk) throw new Error(`Produk #${opsi.produkId} tidak ditemukan.`);

  const sesudah = produk.stok + opsi.delta;
  if (sesudah < 0 && !opsi.izinkanMinus) {
    throw new StokTidakCukup(produk.nama, produk.stok, Math.abs(opsi.delta));
  }

  db.prepare('UPDATE produk SET stok = ? WHERE id = ?').run(sesudah, produk.id);
  db.prepare(
    `INSERT INTO mutasi_stok (produk_id, tipe, qty, stok_sebelum, stok_sesudah, ref_tipe, ref_id, catatan, oleh, waktu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')))`
  ).run(
    produk.id,
    opsi.tipe,
    opsi.delta,
    produk.stok,
    sesudah,
    opsi.refTipe ?? null,
    opsi.refId ?? null,
    opsi.catatan ?? null,
    opsi.oleh?.id ?? null,
    opsi.waktu ?? null
  );

  return { stokSebelum: produk.stok, stokSesudah: sesudah };
}

export type StatusStok = 'critical' | 'low' | 'normal' | 'overstock';

/**
 * Empat tingkat status pada PRD, diturunkan dari stok minimum tiap produk.
 *
 * Ambang overstock memakai kelipatan stok minimum, bukan angka tetap: 500 sak
 * beras adalah timbunan bagi produk dengan minimum 50, tapi belum seminggu
 * jualan bagi produk dengan minimum 400.
 */
export function statusStok(stok: number, stokMinimum: number): StatusStok {
  if (stokMinimum <= 0) return stok <= 0 ? 'critical' : 'normal';
  if (stok <= stokMinimum * 0.25) return 'critical';
  if (stok <= stokMinimum) return 'low';
  if (stok >= stokMinimum * 5) return 'overstock';
  return 'normal';
}
