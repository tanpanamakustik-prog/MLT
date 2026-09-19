import { Router } from 'express';
import { db, transaksi } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { statusStok, ubahStok } from '../stok.js';
import { angka, bungkus, GalatPermintaan } from '../http.js';

export const rutInventory = Router();
rutInventory.use(wajibMasuk);

/** Daftar stok dengan status dan nilai persediaan per produk. */
rutInventory.get(
  '/stok',
  bungkus(async (req, res) => {
    const status = String(req.query.status ?? '');
    const baris = await db.banyak<any>(
      `SELECT p.id, p.sku, p.nama, p.satuan, p.stok, p.stok_minimum, p.harga_beli, p.harga_jual,
              k.nama AS kategori, s.nama AS supplier,
              (p.stok::bigint * p.harga_beli) AS nilai_stok
       FROM produk p
       LEFT JOIN kategori k ON k.id = p.kategori_id
       LEFT JOIN supplier s ON s.id = p.supplier_id
       WHERE p.aktif = true ORDER BY p.nama`
    );

    const hasil = baris.map((p) => ({ ...p, status_stok: statusStok(p.stok, p.stok_minimum) }));
    res.json(status ? hasil.filter((h) => h.status_stok === status) : hasil);
  })
);

/**
 * Kartu stok satu produk: saldo awal pada rentang, mutasinya, dan saldo akhir.
 *
 * Diurutkan menurut id, yaitu urutan pencatatan — bukan menurut waktu kejadian.
 * Kolom stok_sebelum dan stok_sesudah adalah saldo berjalan, dan saldo berjalan
 * hanya punya arti dalam urutan ia ditulis. Sebuah penerimaan yang diinput
 * keesokan harinya dengan tanggal mundur akan, bila diurutkan menurut waktu,
 * menyelip di tengah rangkaian saldo yang dihitung tanpa dirinya — dan kartu
 * stoknya berhenti menjumlah. Buku besar akuntansi memakai aturan yang sama:
 * urutannya urutan jurnal, tanggal nilai hanyalah keterangan.
 *
 * Saldo awal dibaca dari stok_sebelum mutasi pertama dalam rentang, bukan
 * dihitung mundur dari stok sekarang, supaya tetap benar untuk produk yang
 * baru dibuat di tengah rentang.
 */
rutInventory.get(
  '/mutasi/:produkId',
  bungkus(async (req, res) => {
    const produkId = Number(req.params.produkId);
    const dari = String(req.query.dari ?? '1900-01-01');
    const sampai = String(req.query.sampai ?? '2999-12-31');
    const batas = Math.min(1000, Math.max(1, Math.round(angka(req.query.batas, 300))));

    const produk = await db.satu<any>('SELECT id, sku, nama, satuan, stok FROM produk WHERE id = $1', [produkId]);
    if (!produk) throw new GalatPermintaan('Produk tidak ditemukan.', 404);

    /* Ringkasan dihitung sebagai agregat atas seluruh rentang, sementara daftar
       mutasinya dibatasi. Menghitung ringkasan dari daftar yang sudah dipotong
       akan memberi angka yang salah tanpa terlihat salah — dan batas itu harus
       mengambil mutasi terbaru, bukan terlama, karena yang ingin dilihat orang
       gudang adalah pergerakan terakhir. */
    const [ringkas, awal, akhir, mutasi] = await Promise.all([
      db.satu<any>(
        `SELECT
           COALESCE(SUM(qty) FILTER (WHERE tipe = 'masuk'), 0)::int       AS masuk,
           COALESCE(SUM(-qty) FILTER (WHERE tipe = 'keluar'), 0)::int     AS keluar,
           COALESCE(SUM(qty) FILTER (WHERE tipe = 'adjustment'), 0)::int  AS adjustment,
           COUNT(*)::int                                                  AS jumlah
         FROM mutasi_stok WHERE produk_id = $1 AND waktu::date BETWEEN $2::date AND $3::date`,
        [produkId, dari, sampai]
      ),
      db.satu<{ stok_sebelum: number }>(
        `SELECT stok_sebelum FROM mutasi_stok WHERE produk_id = $1 AND waktu::date BETWEEN $2::date AND $3::date
         ORDER BY id LIMIT 1`,
        [produkId, dari, sampai]
      ),
      db.satu<{ stok_sesudah: number }>(
        `SELECT stok_sesudah FROM mutasi_stok WHERE produk_id = $1 AND waktu::date BETWEEN $2::date AND $3::date
         ORDER BY id DESC LIMIT 1`,
        [produkId, dari, sampai]
      ),
      db.banyak<any>(
        `SELECT m.id, m.tipe, m.qty, m.stok_sebelum, m.stok_sesudah, m.catatan, m.waktu,
                u.nama AS nama_pengguna
         FROM mutasi_stok m LEFT JOIN pengguna u ON u.id = m.oleh
         WHERE m.produk_id = $1 AND m.waktu::date BETWEEN $2::date AND $3::date
         ORDER BY m.id DESC
         LIMIT $4`,
        [produkId, dari, sampai, batas]
      ),
    ]);

    /* Saldo awal rentang: bila tidak ada mutasi di dalamnya, dipakai saldo
       terakhir sebelum rentang — bukan nol, karena stoknya memang ada. */
    const stokAwal =
      awal?.stok_sebelum ??
      (
        await db.satu<{ stok_sesudah: number }>(
          `SELECT stok_sesudah FROM mutasi_stok WHERE produk_id = $1 AND waktu::date < $2::date
           ORDER BY id DESC LIMIT 1`,
          [produkId, dari]
        )
      )?.stok_sesudah ?? 0;

    res.json({
      produk,
      stok_awal: stokAwal,
      stok_akhir: akhir?.stok_sesudah ?? stokAwal,
      masuk: ringkas.masuk,
      keluar: ringkas.keluar,
      adjustment: ringkas.adjustment,
      jumlah_mutasi: ringkas.jumlah,
      /* Daftar dikirim urut terbaru lebih dulu, sama seperti urutan tampilnya. */
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
  bungkus(async (req, res) => {
    const item: Array<{ produk_id: number; qty_fisik: number }> = Array.isArray(req.body?.item) ? req.body.item : [];
    if (item.length === 0) throw new GalatPermintaan('Tidak ada produk yang dihitung.');
    const alasan = String(req.body?.alasan ?? '').trim();
    if (!alasan) throw new GalatPermintaan('Alasan opname wajib diisi agar selisih stok bisa ditelusuri.');

    const perubahan = await transaksi(async (k) => {
      const hasil: any[] = [];
      for (const it of item) {
        const produkId = Number(it.produk_id);
        const fisik = Math.round(angka(it.qty_fisik, -1));
        if (fisik < 0) throw new GalatPermintaan('Qty hasil hitung fisik tidak boleh kosong atau negatif.');

        const p = await k.satu<any>('SELECT id, nama, stok FROM produk WHERE id = $1 FOR UPDATE', [produkId]);
        if (!p) throw new GalatPermintaan(`Produk #${produkId} tidak ditemukan.`, 404);

        const selisih = fisik - p.stok;
        if (selisih === 0) continue;

        await ubahStok(k, {
          produkId, delta: selisih, tipe: 'adjustment', refTipe: 'opname',
          catatan: `Opname: sistem ${p.stok} → fisik ${fisik}. ${alasan}`,
          oleh: req.pengguna, izinkanMinus: true,
        });
        hasil.push({ produk: p.nama, stok_sistem: p.stok, stok_fisik: fisik, selisih });
      }
      return hasil;
    });

    await catatAudit({
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
  bungkus(async (req, res) => {
    const produkId = Number(req.body?.produk_id);
    const delta = Math.round(angka(req.body?.delta));
    const alasan = String(req.body?.alasan ?? '').trim();
    if (!produkId || delta === 0) throw new GalatPermintaan('Produk dan jumlah penyesuaian wajib diisi.');
    if (!alasan) throw new GalatPermintaan('Alasan penyesuaian wajib diisi.');

    const hasil = await transaksi((k) =>
      ubahStok(k, {
        produkId, delta, tipe: 'adjustment', refTipe: 'adjustment',
        catatan: alasan, oleh: req.pengguna, izinkanMinus: false,
      })
    );

    await catatAudit({
      user: req.pengguna, aksi: 'adjustment', entitas: 'produk', entitasId: produkId,
      ringkasan: `${delta > 0 ? '+' : ''}${delta} — ${alasan}`,
      nilaiLama: { stok: hasil.stokSebelum }, nilaiBaru: { stok: hasil.stokSesudah },
    });
    res.json({ ok: true, ...hasil });
  })
);
