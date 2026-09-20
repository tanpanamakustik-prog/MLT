import { Router } from 'express';
import { db, transaksi } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { ubahStok } from '../stok.js';
import { hariIni, nomorBerikutnya } from '../util.js';
import { angka, bungkus, GalatPermintaan } from '../http.js';

export const rutPenjualan = Router();
rutPenjualan.use(wajibMasuk);

/* ------------------------------------------------------------ Daftar & rinci */

rutPenjualan.get(
  '/',
  bungkus(async (req, res) => {
    const { dari, sampai, status_kirim, status_bayar, customer_id } = req.query as Record<string, string>;
    const pengguna = req.pengguna!;

    /* Buyer hanya melihat pesanannya sendiri. Penyaringan dilakukan di kueri,
       bukan di tampilan, karena endpoint ini juga dipanggil dari APK. */
    const batasCustomer = pengguna.peran === 'buyer' ? pengguna.customer_id : customer_id ? Number(customer_id) : null;
    const batas = Math.min(300, Math.max(1, Math.round(angka(req.query.batas, 100))));
    const lewati = Math.max(0, Math.round(angka(req.query.lewati, 0)));

    /* Jumlah item dihitung lewat gabungan agregat, bukan subkueri per baris:
       yang kedua menjalankan satu kueri untuk setiap pesanan yang ditampilkan. */
    const baris = await db.banyak(
      `SELECT o.id, o.nomor, o.tanggal, o.total, o.status_bayar, o.status_kirim, o.customer_id,
              c.nama AS customer, k.nama AS sales,
              COALESCE(i.jumlah_item, 0) AS jumlah_item
       FROM pesanan o
       JOIN customer c ON c.id = o.customer_id
       LEFT JOIN karyawan k ON k.id = o.sales_id
       LEFT JOIN (SELECT pesanan_id, COUNT(*)::int AS jumlah_item FROM pesanan_item GROUP BY pesanan_id) i
              ON i.pesanan_id = o.id
       WHERE ($1::date IS NULL OR o.tanggal >= $1::date)
         AND ($2::date IS NULL OR o.tanggal <= $2::date)
         AND ($3::text IS NULL OR o.status_kirim = $3)
         AND ($4::text IS NULL OR o.status_bayar = $4)
         AND ($5::int  IS NULL OR o.customer_id = $5::int)
       ORDER BY o.tanggal DESC, o.id DESC
       LIMIT $6 OFFSET $7`,
      [dari ?? null, sampai ?? null, status_kirim ?? null, status_bayar ?? null, batasCustomer, batas, lewati]
    );
    res.json(baris);
  })
);

rutPenjualan.get(
  '/:id',
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const pesanan = await db.satu<any>(
      `SELECT o.*, c.nama AS customer, c.alamat, c.no_hp, k.nama AS sales
       FROM pesanan o JOIN customer c ON c.id = o.customer_id
       LEFT JOIN karyawan k ON k.id = o.sales_id WHERE o.id = $1`,
      [id]
    );
    if (!pesanan) throw new GalatPermintaan('Pesanan tidak ditemukan.', 404);
    if (req.pengguna!.peran === 'buyer' && pesanan.customer_id !== req.pengguna!.customer_id) {
      throw new GalatPermintaan('Pesanan ini bukan milik akun Anda.', 403);
    }

    pesanan.item = await db.banyak(
      `SELECT i.id, i.qty, i.harga, i.harga_beli, i.subtotal, p.nama, p.sku, p.satuan
       FROM pesanan_item i JOIN produk p ON p.id = i.produk_id WHERE i.pesanan_id = $1 ORDER BY i.id`,
      [id]
    );
    pesanan.pengiriman = await db.banyak(
      `SELECT g.id, g.nomor, g.status, g.driver_id, k.nama AS driver
       FROM pengiriman g LEFT JOIN karyawan k ON k.id = g.driver_id
       WHERE g.pesanan_id = $1 ORDER BY g.id DESC`,
      [id]
    );
    res.json(pesanan);
  })
);

/* -------------------------------------------------------------- Buat pesanan */

rutPenjualan.post(
  '/',
  wajibPeran('owner', 'admin', 'sales', 'buyer'),
  bungkus(async (req, res) => {
    const pengguna = req.pengguna!;
    const b = req.body ?? {};

    const customerId = pengguna.peran === 'buyer' ? pengguna.customer_id : Number(b.customer_id);
    if (!customerId) throw new GalatPermintaan('Customer wajib dipilih.');

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

    const hasil = await transaksi(async (k) => {
      const customer = await k.satu<any>('SELECT * FROM customer WHERE id = $1', [customerId]);
      if (!customer) throw new GalatPermintaan('Customer tidak ditemukan.', 404);
      if (customer.status === 'blokir') throw new GalatPermintaan(`Customer ${customer.nama} sedang diblokir.`, 409);
      if (customer.status === 'menunggu') {
        throw new GalatPermintaan(
          `${customer.nama} belum diverifikasi. Admin perlu mengaktifkannya lebih dulu sebelum pesanan bisa dibuat.`,
          409
        );
      }
      if (customer.status === 'nonaktif') {
        throw new GalatPermintaan(`Customer ${customer.nama} berstatus nonaktif.`, 409);
      }
      const salesId = b.sales_id ? Number(b.sales_id) : customer.sales_id ?? pengguna.karyawan_id ?? null;

      const baris: Array<{ produk_id: number; qty: number; harga: number; harga_beli: number; subtotal: number }> = [];
      let subtotal = 0;
      let hppTotal = 0;

      for (const [produkId, qty] of gabungan) {
        const p = await k.satu<any>('SELECT id, nama, harga_jual, harga_beli, aktif FROM produk WHERE id = $1', [produkId]);
        if (!p) throw new GalatPermintaan(`Produk #${produkId} tidak ditemukan.`, 404);
        if (!p.aktif) throw new GalatPermintaan(`Produk ${p.nama} sudah tidak aktif.`);

        /* Harga khusus hanya boleh diisi staf internal. Kalau permintaan datang
           dari APK buyer, harga selalu diambil dari master produk. */
        const dariBuyer = pengguna.peran === 'buyer';
        const hargaKirim = itemMasuk.find((i) => Number(i.produk_id) === produkId)?.harga;
        const harga = !dariBuyer && hargaKirim != null ? Math.round(angka(hargaKirim)) : Number(p.harga_jual);

        const sub = harga * qty;
        subtotal += sub;
        hppTotal += Number(p.harga_beli) * qty;
        baris.push({ produk_id: produkId, qty, harga, harga_beli: Number(p.harga_beli), subtotal: sub });
      }

      const total = subtotal - diskon + ongkir;
      if (total < 0) throw new GalatPermintaan('Diskon melebihi nilai pesanan.');

      /* Limit kredit dihitung dari tagihan yang benar-benar belum lunas, bukan
         dari seluruh riwayat belanja. Owner dan admin dapat melampauinya secara
         sadar; pelampauan itu tercatat di audit log. */
      if (Number(customer.limit_kredit) > 0 && b.status_bayar !== 'lunas') {
        const piutang = Number(
          (await k.satu<{ n: string }>(
            `SELECT COALESCE(SUM(total),0)::bigint AS n FROM pesanan
             WHERE customer_id = $1 AND status_bayar <> 'lunas' AND status_kirim <> 'batal'`,
            [customerId]
          ))!.n
        );
        if (piutang + total > Number(customer.limit_kredit)) {
          const bolehLewat = ['owner', 'admin'].includes(pengguna.peran) && b.abaikan_limit === true;
          if (!bolehLewat) {
            throw new GalatPermintaan(
              `Melebihi limit kredit ${customer.nama}. Piutang berjalan Rp${piutang.toLocaleString('id-ID')} + pesanan ini Rp${total.toLocaleString('id-ID')} melampaui limit Rp${Number(customer.limit_kredit).toLocaleString('id-ID')}.`,
              409
            );
          }
        }
      }

      const nomor = await nomorBerikutnya(k, 'pesanan', 'SO');
      const dibuat = await k.satu<{ id: number }>(
        `INSERT INTO pesanan (nomor, customer_id, sales_id, tanggal, subtotal, diskon, ongkir, total,
                              hpp_total, status_bayar, status_kirim, catatan, dibuat_oleh)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'baru', $11, $12) RETURNING id`,
        [nomor, customerId, salesId, tanggal, subtotal, diskon, ongkir, total, hppTotal,
         b.status_bayar === 'lunas' ? 'lunas' : 'belum', b.catatan ?? null, pengguna.id]
      );
      const pesananId = dibuat!.id;

      for (const r of baris) {
        await k.jalankan(
          `INSERT INTO pesanan_item (pesanan_id, produk_id, qty, harga, harga_beli, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [pesananId, r.produk_id, r.qty, r.harga, r.harga_beli, r.subtotal]
        );
        /* Stok dipotong saat pesanan dibuat, bukan saat dikirim: barang yang
           sudah dijanjikan ke satu toko tidak boleh terlihat tersedia untuk
           toko berikutnya. Pembatalan mengembalikannya. */
        await ubahStok(k, {
          produkId: r.produk_id, delta: -r.qty, tipe: 'keluar',
          refTipe: 'pesanan', refId: pesananId, catatan: `Penjualan ${nomor}`, oleh: pengguna,
        });
      }

      return { id: pesananId, nomor, total, customer: customer.nama as string };
    });

    await catatAudit({
      user: pengguna, aksi: 'tambah', entitas: 'pesanan', entitasId: hasil.id,
      ringkasan: `${hasil.nomor} — ${hasil.customer} — Rp${hasil.total.toLocaleString('id-ID')}`,
    });
    res.status(201).json({ id: hasil.id, nomor: hasil.nomor, total: hasil.total });
  })
);

/* ---------------------------------------------------------- Ubah status */

rutPenjualan.patch(
  '/:id/status',
  wajibPeran('owner', 'admin', 'sales', 'gudang'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const statusKirim = b.status_kirim as string | undefined;
    const statusBayar = b.status_bayar as string | undefined;

    const hasil = await transaksi(async (k) => {
      const pesanan = await k.satu<any>('SELECT * FROM pesanan WHERE id = $1 FOR UPDATE', [id]);
      if (!pesanan) throw new GalatPermintaan('Pesanan tidak ditemukan.', 404);

      if (statusKirim === 'batal' && pesanan.status_kirim !== 'batal') {
        const item = await k.banyak<{ produk_id: number; qty: number }>(
          'SELECT produk_id, qty FROM pesanan_item WHERE pesanan_id = $1',
          [id]
        );
        for (const it of item) {
          await ubahStok(k, {
            produkId: it.produk_id, delta: it.qty, tipe: 'masuk',
            refTipe: 'pembatalan-pesanan', refId: id, catatan: `Pembatalan ${pesanan.nomor}`, oleh: req.pengguna,
          });
        }
        await k.jalankan(`UPDATE pesanan SET status_kirim = 'batal' WHERE id = $1`, [id]);
        return { batal: true, nomor: pesanan.nomor as string, lama: pesanan };
      }

      if (pesanan.status_kirim === 'batal') {
        throw new GalatPermintaan('Pesanan yang sudah dibatalkan tidak dapat diubah lagi.', 409);
      }

      await k.jalankan(
        'UPDATE pesanan SET status_kirim = COALESCE($1, status_kirim), status_bayar = COALESCE($2, status_bayar) WHERE id = $3',
        [statusKirim ?? null, statusBayar ?? null, id]
      );
      return { batal: false, nomor: pesanan.nomor as string, lama: pesanan };
    });

    if (hasil.batal) {
      await catatAudit({
        user: req.pengguna, aksi: 'batal', entitas: 'pesanan', entitasId: id,
        ringkasan: `${hasil.nomor} dibatalkan, stok dikembalikan`,
      });
      return res.json({ ok: true, pesan: 'Pesanan dibatalkan dan stok dikembalikan.' });
    }

    await catatAudit({
      user: req.pengguna, aksi: 'ubah-status', entitas: 'pesanan', entitasId: id, ringkasan: hasil.nomor,
      nilaiLama: { status_kirim: hasil.lama.status_kirim, status_bayar: hasil.lama.status_bayar },
      nilaiBaru: { status_kirim: statusKirim ?? hasil.lama.status_kirim, status_bayar: statusBayar ?? hasil.lama.status_bayar },
    });
    res.json({ ok: true });
  })
);
