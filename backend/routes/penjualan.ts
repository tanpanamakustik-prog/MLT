import { Router } from 'express';
import { db } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { ubahStok } from '../stok.js';
import { hariIni, nomorBerikutnya } from '../util.js';
import { angka, bungkus, GalatPermintaan } from '../http.js';

export const rutPenjualan = Router();
rutPenjualan.use(wajibMasuk);

/* ------------------------------------------------------------ Daftar & rinci */

rutPenjualan.get('/', (req, res) => {
  const { dari, sampai, status_kirim, status_bayar, customer_id } = req.query as Record<string, string>;
  const pengguna = req.pengguna!;

  /* Buyer hanya melihat pesanannya sendiri. Penyaringan dilakukan di kueri,
     bukan di tampilan, karena endpoint ini juga dipanggil dari APK. */
  const batasCustomer = pengguna.peran === 'buyer' ? pengguna.customer_id : customer_id ? Number(customer_id) : null;

  res.json(
    db
      .prepare(
        `SELECT o.*, c.nama AS customer, k.nama AS sales,
                (SELECT COUNT(*) FROM pesanan_item i WHERE i.pesanan_id = o.id) AS jumlah_item,
                (SELECT g.status FROM pengiriman g WHERE g.pesanan_id = o.id ORDER BY g.id DESC LIMIT 1) AS status_pengiriman
         FROM pesanan o
         JOIN customer c ON c.id = o.customer_id
         LEFT JOIN karyawan k ON k.id = o.sales_id
         WHERE (? IS NULL OR o.tanggal >= ?)
           AND (? IS NULL OR o.tanggal <= ?)
           AND (? IS NULL OR o.status_kirim = ?)
           AND (? IS NULL OR o.status_bayar = ?)
           AND (? IS NULL OR o.customer_id = ?)
         ORDER BY o.tanggal DESC, o.id DESC
         LIMIT 300`
      )
      .all(
        dari ?? null, dari ?? null,
        sampai ?? null, sampai ?? null,
        status_kirim ?? null, status_kirim ?? null,
        status_bayar ?? null, status_bayar ?? null,
        batasCustomer, batasCustomer
      )
  );
});

rutPenjualan.get(
  '/:id',
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const pesanan = db
      .prepare(
        `SELECT o.*, c.nama AS customer, c.alamat, c.no_hp, k.nama AS sales
         FROM pesanan o JOIN customer c ON c.id = o.customer_id
         LEFT JOIN karyawan k ON k.id = o.sales_id WHERE o.id = ?`
      )
      .get(id) as any;
    if (!pesanan) throw new GalatPermintaan('Pesanan tidak ditemukan.', 404);
    if (req.pengguna!.peran === 'buyer' && pesanan.customer_id !== req.pengguna!.customer_id) {
      throw new GalatPermintaan('Pesanan ini bukan milik akun Anda.', 403);
    }

    pesanan.item = db
      .prepare(
        `SELECT i.*, p.nama, p.sku, p.satuan FROM pesanan_item i JOIN produk p ON p.id = i.produk_id WHERE i.pesanan_id = ?`
      )
      .all(id);
    pesanan.pengiriman = db
      .prepare('SELECT g.*, k.nama AS driver FROM pengiriman g LEFT JOIN karyawan k ON k.id = g.driver_id WHERE g.pesanan_id = ? ORDER BY g.id DESC')
      .all(id);
    res.json(pesanan);
  })
);

/* -------------------------------------------------------------- Buat pesanan */

rutPenjualan.post(
  '/',
  wajibPeran('owner', 'admin', 'sales', 'buyer'),
  bungkus((req, res) => {
    const pengguna = req.pengguna!;
    const b = req.body ?? {};

    const customerId = pengguna.peran === 'buyer' ? pengguna.customer_id : Number(b.customer_id);
    if (!customerId) throw new GalatPermintaan('Customer wajib dipilih.');

    const customer = db.prepare('SELECT * FROM customer WHERE id = ?').get(customerId) as any;
    if (!customer) throw new GalatPermintaan('Customer tidak ditemukan.', 404);
    if (customer.status === 'blokir') throw new GalatPermintaan(`Customer ${customer.nama} sedang diblokir.`, 409);

    const itemMasuk: Array<{ produk_id: number; qty: number; harga?: number }> = Array.isArray(b.item) ? b.item : [];
    if (itemMasuk.length === 0) throw new GalatPermintaan('Pesanan harus berisi minimal satu produk.');

    /* Baris dengan produk yang sama digabung dulu. Tanpa ini, dua baris beras
       masing-masing 60 sak lolos pemeriksaan stok satu per satu saat stok
       tinggal 100, lalu potongan keduanya membuat stok minus. */
    const gabungan = new Map<number, number>();
    for (const it of itemMasuk) {
      const pid = Number(it.produk_id);
      const qty = Math.round(angka(it.qty));
      if (!pid || qty <= 0) throw new GalatPermintaan('Setiap baris pesanan butuh produk dan qty lebih dari nol.');
      gabungan.set(pid, (gabungan.get(pid) ?? 0) + qty);
    }

    const diskon = Math.round(angka(b.diskon));
    const ongkir = Math.round(angka(b.ongkir));
    const tanggal = String(b.tanggal || hariIni());
    const salesId = b.sales_id ? Number(b.sales_id) : customer.sales_id ?? pengguna.karyawan_id ?? null;

    const buat = db.transaction(() => {
      const baris: Array<{ produk_id: number; qty: number; harga: number; harga_beli: number; subtotal: number }> = [];
      let subtotal = 0;
      let hppTotal = 0;

      for (const [produkId, qty] of gabungan) {
        const p = db.prepare('SELECT id, nama, harga_jual, harga_beli, aktif FROM produk WHERE id = ?').get(produkId) as any;
        if (!p) throw new GalatPermintaan(`Produk #${produkId} tidak ditemukan.`, 404);
        if (!p.aktif) throw new GalatPermintaan(`Produk ${p.nama} sudah tidak aktif.`);

        /* Harga khusus hanya boleh diisi staf internal. Kalau permintaan datang
           dari APK buyer, harga selalu diambil dari master produk. */
        const dariBuyer = pengguna.peran === 'buyer';
        const hargaKirim = itemMasuk.find((i) => Number(i.produk_id) === produkId)?.harga;
        const harga = !dariBuyer && hargaKirim != null ? Math.round(angka(hargaKirim)) : p.harga_jual;

        const sub = harga * qty;
        subtotal += sub;
        hppTotal += p.harga_beli * qty;
        baris.push({ produk_id: produkId, qty, harga, harga_beli: p.harga_beli, subtotal: sub });
      }

      const total = subtotal - diskon + ongkir;
      if (total < 0) throw new GalatPermintaan('Diskon melebihi nilai pesanan.');

      /* Limit kredit dihitung dari tagihan yang benar-benar belum lunas, bukan
         dari seluruh riwayat belanja. Owner dan admin dapat melampauinya secara
         sadar; pelampauan itu tercatat di audit log. */
      if (customer.limit_kredit > 0 && b.status_bayar !== 'lunas') {
        const piutang = (db
          .prepare(`SELECT COALESCE(SUM(total),0) AS n FROM pesanan WHERE customer_id = ? AND status_bayar <> 'lunas' AND status_kirim <> 'batal'`)
          .get(customerId) as any).n as number;
        if (piutang + total > customer.limit_kredit) {
          const bolehLewat = ['owner', 'admin'].includes(pengguna.peran) && b.abaikan_limit === true;
          if (!bolehLewat) {
            throw new GalatPermintaan(
              `Melebihi limit kredit ${customer.nama}. Piutang berjalan Rp${piutang.toLocaleString('id-ID')} + pesanan ini Rp${total.toLocaleString('id-ID')} melampaui limit Rp${customer.limit_kredit.toLocaleString('id-ID')}.`,
              409
            );
          }
        }
      }

      const nomor = nomorBerikutnya('pesanan', 'SO');
      const hasil = db
        .prepare(
          `INSERT INTO pesanan (nomor, customer_id, sales_id, tanggal, subtotal, diskon, ongkir, total,
                                hpp_total, status_bayar, status_kirim, catatan, dibuat_oleh)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'baru', ?, ?)`
        )
        .run(nomor, customerId, salesId, tanggal, subtotal, diskon, ongkir, total, hppTotal,
             b.status_bayar === 'lunas' ? 'lunas' : 'belum', b.catatan ?? null, pengguna.id);

      const pesananId = Number(hasil.lastInsertRowid);
      const simpanItem = db.prepare(
        `INSERT INTO pesanan_item (pesanan_id, produk_id, qty, harga, harga_beli, subtotal) VALUES (?, ?, ?, ?, ?, ?)`
      );

      for (const r of baris) {
        simpanItem.run(pesananId, r.produk_id, r.qty, r.harga, r.harga_beli, r.subtotal);
        /* Stok dipotong saat pesanan dibuat, bukan saat dikirim: barang yang
           sudah dijanjikan ke satu toko tidak boleh terlihat tersedia untuk
           toko berikutnya. Pembatalan mengembalikannya. */
        ubahStok({
          produkId: r.produk_id, delta: -r.qty, tipe: 'keluar',
          refTipe: 'pesanan', refId: pesananId, catatan: `Penjualan ${nomor}`, oleh: pengguna,
        });
      }

      return { id: pesananId, nomor, total };
    });

    const hasil = buat();
    catatAudit({
      user: pengguna, aksi: 'tambah', entitas: 'pesanan', entitasId: hasil.id,
      ringkasan: `${hasil.nomor} — ${customer.nama} — Rp${hasil.total.toLocaleString('id-ID')}`,
    });
    res.status(201).json(hasil);
  })
);

/* ---------------------------------------------------------- Ubah status */

rutPenjualan.patch(
  '/:id/status',
  wajibPeran('owner', 'admin', 'sales', 'gudang'),
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const pesanan = db.prepare('SELECT * FROM pesanan WHERE id = ?').get(id) as any;
    if (!pesanan) throw new GalatPermintaan('Pesanan tidak ditemukan.', 404);

    const b = req.body ?? {};
    const statusKirim = b.status_kirim as string | undefined;
    const statusBayar = b.status_bayar as string | undefined;

    if (statusKirim === 'batal' && pesanan.status_kirim !== 'batal') {
      const batalkan = db.transaction(() => {
        const item = db.prepare('SELECT produk_id, qty FROM pesanan_item WHERE pesanan_id = ?').all(id) as any[];
        for (const it of item) {
          ubahStok({
            produkId: it.produk_id, delta: it.qty, tipe: 'masuk',
            refTipe: 'pembatalan-pesanan', refId: id, catatan: `Pembatalan ${pesanan.nomor}`, oleh: req.pengguna,
          });
        }
        db.prepare(`UPDATE pesanan SET status_kirim = 'batal' WHERE id = ?`).run(id);
      });
      batalkan();
      catatAudit({ user: req.pengguna, aksi: 'batal', entitas: 'pesanan', entitasId: id, ringkasan: `${pesanan.nomor} dibatalkan, stok dikembalikan`, nilaiLama: { status_kirim: pesanan.status_kirim } });
      return res.json({ ok: true, pesan: 'Pesanan dibatalkan dan stok dikembalikan.' });
    }

    if (pesanan.status_kirim === 'batal') {
      throw new GalatPermintaan('Pesanan yang sudah dibatalkan tidak dapat diubah lagi.', 409);
    }

    db.prepare('UPDATE pesanan SET status_kirim = COALESCE(?, status_kirim), status_bayar = COALESCE(?, status_bayar) WHERE id = ?')
      .run(statusKirim ?? null, statusBayar ?? null, id);
    catatAudit({
      user: req.pengguna, aksi: 'ubah-status', entitas: 'pesanan', entitasId: id, ringkasan: pesanan.nomor,
      nilaiLama: { status_kirim: pesanan.status_kirim, status_bayar: pesanan.status_bayar },
      nilaiBaru: { status_kirim: statusKirim ?? pesanan.status_kirim, status_bayar: statusBayar ?? pesanan.status_bayar },
    });
    res.json({ ok: true });
  })
);
