import type { Kueri } from './db.js';
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
 * Kolom produk.stok dan tabel mutasi_stok diperbarui di dalam transaksi yang
 * sama, sehingga stok akhir selalu sama dengan penjumlahan buku besarnya. Rute
 * mana pun yang mengubah produk.stok langsung akan memutus jaminan ini, jadi
 * seluruh modul — penjualan, penerimaan kulakan, opname — memanggil fungsi ini.
 *
 * Barisnya dikunci dengan FOR UPDATE. Di Postgres dua permintaan bisa benar-benar
 * berjalan bersamaan, tidak seperti SQLite yang menyerialisasi penulisan; tanpa
 * kunci ini, dua penjualan atas produk yang sama dapat membaca stok yang sama
 * lalu sama-sama lolos pemeriksaan dan membuat stok minus.
 */
export async function ubahStok(
  k: Kueri,
  opsi: {
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
       barang yang baru diinput keesokan harinya dan oleh skrip data contoh. */
    waktu?: string;
  }
): Promise<{ stokSebelum: number; stokSesudah: number }> {
  const produk = await k.satu<{ id: number; nama: string; stok: number }>(
    'SELECT id, nama, stok FROM produk WHERE id = $1 FOR UPDATE',
    [opsi.produkId]
  );
  if (!produk) throw new Error(`Produk #${opsi.produkId} tidak ditemukan.`);

  const sesudah = produk.stok + opsi.delta;
  if (sesudah < 0 && !opsi.izinkanMinus) {
    throw new StokTidakCukup(produk.nama, produk.stok, Math.abs(opsi.delta));
  }

  await k.jalankan('UPDATE produk SET stok = $1 WHERE id = $2', [sesudah, produk.id]);
  await k.jalankan(
    `INSERT INTO mutasi_stok (produk_id, tipe, qty, stok_sebelum, stok_sesudah, ref_tipe, ref_id, catatan, oleh, waktu)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()))`,
    [
      produk.id, opsi.tipe, opsi.delta, produk.stok, sesudah,
      opsi.refTipe ?? null, opsi.refId ?? null, opsi.catatan ?? null,
      opsi.oleh?.id ?? null, opsi.waktu ?? null,
    ]
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
