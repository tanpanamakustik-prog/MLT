import { db, ambilPengaturan } from './db.js';

export interface SaranKulakan {
  produk_id: number;
  sku: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  avg_harian: number;
  lead_time_hari: number;
  safety_stock: number;
  reorder_point: number;
  target_stok: number;
  saran_qty: number;
  perkiraan_biaya: number;
  hari_tersisa: number | null;
  supplier_id: number | null;
  supplier: string | null;
  perlu_kulakan: boolean;
}

/**
 * Saran pembelian per produk.
 *
 * Rumusnya:
 *   avg_harian     = qty terjual N hari terakhir / N
 *   reorder_point  = avg_harian x lead_time + safety_stock
 *   target_stok    = reorder_point + avg_harian x hari_cakupan
 *   saran_qty      = (target_stok - stok), dibulatkan ke atas ke kelipatan beli
 *
 * PRD mencontohkan stok 125, avg 32/hari, lead 3 hari, safety 50 sehingga
 * reorder point 146 lalu menyarankan pembelian 150. Angka 150 di sana adalah
 * reorder point yang dibulatkan, yang berarti pesanan datang tepat saat stok
 * menyentuh titik pesan dan langsung turun lagi ke ambang yang sama. Di sini
 * pembelian diarahkan ke target_stok, yaitu titik pesan ditambah cakupan
 * penjualan beberapa hari, supaya setelah barang datang stoknya benar-benar
 * berada di atas ambang. Lama cakupan dapat diubah owner lewat pengaturan.
 *
 * Penjualan tiap produk dihitung lewat satu agregat bergabung, bukan subkueri
 * berkorelasi per baris: yang kedua menjalankan satu kueri untuk tiap produk
 * dan biayanya tumbuh seiring katalog bertambah.
 */
export async function hitungSaranKulakan(opsi?: { hanyaPerlu?: boolean; hariRiwayat?: number }): Promise<SaranKulakan[]> {
  const hariRiwayat = opsi?.hariRiwayat ?? Number(await ambilPengaturan('kulakan_hari_riwayat', '30'));
  const hariCakupan = Number(await ambilPengaturan('kulakan_hari_cakupan', '7'));

  const baris = await db.banyak<any>(
    `WITH terjual AS (
       SELECT i.produk_id, SUM(i.qty)::bigint AS qty
       FROM pesanan_item i
       JOIN pesanan o ON o.id = i.pesanan_id
       WHERE o.status_kirim <> 'batal'
         AND o.tanggal >= current_date - ($1::int * INTERVAL '1 day')
       GROUP BY i.produk_id
     )
     SELECT
       p.id, p.sku, p.nama, p.satuan, p.stok, p.stok_minimum, p.safety_stock,
       p.kelipatan_beli, p.harga_beli, p.supplier_id,
       s.nama AS supplier, COALESCE(s.lead_time_hari, 3) AS lead_time_hari,
       COALESCE(t.qty, 0) AS qty_terjual
     FROM produk p
     LEFT JOIN supplier s ON s.id = p.supplier_id
     LEFT JOIN terjual t ON t.produk_id = p.id
     WHERE p.aktif = true
     ORDER BY p.nama`,
    [hariRiwayat]
  );

  const hasil = baris.map((r): SaranKulakan => {
    const avg = Number(r.qty_terjual) / hariRiwayat;
    /* Produk yang belum punya safety stock sendiri memakai stok minimumnya —
       angka itu sudah merupakan penilaian manusia atas batas aman produk ini. */
    const safety = r.safety_stock > 0 ? r.safety_stock : r.stok_minimum;
    const reorderPoint = Math.ceil(avg * r.lead_time_hari + safety);
    const target = Math.ceil(reorderPoint + avg * hariCakupan);
    const kelipatan = Math.max(1, r.kelipatan_beli);
    const kurang = Math.max(0, target - r.stok);
    const saran = Math.ceil(kurang / kelipatan) * kelipatan;

    return {
      produk_id: r.id,
      sku: r.sku,
      nama: r.nama,
      satuan: r.satuan,
      stok: r.stok,
      stok_minimum: r.stok_minimum,
      avg_harian: Math.round(avg * 10) / 10,
      lead_time_hari: r.lead_time_hari,
      safety_stock: safety,
      reorder_point: reorderPoint,
      target_stok: target,
      saran_qty: saran,
      perkiraan_biaya: saran * Number(r.harga_beli),
      /* Produk tanpa penjualan sama sekali tidak punya "hari tersisa" yang
         bermakna; null dibedakan dari nol agar tampilan bisa menuliskannya
         sebagai tidak bergerak, bukan sebagai habis hari ini. */
      hari_tersisa: avg > 0 ? Math.floor(r.stok / avg) : null,
      supplier_id: r.supplier_id,
      supplier: r.supplier,
      perlu_kulakan: r.stok <= reorderPoint,
    };
  });

  return opsi?.hanyaPerlu ? hasil.filter((h) => h.perlu_kulakan) : hasil;
}
