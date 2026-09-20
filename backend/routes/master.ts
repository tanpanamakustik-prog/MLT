import { Router } from 'express';
import { db, transaksi } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { statusStok } from '../stok.js';
import { angka, bungkus, GalatPermintaan, wajibTeks } from '../http.js';

export const rutMaster = Router();
rutMaster.use(wajibMasuk);

/* Batas bawaan daftar. Tabel di layar tidak pernah menampilkan ratusan baris
   sekaligus, sedangkan tiap baris yang dikirim tetap terhitung sebagai egress
   Supabase. Pemanggil yang benar-benar butuh lebih menyebutkan batasnya sendiri. */
const BATAS = (v: unknown, bawaan = 100) => Math.min(500, Math.max(1, Math.round(angka(v, bawaan))));

/* ---------------------------------------------------------------- Kategori */

rutMaster.get(
  '/kategori',
  bungkus(async (_req, res) => {
    res.json(await db.banyak('SELECT id, nama FROM kategori ORDER BY nama'));
  })
);

rutMaster.post(
  '/kategori',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const nama = wajibTeks(req.body?.nama, 'Nama kategori');
    const baris = await db.satu<{ id: number }>('INSERT INTO kategori (nama) VALUES ($1) RETURNING id', [nama]);
    res.status(201).json({ id: baris!.id, nama });
  })
);

/* ---------------------------------------------------------------- Supplier */

rutMaster.get(
  '/supplier',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus(async (_req, res) => {
    res.json(
      await db.banyak(
        `SELECT s.id, s.nama, s.alamat, s.kontak, s.no_hp, s.lead_time_hari, s.aktif,
                COUNT(p.id)::int AS jumlah_produk
         FROM supplier s
         LEFT JOIN produk p ON p.supplier_id = s.id
         GROUP BY s.id
         ORDER BY s.nama`
      )
    );
  })
);

rutMaster.post(
  '/supplier',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus(async (req, res) => {
    const b = req.body ?? {};
    const baris = await db.satu<{ id: number }>(
      `INSERT INTO supplier (nama, alamat, kontak, no_hp, lead_time_hari)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [wajibTeks(b.nama, 'Nama supplier'), b.alamat ?? null, b.kontak ?? null, b.no_hp ?? null, angka(b.lead_time_hari, 3)]
    );
    await catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'supplier', entitasId: baris!.id, ringkasan: b.nama });
    res.status(201).json({ id: baris!.id });
  })
);

rutMaster.put(
  '/supplier/:id',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const lama = await db.satu('SELECT * FROM supplier WHERE id = $1', [id]);
    if (!lama) throw new GalatPermintaan('Supplier tidak ditemukan.', 404);
    const b = req.body ?? {};
    await db.jalankan(
      `UPDATE supplier SET nama = $1, alamat = $2, kontak = $3, no_hp = $4, lead_time_hari = $5, aktif = $6 WHERE id = $7`,
      [
        wajibTeks(b.nama, 'Nama supplier'), b.alamat ?? null, b.kontak ?? null, b.no_hp ?? null,
        angka(b.lead_time_hari, 3), b.aktif !== false, id,
      ]
    );
    await catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'supplier', entitasId: id, ringkasan: b.nama, nilaiLama: lama, nilaiBaru: b });
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ Produk */

/* Kolom yang benar-benar dipakai daftar produk, katalog, dan form pesanan.
   foto_url dan dibuat_pada sengaja tidak ikut: keduanya tidak pernah
   ditampilkan di tabel dan hanya menambah beban tiap kali halaman dibuka. */
const KOLOM_PRODUK = `p.id, p.sku, p.nama, p.satuan, p.kategori_id, p.supplier_id,
  p.harga_beli, p.harga_jual, p.stok, p.stok_minimum, p.safety_stock, p.kelipatan_beli, p.aktif`;

/**
 * Menyiapkan satu baris produk untuk peran yang memintanya.
 *
 * Katalog memakai endpoint yang sama dengan halaman produk internal, dan buyer
 * memanggilnya dari APK. Harga beli, supplier, dan ambang stok adalah angka
 * dagang: dikirim ke pembeli, ia tahu persis berapa margin yang diambil dan
 * dari siapa barangnya datang. Dibuang di sini, bukan disembunyikan di layar.
 */
function rapikanProduk(p: any, peran: string) {
  const dasar = { ...p, status_stok: statusStok(p.stok, p.stok_minimum) };
  if (peran !== 'buyer') return dasar;

  const { harga_beli, supplier, supplier_id, safety_stock, stok_minimum, kelipatan_beli, ...umum } = dasar;
  return umum;
}

rutMaster.get(
  '/produk',
  bungkus(async (req, res) => {
    const cari = String(req.query.cari ?? '').trim();
    const kategoriId = req.query.kategori_id ? Number(req.query.kategori_id) : null;
    const semua = req.query.semua === '1';

    const baris = await db.banyak<any>(
      `SELECT ${KOLOM_PRODUK}, k.nama AS kategori, s.nama AS supplier
       FROM produk p
       LEFT JOIN kategori k ON k.id = p.kategori_id
       LEFT JOIN supplier s ON s.id = p.supplier_id
       WHERE ($1 OR p.aktif = true)
         AND ($2 = '' OR p.nama ILIKE '%' || $2 || '%' OR p.sku ILIKE '%' || $2 || '%')
         AND ($3::int IS NULL OR p.kategori_id = $3::int)
       ORDER BY p.nama
       LIMIT $4`,
      [semua, cari, kategoriId, BATAS(req.query.batas, 300)]
    );

    res.json(baris.map((p) => rapikanProduk(p, req.pengguna!.peran)));
  })
);

rutMaster.get(
  '/produk/:id',
  bungkus(async (req, res) => {
    const p = await db.satu<any>(
      `SELECT p.*, k.nama AS kategori, s.nama AS supplier
       FROM produk p LEFT JOIN kategori k ON k.id = p.kategori_id
       LEFT JOIN supplier s ON s.id = p.supplier_id WHERE p.id = $1`,
      [Number(req.params.id)]
    );
    if (!p) throw new GalatPermintaan('Produk tidak ditemukan.', 404);
    res.json(rapikanProduk(p, req.pengguna!.peran));
  })
);

function bacaProduk(b: any) {
  return [
    wajibTeks(b.sku, 'SKU').toUpperCase(),
    wajibTeks(b.nama, 'Nama produk'),
    b.kategori_id ? Number(b.kategori_id) : null,
    b.supplier_id ? Number(b.supplier_id) : null,
    String(b.satuan ?? 'pcs'),
    Math.round(angka(b.harga_beli)),
    Math.round(angka(b.harga_jual)),
    Math.round(angka(b.stok_minimum)),
    Math.round(angka(b.safety_stock)),
    Math.max(1, Math.round(angka(b.kelipatan_beli, 1))),
    b.foto_url ?? null,
  ];
}

rutMaster.post(
  '/produk',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const d = bacaProduk(req.body ?? {});
    /* Stok awal tidak diisi lewat form produk. Barang masuk ke gudang melalui
       penerimaan kulakan atau stock opname, dua jalur yang meninggalkan mutasi;
       memberi kolom stok awal di sini akan membuka jalan stok tanpa asal-usul. */
    const baris = await db.satu<{ id: number }>(
      `INSERT INTO produk (sku, nama, kategori_id, supplier_id, satuan, harga_beli, harga_jual,
                           stok, stok_minimum, safety_stock, kelipatan_beli, foto_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11) RETURNING id`,
      d
    );
    await catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'produk', entitasId: baris!.id, ringkasan: `${d[0]} — ${d[1]}` });
    res.status(201).json({ id: baris!.id });
  })
);

rutMaster.put(
  '/produk/:id',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const lama = await db.satu<any>('SELECT * FROM produk WHERE id = $1', [id]);
    if (!lama) throw new GalatPermintaan('Produk tidak ditemukan.', 404);
    const d = bacaProduk(req.body ?? {});
    await db.jalankan(
      `UPDATE produk SET sku=$1, nama=$2, kategori_id=$3, supplier_id=$4, satuan=$5,
              harga_beli=$6, harga_jual=$7, stok_minimum=$8, safety_stock=$9,
              kelipatan_beli=$10, foto_url=$11
       WHERE id=$12`,
      [...d, id]
    );

    /* Perubahan harga dicatat sebagai aksi tersendiri: inilah yang paling
       sering ditanyakan owner ketika margin sebuah produk tiba-tiba berubah. */
    const hargaBeli = d[5] as number;
    const hargaJual = d[6] as number;
    if (Number(lama.harga_jual) !== hargaJual || Number(lama.harga_beli) !== hargaBeli) {
      await catatAudit({
        user: req.pengguna, aksi: 'ubah-harga', entitas: 'produk', entitasId: id,
        ringkasan: `${d[1]}: jual ${lama.harga_jual} → ${hargaJual}, beli ${lama.harga_beli} → ${hargaBeli}`,
        nilaiLama: { harga_beli: lama.harga_beli, harga_jual: lama.harga_jual },
        nilaiBaru: { harga_beli: hargaBeli, harga_jual: hargaJual },
      });
    } else {
      await catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'produk', entitasId: id, ringkasan: String(d[1]) });
    }
    res.json({ ok: true });
  })
);

rutMaster.delete(
  '/produk/:id',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const p = await db.satu<{ nama: string }>('SELECT nama FROM produk WHERE id = $1', [id]);
    if (!p) throw new GalatPermintaan('Produk tidak ditemukan.', 404);
    /* Dinonaktifkan, tidak dihapus: baris pesanan lama menunjuk ke produk ini
       dan laporan tahun berjalan harus tetap bisa menyebut namanya. */
    await db.jalankan('UPDATE produk SET aktif = false WHERE id = $1', [id]);
    await catatAudit({ user: req.pengguna, aksi: 'nonaktifkan', entitas: 'produk', entitasId: id, ringkasan: p.nama });
    res.json({ ok: true, pesan: 'Produk dinonaktifkan. Riwayat transaksinya tetap tersimpan.' });
  })
);

/* ---------------------------------------------------------------- Customer */

/* Daftar customer memuat alamat, nomor telepon, dan nilai belanja seluruh
   toko. Peran buyer memakai API yang sama dari APK, jadi pembatasannya
   dipasang di rute, bukan disembunyikan di menu. */
rutMaster.get(
  '/customer',
  wajibPeran('owner', 'admin', 'sales', 'gudang'),
  bungkus(async (req, res) => {
    const cari = String(req.query.cari ?? '').trim();
    res.json(
      await db.banyak(
        `SELECT c.id, c.kode, c.nama, c.alamat, c.no_hp, c.tipe, c.sales_id, c.limit_kredit, c.status,
                k.nama AS sales,
                COALESCE(t.jumlah_order, 0) AS jumlah_order,
                COALESCE(t.total_belanja, 0) AS total_belanja,
                t.order_terakhir
         FROM customer c
         LEFT JOIN karyawan k ON k.id = c.sales_id
         LEFT JOIN (
           SELECT customer_id, COUNT(*)::int AS jumlah_order, SUM(total)::bigint AS total_belanja,
                  MAX(tanggal) AS order_terakhir
           FROM pesanan WHERE status_kirim <> 'batal' GROUP BY customer_id
         ) t ON t.customer_id = c.id
         WHERE ($1 = '' OR c.nama ILIKE '%' || $1 || '%' OR c.kode ILIKE '%' || $1 || '%')
         ORDER BY c.nama
         LIMIT $2`,
        [cari, BATAS(req.query.batas, 200)]
      )
    );
  })
);

rutMaster.get(
  '/customer/:id',
  wajibPeran('owner', 'admin', 'sales', 'gudang'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const c = await db.satu(
      'SELECT c.*, k.nama AS sales FROM customer c LEFT JOIN karyawan k ON k.id = c.sales_id WHERE c.id = $1',
      [id]
    );
    if (!c) throw new GalatPermintaan('Customer tidak ditemukan.', 404);

    const ringkas = await db.satu<any>(
      `SELECT COUNT(*)::int AS jumlah_order, COALESCE(SUM(total),0)::bigint AS total_belanja,
              COALESCE(ROUND(AVG(total)),0)::bigint AS rata_order, MAX(tanggal) AS order_terakhir
       FROM pesanan WHERE customer_id = $1 AND status_kirim <> 'batal'`,
      [id]
    );

    const riwayat = await db.banyak(
      `SELECT id, nomor, tanggal, total, status_bayar, status_kirim
       FROM pesanan WHERE customer_id = $1 ORDER BY tanggal DESC, id DESC LIMIT 20`,
      [id]
    );

    res.json({ ...(c as object), ringkas, riwayat });
  })
);

function bacaCustomer(b: any) {
  return [
    b.kode ? String(b.kode).toUpperCase() : null,
    wajibTeks(b.nama, 'Nama customer'),
    b.alamat ?? null,
    b.no_hp ?? null,
    ['toko', 'grosir', 'retail', 'horeka'].includes(b.tipe) ? b.tipe : 'toko',
    b.sales_id ? Number(b.sales_id) : null,
    Math.round(angka(b.limit_kredit)),
    ['menunggu', 'aktif', 'nonaktif', 'blokir'].includes(b.status) ? b.status : 'aktif',
    b.lat != null ? Number(b.lat) : null,
    b.lng != null ? Number(b.lng) : null,
  ];
}

rutMaster.post(
  '/customer',
  wajibPeran('owner', 'admin', 'sales'),
  bungkus(async (req, res) => {
    const d = bacaCustomer(req.body ?? {});
    const baris = await db.satu<{ id: number }>(
      `INSERT INTO customer (kode, nama, alamat, no_hp, tipe, sales_id, limit_kredit, status, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      d
    );
    await catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'customer', entitasId: baris!.id, ringkasan: String(d[1]) });
    res.status(201).json({ id: baris!.id });
  })
);

rutMaster.put(
  '/customer/:id',
  wajibPeran('owner', 'admin', 'sales'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const lama = await db.satu('SELECT * FROM customer WHERE id = $1', [id]);
    if (!lama) throw new GalatPermintaan('Customer tidak ditemukan.', 404);
    const d = bacaCustomer(req.body ?? {});
    await db.jalankan(
      `UPDATE customer SET kode=$1, nama=$2, alamat=$3, no_hp=$4, tipe=$5,
              sales_id=$6, limit_kredit=$7, status=$8, lat=$9, lng=$10 WHERE id=$11`,
      [...d, id]
    );
    await catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'customer', entitasId: id, ringkasan: String(d[1]), nilaiLama: lama, nilaiBaru: req.body });
    res.json({ ok: true });
  })
);

/* ---------------------------------------------------------------- Karyawan */

rutMaster.get(
  '/karyawan',
  wajibPeran('owner', 'admin', 'sales', 'gudang', 'driver'),
  bungkus(async (_req, res) => {
    res.json(
      await db.banyak(
        `SELECT id, nama, jabatan, no_hp, status, tanggal_bergabung, area_kerja
         FROM karyawan ORDER BY nama`
      )
    );
  })
);

rutMaster.post(
  '/karyawan',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const b = req.body ?? {};
    const baris = await db.satu<{ id: number }>(
      `INSERT INTO karyawan (nama, jabatan, no_hp, status, tanggal_bergabung, area_kerja, foto_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        wajibTeks(b.nama, 'Nama karyawan'), wajibTeks(b.jabatan, 'Jabatan'), b.no_hp ?? null,
        b.status ?? 'aktif', b.tanggal_bergabung || null, b.area_kerja ?? null, b.foto_url ?? null,
      ]
    );
    await catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'karyawan', entitasId: baris!.id, ringkasan: b.nama });
    res.status(201).json({ id: baris!.id });
  })
);

rutMaster.put(
  '/karyawan/:id',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const lama = await db.satu('SELECT * FROM karyawan WHERE id = $1', [id]);
    if (!lama) throw new GalatPermintaan('Karyawan tidak ditemukan.', 404);
    const b = req.body ?? {};
    await db.jalankan(
      `UPDATE karyawan SET nama=$1, jabatan=$2, no_hp=$3, status=$4, tanggal_bergabung=$5, area_kerja=$6, foto_url=$7 WHERE id=$8`,
      [
        wajibTeks(b.nama, 'Nama karyawan'), wajibTeks(b.jabatan, 'Jabatan'), b.no_hp ?? null,
        b.status ?? 'aktif', b.tanggal_bergabung || null, b.area_kerja ?? null, b.foto_url ?? null, id,
      ]
    );
    await catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'karyawan', entitasId: id, ringkasan: b.nama, nilaiLama: lama, nilaiBaru: b });
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------- Pengaturan */

/** Kunci yang boleh diubah lewat antarmuka, beserta nilai bawaannya. */
const PENGATURAN_DIIZINKAN: Record<string, string> = {
  nama_usaha: 'MLT — Mas Lukman Telur',
  absensi_lat: '-7.797068',
  absensi_lng: '110.370529',
  absensi_radius_m: '150',
  absensi_jam_masuk: '08:00:00',
  kulakan_hari_riwayat: '30',
  kulakan_hari_cakupan: '7',
};

rutMaster.get(
  '/pengaturan',
  wajibPeran('owner', 'admin'),
  bungkus(async (_req, res) => {
    const baris = await db.banyak<{ kunci: string; nilai: string }>('SELECT kunci, nilai FROM pengaturan');
    const tersimpan = Object.fromEntries(baris.map((r) => [r.kunci, r.nilai]));
    res.json(Object.fromEntries(Object.entries(PENGATURAN_DIIZINKAN).map(([k, bawaan]) => [k, tersimpan[k] ?? bawaan])));
  })
);

rutMaster.put(
  '/pengaturan',
  wajibPeran('owner'),
  bungkus(async (req, res) => {
    const masuk = req.body ?? {};
    /* Hanya kunci yang dikenal yang ditulis. Menerima kunci sembarang dari
       peramban berarti antarmuka bisa menanam pengaturan yang tidak pernah
       dibaca siapa pun, atau menimpa kunci internal di kemudian hari. */
    const perubahan: Record<string, string> = {};
    for (const kunci of Object.keys(PENGATURAN_DIIZINKAN)) {
      if (masuk[kunci] !== undefined) perubahan[kunci] = String(masuk[kunci]);
    }
    if (Object.keys(perubahan).length === 0) throw new GalatPermintaan('Tidak ada pengaturan yang dikenali untuk disimpan.');

    await transaksi(async (k) => {
      for (const [kunci, nilai] of Object.entries(perubahan)) {
        await k.jalankan(
          'INSERT INTO pengaturan (kunci, nilai) VALUES ($1, $2) ON CONFLICT (kunci) DO UPDATE SET nilai = excluded.nilai',
          [kunci, nilai]
        );
      }
    });

    await catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'pengaturan', ringkasan: Object.keys(perubahan).join(', '), nilaiBaru: perubahan });
    res.json({ ok: true });
  })
);
