import { Router } from 'express';
import { db } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { statusStok } from '../stok.js';
import { angka, bungkus, GalatPermintaan, wajibTeks } from '../http.js';

export const rutMaster = Router();
rutMaster.use(wajibMasuk);

/* ---------------------------------------------------------------- Kategori */

rutMaster.get('/kategori', (_req, res) => {
  res.json(db.prepare('SELECT * FROM kategori ORDER BY nama').all());
});

rutMaster.post(
  '/kategori',
  wajibPeran('owner', 'admin'),
  bungkus((req, res) => {
    const nama = wajibTeks(req.body?.nama, 'Nama kategori');
    const hasil = db.prepare('INSERT INTO kategori (nama) VALUES (?)').run(nama);
    res.status(201).json({ id: hasil.lastInsertRowid, nama });
  })
);

/* ---------------------------------------------------------------- Supplier */

rutMaster.get('/supplier', wajibPeran('owner', 'admin', 'gudang'), (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM produk p WHERE p.supplier_id = s.id) AS jumlah_produk
         FROM supplier s ORDER BY s.nama`
      )
      .all()
  );
});

rutMaster.post(
  '/supplier',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus((req, res) => {
    const b = req.body ?? {};
    const hasil = db
      .prepare(
        `INSERT INTO supplier (nama, alamat, kontak, no_hp, lead_time_hari)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(wajibTeks(b.nama, 'Nama supplier'), b.alamat ?? null, b.kontak ?? null, b.no_hp ?? null, angka(b.lead_time_hari, 3));
    catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'supplier', entitasId: Number(hasil.lastInsertRowid), ringkasan: b.nama });
    res.status(201).json({ id: hasil.lastInsertRowid });
  })
);

rutMaster.put(
  '/supplier/:id',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const lama = db.prepare('SELECT * FROM supplier WHERE id = ?').get(id);
    if (!lama) throw new GalatPermintaan('Supplier tidak ditemukan.', 404);
    const b = req.body ?? {};
    db.prepare(
      `UPDATE supplier SET nama = ?, alamat = ?, kontak = ?, no_hp = ?, lead_time_hari = ?, aktif = ? WHERE id = ?`
    ).run(
      wajibTeks(b.nama, 'Nama supplier'),
      b.alamat ?? null,
      b.kontak ?? null,
      b.no_hp ?? null,
      angka(b.lead_time_hari, 3),
      b.aktif === false ? 0 : 1,
      id
    );
    catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'supplier', entitasId: id, ringkasan: b.nama, nilaiLama: lama, nilaiBaru: b });
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ Produk */

rutMaster.get('/produk', (req, res) => {
  const cari = String(req.query.cari ?? '').trim();
  const kategoriId = req.query.kategori_id ? Number(req.query.kategori_id) : null;
  const semua = req.query.semua === '1';

  const baris = db
    .prepare(
      `SELECT p.*, k.nama AS kategori, s.nama AS supplier
       FROM produk p
       LEFT JOIN kategori k ON k.id = p.kategori_id
       LEFT JOIN supplier s ON s.id = p.supplier_id
       WHERE (? = 1 OR p.aktif = 1)
         AND (? = '' OR p.nama LIKE '%' || ? || '%' OR p.sku LIKE '%' || ? || '%')
         AND (? IS NULL OR p.kategori_id = ?)
       ORDER BY p.nama`
    )
    .all(semua ? 1 : 0, cari, cari, cari, kategoriId, kategoriId) as any[];

  res.json(baris.map((p) => ({ ...p, status_stok: statusStok(p.stok, p.stok_minimum) })));
});

rutMaster.get(
  '/produk/:id',
  bungkus((req, res) => {
    const p = db
      .prepare(
        `SELECT p.*, k.nama AS kategori, s.nama AS supplier
         FROM produk p LEFT JOIN kategori k ON k.id = p.kategori_id
         LEFT JOIN supplier s ON s.id = p.supplier_id WHERE p.id = ?`
      )
      .get(Number(req.params.id)) as any;
    if (!p) throw new GalatPermintaan('Produk tidak ditemukan.', 404);
    res.json({ ...p, status_stok: statusStok(p.stok, p.stok_minimum) });
  })
);

function bacaProduk(b: any) {
  return {
    sku: wajibTeks(b.sku, 'SKU').toUpperCase(),
    nama: wajibTeks(b.nama, 'Nama produk'),
    kategori_id: b.kategori_id ? Number(b.kategori_id) : null,
    supplier_id: b.supplier_id ? Number(b.supplier_id) : null,
    satuan: String(b.satuan ?? 'pcs'),
    harga_beli: Math.round(angka(b.harga_beli)),
    harga_jual: Math.round(angka(b.harga_jual)),
    stok_minimum: Math.round(angka(b.stok_minimum)),
    safety_stock: Math.round(angka(b.safety_stock)),
    kelipatan_beli: Math.max(1, Math.round(angka(b.kelipatan_beli, 1))),
    foto_url: b.foto_url ?? null,
  };
}

rutMaster.post(
  '/produk',
  wajibPeran('owner', 'admin'),
  bungkus((req, res) => {
    const d = bacaProduk(req.body ?? {});
    /* Stok awal tidak diisi lewat form produk. Barang masuk ke gudang melalui
       penerimaan kulakan atau stock opname, dua jalur yang meninggalkan mutasi;
       memberi kolom stok awal di sini akan membuka jalan stok tanpa asal-usul. */
    const hasil = db
      .prepare(
        `INSERT INTO produk (sku, nama, kategori_id, supplier_id, satuan, harga_beli, harga_jual,
                             stok, stok_minimum, safety_stock, kelipatan_beli, foto_url)
         VALUES (@sku, @nama, @kategori_id, @supplier_id, @satuan, @harga_beli, @harga_jual,
                 0, @stok_minimum, @safety_stock, @kelipatan_beli, @foto_url)`
      )
      .run(d);
    catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'produk', entitasId: Number(hasil.lastInsertRowid), ringkasan: `${d.sku} — ${d.nama}`, nilaiBaru: d });
    res.status(201).json({ id: hasil.lastInsertRowid });
  })
);

rutMaster.put(
  '/produk/:id',
  wajibPeran('owner', 'admin'),
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const lama = db.prepare('SELECT * FROM produk WHERE id = ?').get(id) as any;
    if (!lama) throw new GalatPermintaan('Produk tidak ditemukan.', 404);
    const d = bacaProduk(req.body ?? {});
    db.prepare(
      `UPDATE produk SET sku=@sku, nama=@nama, kategori_id=@kategori_id, supplier_id=@supplier_id,
              satuan=@satuan, harga_beli=@harga_beli, harga_jual=@harga_jual, stok_minimum=@stok_minimum,
              safety_stock=@safety_stock, kelipatan_beli=@kelipatan_beli, foto_url=@foto_url
       WHERE id=@id`
    ).run({ ...d, id });

    /* Perubahan harga dicatat sebagai aksi tersendiri: inilah yang paling
       sering ditanyakan owner ketika margin sebuah produk tiba-tiba berubah. */
    if (lama.harga_jual !== d.harga_jual || lama.harga_beli !== d.harga_beli) {
      catatAudit({
        user: req.pengguna, aksi: 'ubah-harga', entitas: 'produk', entitasId: id,
        ringkasan: `${d.nama}: jual ${lama.harga_jual} → ${d.harga_jual}, beli ${lama.harga_beli} → ${d.harga_beli}`,
        nilaiLama: { harga_beli: lama.harga_beli, harga_jual: lama.harga_jual },
        nilaiBaru: { harga_beli: d.harga_beli, harga_jual: d.harga_jual },
      });
    } else {
      catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'produk', entitasId: id, ringkasan: d.nama, nilaiLama: lama, nilaiBaru: d });
    }
    res.json({ ok: true });
  })
);

rutMaster.delete(
  '/produk/:id',
  wajibPeran('owner', 'admin'),
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const p = db.prepare('SELECT nama FROM produk WHERE id = ?').get(id) as { nama: string } | undefined;
    if (!p) throw new GalatPermintaan('Produk tidak ditemukan.', 404);
    /* Dinonaktifkan, tidak dihapus: baris pesanan lama menunjuk ke produk ini
       dan laporan tahun berjalan harus tetap bisa menyebut namanya. */
    db.prepare('UPDATE produk SET aktif = 0 WHERE id = ?').run(id);
    catatAudit({ user: req.pengguna, aksi: 'nonaktifkan', entitas: 'produk', entitasId: id, ringkasan: p.nama });
    res.json({ ok: true, pesan: 'Produk dinonaktifkan. Riwayat transaksinya tetap tersimpan.' });
  })
);

/* ---------------------------------------------------------------- Customer */

/* Daftar customer memuat alamat, nomor telepon, dan nilai belanja seluruh
   toko. Peran buyer memakai API yang sama dari APK, jadi pembatasannya
   dipasang di rute, bukan disembunyikan di menu. */
rutMaster.get('/customer', wajibPeran('owner', 'admin', 'sales', 'gudang'), (req, res) => {
  const cari = String(req.query.cari ?? '').trim();
  res.json(
    db
      .prepare(
        `SELECT c.*, k.nama AS sales,
                COALESCE(t.jumlah_order, 0)  AS jumlah_order,
                COALESCE(t.total_belanja, 0) AS total_belanja,
                t.order_terakhir
         FROM customer c
         LEFT JOIN karyawan k ON k.id = c.sales_id
         LEFT JOIN (
           SELECT customer_id, COUNT(*) AS jumlah_order, SUM(total) AS total_belanja, MAX(tanggal) AS order_terakhir
           FROM pesanan WHERE status_kirim <> 'batal' GROUP BY customer_id
         ) t ON t.customer_id = c.id
         WHERE (? = '' OR c.nama LIKE '%' || ? || '%' OR c.kode LIKE '%' || ? || '%')
         ORDER BY c.nama`
      )
      .all(cari, cari, cari)
  );
});

rutMaster.get(
  '/customer/:id',
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const c = db
      .prepare('SELECT c.*, k.nama AS sales FROM customer c LEFT JOIN karyawan k ON k.id = c.sales_id WHERE c.id = ?')
      .get(id);
    if (!c) throw new GalatPermintaan('Customer tidak ditemukan.', 404);

    const ringkas = db
      .prepare(
        `SELECT COUNT(*) AS jumlah_order, COALESCE(SUM(total),0) AS total_belanja,
                COALESCE(AVG(total),0) AS rata_order, MAX(tanggal) AS order_terakhir
         FROM pesanan WHERE customer_id = ? AND status_kirim <> 'batal'`
      )
      .get(id) as any;

    const riwayat = db
      .prepare('SELECT id, nomor, tanggal, total, status_bayar, status_kirim FROM pesanan WHERE customer_id = ? ORDER BY tanggal DESC, id DESC LIMIT 20')
      .all(id);

    res.json({ ...(c as object), ringkas: { ...ringkas, rata_order: Math.round(ringkas.rata_order) }, riwayat });
  })
);

function bacaCustomer(b: any) {
  return {
    kode: b.kode ? String(b.kode).toUpperCase() : null,
    nama: wajibTeks(b.nama, 'Nama customer'),
    alamat: b.alamat ?? null,
    no_hp: b.no_hp ?? null,
    tipe: ['toko', 'grosir', 'retail', 'horeka'].includes(b.tipe) ? b.tipe : 'toko',
    sales_id: b.sales_id ? Number(b.sales_id) : null,
    limit_kredit: Math.round(angka(b.limit_kredit)),
    status: ['aktif', 'nonaktif', 'blokir'].includes(b.status) ? b.status : 'aktif',
    lat: b.lat != null ? Number(b.lat) : null,
    lng: b.lng != null ? Number(b.lng) : null,
  };
}

rutMaster.post(
  '/customer',
  wajibPeran('owner', 'admin', 'sales'),
  bungkus((req, res) => {
    const d = bacaCustomer(req.body ?? {});
    const hasil = db
      .prepare(
        `INSERT INTO customer (kode, nama, alamat, no_hp, tipe, sales_id, limit_kredit, status, lat, lng)
         VALUES (@kode, @nama, @alamat, @no_hp, @tipe, @sales_id, @limit_kredit, @status, @lat, @lng)`
      )
      .run(d);
    catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'customer', entitasId: Number(hasil.lastInsertRowid), ringkasan: d.nama });
    res.status(201).json({ id: hasil.lastInsertRowid });
  })
);

rutMaster.put(
  '/customer/:id',
  wajibPeran('owner', 'admin', 'sales'),
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const lama = db.prepare('SELECT * FROM customer WHERE id = ?').get(id);
    if (!lama) throw new GalatPermintaan('Customer tidak ditemukan.', 404);
    const d = bacaCustomer(req.body ?? {});
    db.prepare(
      `UPDATE customer SET kode=@kode, nama=@nama, alamat=@alamat, no_hp=@no_hp, tipe=@tipe,
              sales_id=@sales_id, limit_kredit=@limit_kredit, status=@status, lat=@lat, lng=@lng WHERE id=@id`
    ).run({ ...d, id });
    catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'customer', entitasId: id, ringkasan: d.nama, nilaiLama: lama, nilaiBaru: d });
    res.json({ ok: true });
  })
);

/* ---------------------------------------------------------------- Karyawan */

rutMaster.get('/karyawan', wajibPeran('owner', 'admin', 'sales', 'gudang', 'driver'), (_req, res) => {
  res.json(db.prepare('SELECT * FROM karyawan ORDER BY nama').all());
});

rutMaster.post(
  '/karyawan',
  wajibPeran('owner', 'admin'),
  bungkus((req, res) => {
    const b = req.body ?? {};
    const hasil = db
      .prepare(
        `INSERT INTO karyawan (nama, jabatan, no_hp, status, tanggal_bergabung, area_kerja, foto_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        wajibTeks(b.nama, 'Nama karyawan'),
        wajibTeks(b.jabatan, 'Jabatan'),
        b.no_hp ?? null,
        b.status ?? 'aktif',
        b.tanggal_bergabung ?? null,
        b.area_kerja ?? null,
        b.foto_url ?? null
      );
    catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'karyawan', entitasId: Number(hasil.lastInsertRowid), ringkasan: b.nama });
    res.status(201).json({ id: hasil.lastInsertRowid });
  })
);

rutMaster.put(
  '/karyawan/:id',
  wajibPeran('owner', 'admin'),
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const lama = db.prepare('SELECT * FROM karyawan WHERE id = ?').get(id);
    if (!lama) throw new GalatPermintaan('Karyawan tidak ditemukan.', 404);
    const b = req.body ?? {};
    db.prepare(
      `UPDATE karyawan SET nama=?, jabatan=?, no_hp=?, status=?, tanggal_bergabung=?, area_kerja=?, foto_url=? WHERE id=?`
    ).run(
      wajibTeks(b.nama, 'Nama karyawan'), wajibTeks(b.jabatan, 'Jabatan'), b.no_hp ?? null,
      b.status ?? 'aktif', b.tanggal_bergabung ?? null, b.area_kerja ?? null, b.foto_url ?? null, id
    );
    catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'karyawan', entitasId: id, ringkasan: b.nama, nilaiLama: lama, nilaiBaru: b });
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------- Pengaturan */

/** Kunci yang boleh diubah lewat antarmuka, beserta nilai bawaannya. */
const PENGATURAN_DIIZINKAN: Record<string, string> = {
  nama_usaha: 'DistribusiHub',
  absensi_lat: '-7.797068',
  absensi_lng: '110.370529',
  absensi_radius_m: '150',
  absensi_jam_masuk: '08:00:00',
  kulakan_hari_riwayat: '30',
  kulakan_hari_cakupan: '7',
};

rutMaster.get('/pengaturan', wajibPeran('owner', 'admin'), (_req, res) => {
  const tersimpan = Object.fromEntries(
    (db.prepare('SELECT kunci, nilai FROM pengaturan').all() as any[]).map((r) => [r.kunci, r.nilai])
  );
  res.json(Object.fromEntries(Object.entries(PENGATURAN_DIIZINKAN).map(([k, bawaan]) => [k, tersimpan[k] ?? bawaan])));
});

rutMaster.put(
  '/pengaturan',
  wajibPeran('owner'),
  bungkus((req, res) => {
    const masuk = req.body ?? {};
    /* Hanya kunci yang dikenal yang ditulis. Menerima kunci sembarang dari
       peramban berarti antarmuka bisa menanam pengaturan yang tidak pernah
       dibaca siapa pun, atau menimpa kunci internal di kemudian hari. */
    const perubahan: Record<string, string> = {};
    for (const kunci of Object.keys(PENGATURAN_DIIZINKAN)) {
      if (masuk[kunci] !== undefined) perubahan[kunci] = String(masuk[kunci]);
    }
    if (Object.keys(perubahan).length === 0) throw new GalatPermintaan('Tidak ada pengaturan yang dikenali untuk disimpan.');

    const simpan = db.transaction(() => {
      for (const [kunci, nilai] of Object.entries(perubahan)) {
        db.prepare('INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai').run(kunci, nilai);
      }
    });
    simpan();

    catatAudit({ user: req.pengguna, aksi: 'ubah', entitas: 'pengaturan', ringkasan: Object.keys(perubahan).join(', '), nilaiBaru: perubahan });
    res.json({ ok: true });
  })
);
