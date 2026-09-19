import { Router } from 'express';
import { db } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { statusStok, ubahStok } from '../stok.js';
import { angka, bungkus, GalatPermintaan } from '../http.js';

export const rutInventory = Router();
rutInventory.use(wajibMasuk);

/** Daftar stok dengan status dan nilai persediaan per produk. */
rutInventory.get('/stok', (req, res) => {
  const status = String(req.query.status ?? '');
  const baris = db
    .prepare(
      `SELECT p.id, p.sku, p.nama, p.satuan, p.stok, p.stok_minimum, p.harga_beli, p.harga_jual,
              k.nama AS kategori, s.nama AS supplier,
              p.stok * p.harga_beli AS nilai_stok
       FROM produk p
       LEFT JOIN kategori k ON k.id = p.kategori_id
       LEFT JOIN supplier s ON s.id = p.supplier_id
       WHERE p.aktif = 1 ORDER BY p.nama`
    )
    .all() as any[];

  const hasil = baris.map((p) => ({ ...p, status_stok: statusStok(p.stok, p.stok_minimum) }));
  res.json(status ? hasil.filter((h) => h.status_stok === status) : hasil);
});

/**
 * Kartu stok satu produk: saldo awal pada rentang, seluruh mutasi, dan saldo
 * akhir. Saldo awal dibaca dari stok_sebelum mutasi pertama dalam rentang,
 * bukan dihitung mundur dari stok sekarang, supaya angkanya tetap benar
 * meskipun ada mutasi yang dimasukkan dengan tanggal mundur.
 */
rutInventory.get(
  '/mutasi/:produkId',
  bungkus((req, res) => {
    const produkId = Number(req.params.produkId);
    const dari = String(req.query.dari ?? '1900-01-01');
    const sampai = String(req.query.sampai ?? '2999-12-31');

    const produk = db.prepare('SELECT id, sku, nama, satuan, stok FROM produk WHERE id = ?').get(produkId) as any;
    if (!produk) throw new GalatPermintaan('Produk tidak ditemukan.', 404);

    const mutasi = db
      .prepare(
        `SELECT m.*, u.nama AS nama_pengguna
         FROM mutasi_stok m LEFT JOIN pengguna u ON u.id = m.oleh
         WHERE m.produk_id = ? AND date(m.waktu) BETWEEN ? AND ?
         ORDER BY m.waktu, m.id`
      )
      .all(produkId, dari, sampai) as any[];

    const stokAwal = mutasi.length
      ? mutasi[0].stok_sebelum
      : ((db
          .prepare(`SELECT stok_sesudah FROM mutasi_stok WHERE produk_id = ? AND date(waktu) < ? ORDER BY waktu DESC, id DESC LIMIT 1`)
          .get(produkId, dari) as any)?.stok_sesudah ?? 0);

    const ringkas = mutasi.reduce(
      (a, m) => {
        if (m.tipe === 'masuk') a.masuk += m.qty;
        else if (m.tipe === 'keluar') a.keluar += Math.abs(m.qty);
        else a.adjustment += m.qty;
        return a;
      },
      { masuk: 0, keluar: 0, adjustment: 0 }
    );

    res.json({
      produk,
      stok_awal: stokAwal,
      stok_akhir: mutasi.length ? mutasi[mutasi.length - 1].stok_sesudah : stokAwal,
      ...ringkas,
      mutasi,
    });
  })
);

/**
 * Stock opname: qty hasil hitung fisik menggantikan stok sistem, selisihnya
 * tercatat sebagai satu mutasi adjustment per produk dengan alasan wajib.
 */
rutInventory.post(
  '/opname',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus((req, res) => {
    const item: Array<{ produk_id: number; qty_fisik: number }> = Array.isArray(req.body?.item) ? req.body.item : [];
    if (item.length === 0) throw new GalatPermintaan('Tidak ada produk yang dihitung.');
    const alasan = String(req.body?.alasan ?? '').trim();
    if (!alasan) throw new GalatPermintaan('Alasan opname wajib diisi agar selisih stok bisa ditelusuri.');

    const jalankan = db.transaction(() => {
      const hasil: any[] = [];
      for (const it of item) {
        const produkId = Number(it.produk_id);
        const fisik = Math.round(angka(it.qty_fisik, -1));
        if (fisik < 0) throw new GalatPermintaan('Qty hasil hitung fisik tidak boleh kosong atau negatif.');

        const p = db.prepare('SELECT id, nama, stok FROM produk WHERE id = ?').get(produkId) as any;
        if (!p) throw new GalatPermintaan(`Produk #${produkId} tidak ditemukan.`, 404);

        const selisih = fisik - p.stok;
        if (selisih === 0) continue;

        ubahStok({
          produkId, delta: selisih, tipe: 'adjustment', refTipe: 'opname',
          catatan: `Opname: sistem ${p.stok} → fisik ${fisik}. ${alasan}`,
          oleh: req.pengguna, izinkanMinus: true,
        });
        hasil.push({ produk: p.nama, stok_sistem: p.stok, stok_fisik: fisik, selisih });
      }
      return hasil;
    });

    const perubahan = jalankan();
    catatAudit({
      user: req.pengguna, aksi: 'opname', entitas: 'inventory',
      ringkasan: `${perubahan.length} produk disesuaikan. ${alasan}`, nilaiBaru: perubahan,
    });
    res.json({ ok: true, jumlah_disesuaikan: perubahan.length, perubahan });
  })
);

/** Penyesuaian satu produk di luar opname, misalnya barang rusak atau susut. */
rutInventory.post(
  '/adjustment',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus((req, res) => {
    const produkId = Number(req.body?.produk_id);
    const delta = Math.round(angka(req.body?.delta));
    const alasan = String(req.body?.alasan ?? '').trim();
    if (!produkId || delta === 0) throw new GalatPermintaan('Produk dan jumlah penyesuaian wajib diisi.');
    if (!alasan) throw new GalatPermintaan('Alasan penyesuaian wajib diisi.');

    const hasil = ubahStok({
      produkId, delta, tipe: 'adjustment', refTipe: 'adjustment',
      catatan: alasan, oleh: req.pengguna, izinkanMinus: false,
    });
    catatAudit({
      user: req.pengguna, aksi: 'adjustment', entitas: 'produk', entitasId: produkId,
      ringkasan: `${delta > 0 ? '+' : ''}${delta} — ${alasan}`, nilaiLama: { stok: hasil.stokSebelum }, nilaiBaru: { stok: hasil.stokSesudah },
    });
    res.json({ ok: true, ...hasil });
  })
);
