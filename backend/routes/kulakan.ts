import { Router } from 'express';
import { db } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { ubahStok } from '../stok.js';
import { hitungSaranKulakan } from '../kulakan-cerdas.js';
import { hariIni, nomorBerikutnya } from '../util.js';
import { angka, bungkus, GalatPermintaan } from '../http.js';

export const rutKulakan = Router();
rutKulakan.use(wajibMasuk);

/** Saran pembelian (Smart Kulakan). */
rutKulakan.get('/saran', (req, res) => {
  res.json(hitungSaranKulakan({ hanyaPerlu: req.query.hanya_perlu === '1' }));
});

rutKulakan.get('/', (req, res) => {
  const { dari, sampai, status } = req.query as Record<string, string>;
  res.json(
    db
      .prepare(
        `SELECT b.*, s.nama AS supplier,
                (SELECT COUNT(*) FROM pembelian_item i WHERE i.pembelian_id = b.id) AS jumlah_item
         FROM pembelian b JOIN supplier s ON s.id = b.supplier_id
         WHERE (? IS NULL OR b.tanggal >= ?) AND (? IS NULL OR b.tanggal <= ?) AND (? IS NULL OR b.status = ?)
         ORDER BY b.tanggal DESC, b.id DESC LIMIT 300`
      )
      .all(dari ?? null, dari ?? null, sampai ?? null, sampai ?? null, status ?? null, status ?? null)
  );
});

rutKulakan.get(
  '/:id',
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const po = db
      .prepare('SELECT b.*, s.nama AS supplier, s.alamat, s.kontak FROM pembelian b JOIN supplier s ON s.id = b.supplier_id WHERE b.id = ?')
      .get(id) as any;
    if (!po) throw new GalatPermintaan('Purchase order tidak ditemukan.', 404);
    po.item = db
      .prepare('SELECT i.*, p.nama, p.sku, p.satuan FROM pembelian_item i JOIN produk p ON p.id = i.produk_id WHERE i.pembelian_id = ?')
      .all(id);
    res.json(po);
  })
);

rutKulakan.post(
  '/',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus((req, res) => {
    const b = req.body ?? {};
    const supplierId = Number(b.supplier_id);
    if (!supplierId) throw new GalatPermintaan('Supplier wajib dipilih.');
    const item: Array<{ produk_id: number; qty: number; harga?: number }> = Array.isArray(b.item) ? b.item : [];
    if (item.length === 0) throw new GalatPermintaan('Purchase order harus berisi minimal satu produk.');

    const buat = db.transaction(() => {
      const nomor = nomorBerikutnya('pembelian', 'PO');
      const hasil = db
        .prepare(`INSERT INTO pembelian (nomor, supplier_id, tanggal, total, status, catatan, dibuat_oleh) VALUES (?, ?, ?, 0, 'dipesan', ?, ?)`)
        .run(nomor, supplierId, String(b.tanggal || hariIni()), b.catatan ?? null, req.pengguna!.id);
      const poId = Number(hasil.lastInsertRowid);

      const simpan = db.prepare(
        'INSERT INTO pembelian_item (pembelian_id, produk_id, qty, harga, subtotal) VALUES (?, ?, ?, ?, ?)'
      );
      let total = 0;
      for (const it of item) {
        const produkId = Number(it.produk_id);
        const qty = Math.round(angka(it.qty));
        if (!produkId || qty <= 0) throw new GalatPermintaan('Setiap baris pembelian butuh produk dan qty lebih dari nol.');
        const p = db.prepare('SELECT harga_beli, nama FROM produk WHERE id = ?').get(produkId) as any;
        if (!p) throw new GalatPermintaan(`Produk #${produkId} tidak ditemukan.`, 404);
        const harga = it.harga != null ? Math.round(angka(it.harga)) : p.harga_beli;
        const sub = harga * qty;
        total += sub;
        simpan.run(poId, produkId, qty, harga, sub);
      }
      db.prepare('UPDATE pembelian SET total = ? WHERE id = ?').run(total, poId);
      return { id: poId, nomor, total };
    });

    const hasil = buat();
    catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'pembelian', entitasId: hasil.id, ringkasan: `${hasil.nomor} — Rp${hasil.total.toLocaleString('id-ID')}` });
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
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const po = db.prepare('SELECT * FROM pembelian WHERE id = ?').get(id) as any;
    if (!po) throw new GalatPermintaan('Purchase order tidak ditemukan.', 404);
    if (po.status === 'diterima') throw new GalatPermintaan('Purchase order ini sudah diterima.', 409);
    if (po.status === 'batal') throw new GalatPermintaan('Purchase order ini sudah dibatalkan.', 409);

    const diterima: Array<{ produk_id: number; qty_diterima: number }> = Array.isArray(req.body?.item) ? req.body.item : [];

    const proses = db.transaction(() => {
      const baris = db.prepare('SELECT * FROM pembelian_item WHERE pembelian_id = ?').all(id) as any[];
      for (const r of baris) {
        const kiriman = diterima.find((d) => Number(d.produk_id) === r.produk_id);
        const qty = kiriman ? Math.round(angka(kiriman.qty_diterima)) : r.qty;
        if (qty < 0) throw new GalatPermintaan('Qty diterima tidak boleh negatif.');
        if (qty === 0) continue;

        db.prepare('UPDATE pembelian_item SET qty_diterima = ? WHERE id = ?').run(qty, r.id);
        ubahStok({
          produkId: r.produk_id, delta: qty, tipe: 'masuk',
          refTipe: 'pembelian', refId: id, catatan: `Penerimaan ${po.nomor}`, oleh: req.pengguna,
        });
        db.prepare('UPDATE produk SET harga_beli = ? WHERE id = ?').run(r.harga, r.produk_id);
      }
      db.prepare(`UPDATE pembelian SET status = 'diterima' WHERE id = ?`).run(id);
    });

    proses();
    catatAudit({ user: req.pengguna, aksi: 'terima-barang', entitas: 'pembelian', entitasId: id, ringkasan: `${po.nomor} diterima` });
    res.json({ ok: true, pesan: 'Barang diterima, stok dan harga beli diperbarui.' });
  })
);

rutKulakan.patch(
  '/:id/batal',
  wajibPeran('owner', 'admin'),
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const po = db.prepare('SELECT * FROM pembelian WHERE id = ?').get(id) as any;
    if (!po) throw new GalatPermintaan('Purchase order tidak ditemukan.', 404);
    if (po.status === 'diterima') throw new GalatPermintaan('Purchase order yang barangnya sudah diterima tidak dapat dibatalkan.', 409);
    db.prepare(`UPDATE pembelian SET status = 'batal' WHERE id = ?`).run(id);
    catatAudit({ user: req.pengguna, aksi: 'batal', entitas: 'pembelian', entitasId: id, ringkasan: po.nomor });
    res.json({ ok: true });
  })
);
