import { Router } from 'express';
import { db, transaksi } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { ubahStok } from '../stok.js';
import { hitungSaranKulakan } from '../kulakan-cerdas.js';
import { hariIni, nomorBerikutnya } from '../util.js';
import { angka, bungkus, GalatPermintaan } from '../http.js';

export const rutKulakan = Router();
rutKulakan.use(wajibMasuk);

/** Saran pembelian (Smart Kulakan). */
rutKulakan.get(
  '/saran',
  bungkus(async (req, res) => {
    res.json(await hitungSaranKulakan({ hanyaPerlu: req.query.hanya_perlu === '1' }));
  })
);

rutKulakan.get(
  '/',
  bungkus(async (req, res) => {
    const { dari, sampai, status } = req.query as Record<string, string>;
    const batas = Math.min(300, Math.max(1, Math.round(angka(req.query.batas, 100))));
    res.json(
      await db.banyak(
        `SELECT b.id, b.nomor, b.tanggal, b.total, b.status, s.nama AS supplier,
                COALESCE(i.jumlah_item, 0) AS jumlah_item
         FROM pembelian b
         JOIN supplier s ON s.id = b.supplier_id
         LEFT JOIN (SELECT pembelian_id, COUNT(*)::int AS jumlah_item FROM pembelian_item GROUP BY pembelian_id) i
                ON i.pembelian_id = b.id
         WHERE ($1::date IS NULL OR b.tanggal >= $1::date)
           AND ($2::date IS NULL OR b.tanggal <= $2::date)
           AND ($3::text IS NULL OR b.status = $3)
         ORDER BY b.tanggal DESC, b.id DESC LIMIT $4`,
        [dari ?? null, sampai ?? null, status ?? null, batas]
      )
    );
  })
);

rutKulakan.get(
  '/:id',
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const po = await db.satu<any>(
      `SELECT b.*, s.nama AS supplier, s.alamat, s.kontak
       FROM pembelian b JOIN supplier s ON s.id = b.supplier_id WHERE b.id = $1`,
      [id]
    );
    if (!po) throw new GalatPermintaan('Purchase order tidak ditemukan.', 404);
    po.item = await db.banyak(
      `SELECT i.id, i.produk_id, i.qty, i.qty_diterima, i.harga, i.subtotal, p.nama, p.sku, p.satuan
       FROM pembelian_item i JOIN produk p ON p.id = i.produk_id WHERE i.pembelian_id = $1 ORDER BY i.id`,
      [id]
    );
    res.json(po);
  })
);

rutKulakan.post(
  '/',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus(async (req, res) => {
    const b = req.body ?? {};
    const supplierId = Number(b.supplier_id);
    if (!supplierId) throw new GalatPermintaan('Supplier wajib dipilih.');
    const item: Array<{ produk_id: number; qty: number; harga?: number }> = Array.isArray(b.item) ? b.item : [];
    if (item.length === 0) throw new GalatPermintaan('Purchase order harus berisi minimal satu produk.');

    const hasil = await transaksi(async (k) => {
      const nomor = await nomorBerikutnya(k, 'pembelian', 'PO');
      const dibuat = await k.satu<{ id: number }>(
        `INSERT INTO pembelian (nomor, supplier_id, tanggal, total, status, catatan, dibuat_oleh)
         VALUES ($1, $2, $3, 0, 'dipesan', $4, $5) RETURNING id`,
        [nomor, supplierId, String(b.tanggal || hariIni()), b.catatan ?? null, req.pengguna!.id]
      );
      const poId = dibuat!.id;

      let total = 0;
      for (const it of item) {
        const produkId = Number(it.produk_id);
        const qty = Math.round(angka(it.qty));
        if (!produkId || qty <= 0) throw new GalatPermintaan('Setiap baris pembelian butuh produk dan qty lebih dari nol.');
        const p = await k.satu<any>('SELECT harga_beli, nama FROM produk WHERE id = $1', [produkId]);
        if (!p) throw new GalatPermintaan(`Produk #${produkId} tidak ditemukan.`, 404);
        const harga = it.harga != null ? Math.round(angka(it.harga)) : Number(p.harga_beli);
        const sub = harga * qty;
        total += sub;
        await k.jalankan(
          'INSERT INTO pembelian_item (pembelian_id, produk_id, qty, harga, subtotal) VALUES ($1, $2, $3, $4, $5)',
          [poId, produkId, qty, harga, sub]
        );
      }
      await k.jalankan('UPDATE pembelian SET total = $1 WHERE id = $2', [total, poId]);
      return { id: poId, nomor, total };
    });

    await catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'pembelian', entitasId: hasil.id, ringkasan: `${hasil.nomor} — Rp${hasil.total.toLocaleString('id-ID')}` });
    res.status(201).json(hasil);
  })
);

/**
 * Penerimaan barang.
 *
 * Qty diterima boleh berbeda dari qty pesan — supplier bahan pokok kerap
 * mengirim kurang. Stok bertambah sebesar yang benar-benar diterima, dan
 * harga beli produk diperbarui ke harga pada PO ini supaya perhitungan margin
 * penjualan berikutnya memakai harga kulakan terbaru.
 */
rutKulakan.post(
  '/:id/terima',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const diterima: Array<{ produk_id: number; qty_diterima: number }> = Array.isArray(req.body?.item) ? req.body.item : [];

    const nomor = await transaksi(async (k) => {
      const po = await k.satu<any>('SELECT * FROM pembelian WHERE id = $1 FOR UPDATE', [id]);
      if (!po) throw new GalatPermintaan('Purchase order tidak ditemukan.', 404);
      if (po.status === 'diterima') throw new GalatPermintaan('Purchase order ini sudah diterima.', 409);
      if (po.status === 'batal') throw new GalatPermintaan('Purchase order ini sudah dibatalkan.', 409);

      const baris = await k.banyak<any>('SELECT * FROM pembelian_item WHERE pembelian_id = $1', [id]);
      for (const r of baris) {
        const kiriman = diterima.find((d) => Number(d.produk_id) === r.produk_id);
        const qty = kiriman ? Math.round(angka(kiriman.qty_diterima)) : r.qty;
        if (qty < 0) throw new GalatPermintaan('Qty diterima tidak boleh negatif.');
        if (qty === 0) continue;

        await k.jalankan('UPDATE pembelian_item SET qty_diterima = $1 WHERE id = $2', [qty, r.id]);
        await ubahStok(k, {
          produkId: r.produk_id, delta: qty, tipe: 'masuk',
          refTipe: 'pembelian', refId: id, catatan: `Penerimaan ${po.nomor}`, oleh: req.pengguna,
        });
        await k.jalankan('UPDATE produk SET harga_beli = $1 WHERE id = $2', [r.harga, r.produk_id]);
      }
      await k.jalankan(`UPDATE pembelian SET status = 'diterima' WHERE id = $1`, [id]);
      return po.nomor as string;
    });

    await catatAudit({ user: req.pengguna, aksi: 'terima-barang', entitas: 'pembelian', entitasId: id, ringkasan: `${nomor} diterima` });
    res.json({ ok: true, pesan: 'Barang diterima, stok dan harga beli diperbarui.' });
  })
);

rutKulakan.patch(
  '/:id/batal',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const po = await db.satu<any>('SELECT nomor, status FROM pembelian WHERE id = $1', [id]);
    if (!po) throw new GalatPermintaan('Purchase order tidak ditemukan.', 404);
    if (po.status === 'diterima') throw new GalatPermintaan('Purchase order yang barangnya sudah diterima tidak dapat dibatalkan.', 409);
    await db.jalankan(`UPDATE pembelian SET status = 'batal' WHERE id = $1`, [id]);
    await catatAudit({ user: req.pengguna, aksi: 'batal', entitas: 'pembelian', entitasId: id, ringkasan: po.nomor });
    res.json({ ok: true });
  })
);
