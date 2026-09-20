import { Router } from 'express';
import { db, transaksi, ambilPengaturan } from '../db.js';
import { STAF, wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { simpanFoto } from '../berkas.js';
import { hariIni, jamSekarang, jarakMeter, nomorBerikutnya } from '../util.js';
import { angka, bungkus, GalatPermintaan, wajibTeks } from '../http.js';

export const rutOperasional = Router();
rutOperasional.use(wajibMasuk);

/** Karyawan yang terkait akun yang sedang masuk; dipakai absensi dan aktivitas. */
function karyawanSaya(req: any): number {
  const id = req.pengguna?.karyawan_id;
  if (!id) throw new GalatPermintaan('Akun Anda belum terhubung ke data karyawan. Hubungi admin.', 409);
  return id;
}

async function titikKantor() {
  return {
    lat: Number(await ambilPengaturan('absensi_lat', process.env.ABSENSI_LAT ?? '-7.797068')),
    lng: Number(await ambilPengaturan('absensi_lng', process.env.ABSENSI_LNG ?? '110.370529')),
    radius: Number(await ambilPengaturan('absensi_radius_m', process.env.ABSENSI_RADIUS_M ?? '150')),
  };
}

/* ----------------------------------------------------------------- Absensi */

rutOperasional.get(
  '/absensi/hari-ini',
  wajibPeran(...STAF),
  bungkus(async (req, res) => {
    const baris = await db.satu(
      'SELECT * FROM absensi WHERE karyawan_id = $1 AND tanggal = $2::date',
      [karyawanSaya(req), hariIni()]
    );
    res.json({ absensi: baris ?? null, kantor: await titikKantor() });
  })
);

rutOperasional.get(
  '/absensi',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const dari = String(req.query.dari ?? hariIni());
    const sampai = String(req.query.sampai ?? hariIni());
    /* foto_pulang tidak ikut: tabel absensi hanya menampilkan satu foto per
       baris, dan tiap URL yang terkirim berujung pada satu unduhan berkas. */
    res.json(
      await db.banyak(
        `SELECT a.id, a.karyawan_id, a.tanggal, a.jam_masuk, a.jam_pulang,
                a.jarak_masuk_m, a.status, a.foto_masuk, k.nama, k.jabatan
         FROM absensi a JOIN karyawan k ON k.id = a.karyawan_id
         WHERE a.tanggal BETWEEN $1::date AND $2::date
         ORDER BY a.tanggal DESC, k.nama
         LIMIT $3`,
        [dari, sampai, Math.min(500, Math.max(1, Math.round(angka(req.query.batas, 200))))]
      )
    );
  })
);

/**
 * Absen masuk dan pulang.
 *
 * Foto dan koordinat wajib. Absensi di luar radius tetap disimpan, tidak
 * ditolak — sopir yang mulai hari dari gudang cabang atau sales yang langsung
 * ke pasar tetap harus tercatat. Yang dicatat adalah jaraknya, supaya owner
 * melihat mana yang di luar area dan menilai sendiri.
 */
async function catatAbsen(req: any, sesi: 'masuk' | 'pulang') {
  const karyawanId = karyawanSaya(req);
  const b = req.body ?? {};
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new GalatPermintaan('Lokasi GPS tidak terbaca. Aktifkan izin lokasi lalu coba lagi.');
  }
  const foto = await simpanFoto(b.foto, `absen-${sesi}`);
  if (!foto) throw new GalatPermintaan('Foto selfie wajib diambil.');

  const kantor = await titikKantor();
  const jarak = jarakMeter(lat, lng, kantor.lat, kantor.lng);
  const diLuarArea = jarak > kantor.radius;
  const tanggal = hariIni();
  const jam = jamSekarang();

  if (sesi === 'masuk') {
    const batasMasuk = await ambilPengaturan('absensi_jam_masuk', '08:00:00');
    /* Satu perintah, bukan cek-lalu-sisip: dua permintaan yang tiba bersamaan
       akan membuat pemeriksaan terpisah sama-sama lolos. Batasan UNIQUE pada
       (karyawan_id, tanggal) yang memutuskan, dan jumlah baris yang tersisip
       memberitahu apakah absennya baru atau sudah ada. */
    const sisip = await db.jalankan(
      `INSERT INTO absensi (karyawan_id, tanggal, jam_masuk, lat_masuk, lng_masuk, foto_masuk, jarak_masuk_m, status)
       VALUES ($1, $2::date, $3::time, $4, $5, $6, $7, $8)
       ON CONFLICT (karyawan_id, tanggal) DO NOTHING`,
      [karyawanId, tanggal, jam, lat, lng, foto, jarak, jam > batasMasuk ? 'terlambat' : 'hadir']
    );
    if (sisip === 0) throw new GalatPermintaan('Anda sudah melakukan absen masuk hari ini.', 409);
  } else {
    const ubah = await db.jalankan(
      `UPDATE absensi SET jam_pulang = $1::time, lat_pulang = $2, lng_pulang = $3,
              foto_pulang = $4, jarak_pulang_m = $5
       WHERE karyawan_id = $6 AND tanggal = $7::date`,
      [jam, lat, lng, foto, jarak, karyawanId, tanggal]
    );
    if (ubah === 0) throw new GalatPermintaan('Belum ada absen masuk hari ini.', 409);
  }

  return {
    ok: true,
    jam,
    jarak_m: jarak,
    di_luar_area: diLuarArea,
    pesan: diLuarArea
      ? `Absen tercatat, tetapi Anda berada ${jarak} m dari titik absensi (batas ${kantor.radius} m). Catatan ini ditandai untuk ditinjau.`
      : `Absen ${sesi} tercatat pukul ${jam}.`,
  };
}

rutOperasional.post('/absensi/masuk', wajibPeran(...STAF), bungkus(async (req, res) => res.json(await catatAbsen(req, 'masuk'))));
rutOperasional.post('/absensi/pulang', wajibPeran(...STAF), bungkus(async (req, res) => res.json(await catatAbsen(req, 'pulang'))));

/* --------------------------------------------------------------- Aktivitas */

rutOperasional.get(
  '/aktivitas',
  wajibPeran(...STAF),
  bungkus(async (req, res) => {
    const pengguna = req.pengguna!;
    /* Peran lapangan hanya melihat aktivitasnya sendiri; owner dan admin melihat
       semuanya dan boleh menyaring per karyawan. */
    const bolehSemua = ['owner', 'admin'].includes(pengguna.peran);
    const karyawanId = bolehSemua ? (req.query.karyawan_id ? Number(req.query.karyawan_id) : null) : pengguna.karyawan_id;

    /* Akun lapangan yang belum ditautkan ke data karyawan tidak punya aktivitas
       sendiri. Diteruskan sebagai null, penyaringnya justru mati dan orang itu
       melihat aktivitas seluruh karyawan. */
    if (!bolehSemua && !karyawanId) return res.json([]);
    const dari = String(req.query.dari ?? hariIni());
    const sampai = String(req.query.sampai ?? hariIni());

    res.json(
      await db.banyak(
        `SELECT a.id, a.jenis, a.waktu, a.lat, a.lng, a.foto_url, a.catatan,
                k.nama, k.jabatan, o.nomor AS nomor_pesanan
         FROM aktivitas a JOIN karyawan k ON k.id = a.karyawan_id
         LEFT JOIN pesanan o ON o.id = a.pesanan_id
         WHERE a.waktu::date BETWEEN $1::date AND $2::date
           AND ($3::int IS NULL OR a.karyawan_id = $3::int)
         ORDER BY a.waktu DESC LIMIT $4`,
        [dari, sampai, karyawanId, Math.min(500, Math.max(1, Math.round(angka(req.query.batas, 200))))]
      )
    );
  })
);

rutOperasional.post(
  '/aktivitas',
  wajibPeran(...STAF),
  bungkus(async (req, res) => {
    const b = req.body ?? {};
    const foto = await simpanFoto(b.foto, 'aktivitas');
    const baris = await db.satu<{ id: number }>(
      `INSERT INTO aktivitas (karyawan_id, jenis, lat, lng, foto_url, pesanan_id, pengiriman_id, catatan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        karyawanSaya(req),
        wajibTeks(b.jenis, 'Jenis aktivitas'),
        b.lat != null ? Number(b.lat) : null,
        b.lng != null ? Number(b.lng) : null,
        foto,
        b.pesanan_id ? Number(b.pesanan_id) : null,
        b.pengiriman_id ? Number(b.pengiriman_id) : null,
        b.catatan ?? null,
      ]
    );
    res.status(201).json({ id: baris!.id });
  })
);

/* -------------------------------------------------------------- Pengiriman */

rutOperasional.get(
  '/pengiriman',
  wajibPeran('owner', 'admin', 'gudang', 'driver'),
  bungkus(async (req, res) => {
    const pengguna = req.pengguna!;
    const driverId = pengguna.peran === 'driver' ? pengguna.karyawan_id : req.query.driver_id ? Number(req.query.driver_id) : null;
    const status = req.query.status ? String(req.query.status) : null;

    res.json(
      await db.banyak(
        `SELECT g.id, g.nomor, g.status, g.driver_id, g.dimulai_pada, g.selesai_pada,
                o.nomor AS nomor_pesanan, o.total, c.nama AS customer, c.alamat, c.no_hp, k.nama AS driver
         FROM pengiriman g
         JOIN pesanan o ON o.id = g.pesanan_id
         JOIN customer c ON c.id = o.customer_id
         LEFT JOIN karyawan k ON k.id = g.driver_id
         WHERE ($1::int IS NULL OR g.driver_id = $1::int)
           AND ($2::text IS NULL OR g.status = $2)
         ORDER BY CASE WHEN g.status IN ('selesai','gagal') THEN 1 ELSE 0 END, g.id DESC
         LIMIT $3`,
        [driverId, status, Math.min(300, Math.max(1, Math.round(angka(req.query.batas, 100))))]
      )
    );
  })
);

rutOperasional.get(
  '/pengiriman/:id',
  wajibPeran('owner', 'admin', 'gudang', 'driver'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const kirim = await db.satu<any>(
      `SELECT g.*, o.nomor AS nomor_pesanan, o.total, c.nama AS customer, c.alamat, c.no_hp, k.nama AS driver
       FROM pengiriman g JOIN pesanan o ON o.id = g.pesanan_id JOIN customer c ON c.id = o.customer_id
       LEFT JOIN karyawan k ON k.id = g.driver_id WHERE g.id = $1`,
      [id]
    );
    if (!kirim) throw new GalatPermintaan('Data pengiriman tidak ditemukan.', 404);
    kirim.item = await db.banyak(
      `SELECT i.qty, i.harga, i.subtotal, p.nama, p.satuan
       FROM pesanan_item i JOIN produk p ON p.id = i.produk_id WHERE i.pesanan_id = $1 ORDER BY i.id`,
      [kirim.pesanan_id]
    );
    kirim.timeline = await db.banyak(
      'SELECT id, jenis, waktu, lat, lng FROM aktivitas WHERE pengiriman_id = $1 ORDER BY waktu',
      [id]
    );
    res.json(kirim);
  })
);

rutOperasional.post(
  '/pengiriman',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus(async (req, res) => {
    const pesananId = Number(req.body?.pesanan_id);

    const hasil = await transaksi(async (k) => {
      const pesanan = await k.satu<any>('SELECT id, nomor, status_kirim FROM pesanan WHERE id = $1', [pesananId]);
      if (!pesanan) throw new GalatPermintaan('Pesanan tidak ditemukan.', 404);
      if (pesanan.status_kirim === 'batal') throw new GalatPermintaan('Pesanan ini sudah dibatalkan.', 409);

      const nomor = await nomorBerikutnya(k, 'pengiriman', 'DO');
      const dibuat = await k.satu<{ id: number }>(
        'INSERT INTO pengiriman (nomor, pesanan_id, driver_id, catatan) VALUES ($1, $2, $3, $4) RETURNING id',
        [nomor, pesananId, req.body?.driver_id ? Number(req.body.driver_id) : null, req.body?.catatan ?? null]
      );
      await k.jalankan(`UPDATE pesanan SET status_kirim = 'diproses' WHERE id = $1`, [pesananId]);
      return { id: dibuat!.id, nomor, nomorPesanan: pesanan.nomor as string };
    });

    await catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'pengiriman', entitasId: hasil.id, ringkasan: `${hasil.nomor} untuk ${hasil.nomorPesanan}` });
    res.status(201).json({ id: hasil.id, nomor: hasil.nomor });
  })
);

const URUTAN_KIRIM = ['ditugaskan', 'berangkat', 'sampai', 'bongkar', 'diterima', 'selesai'] as const;

/**
 * Perpindahan status pengiriman oleh driver.
 *
 * Tiap langkah mencatat satu baris aktivitas berikut GPS dan waktunya,
 * sehingga timeline pengiriman di sisi owner tersusun dari jejak yang sama
 * yang dipakai laporan aktivitas karyawan — bukan dari catatan terpisah yang
 * bisa berbeda isi.
 */
rutOperasional.patch(
  '/pengiriman/:id/status',
  wajibPeran('owner', 'admin', 'gudang', 'driver'),
  bungkus(async (req, res) => {
    const id = Number(req.params.id);
    const pengguna = req.pengguna!;
    const b = req.body ?? {};
    const status = String(b.status ?? '');

    if (!URUTAN_KIRIM.includes(status as never) && status !== 'gagal') {
      throw new GalatPermintaan('Status pengiriman tidak dikenali.');
    }

    const foto = await simpanFoto(b.foto, `kirim-${status}`);
    const ttd = await simpanFoto(b.ttd, 'ttd');
    const lat = b.lat != null ? Number(b.lat) : null;
    const lng = b.lng != null ? Number(b.lng) : null;

    /* Bukti serah terima diminta tepat pada langkah 'diterima', bukan di akhir:
       pada titik inilah driver masih berhadapan dengan penerima. */
    if (status === 'diterima') {
      if (!foto) throw new GalatPermintaan('Foto bukti penerimaan wajib diambil.');
      if (!String(b.penerima ?? '').trim()) throw new GalatPermintaan('Nama penerima wajib diisi.');
    }

    await transaksi(async (k) => {
      const kirim = await k.satu<any>('SELECT * FROM pengiriman WHERE id = $1 FOR UPDATE', [id]);
      if (!kirim) throw new GalatPermintaan('Data pengiriman tidak ditemukan.', 404);
      if (pengguna.peran === 'driver' && kirim.driver_id !== pengguna.karyawan_id) {
        throw new GalatPermintaan('Pengiriman ini ditugaskan ke driver lain.', 403);
      }
      if (['selesai', 'gagal'].includes(kirim.status)) {
        throw new GalatPermintaan('Pengiriman ini sudah ditutup.', 409);
      }

      await k.jalankan(
        `UPDATE pengiriman SET status = $1,
           dimulai_pada = COALESCE(dimulai_pada, CASE WHEN $1 = 'berangkat' THEN now() END),
           selesai_pada = CASE WHEN $1 IN ('selesai','gagal') THEN now() ELSE selesai_pada END,
           penerima = COALESCE($2, penerima), foto_url = COALESCE($3, foto_url),
           ttd_url = COALESCE($4, ttd_url), lat = COALESCE($5, lat), lng = COALESCE($6, lng),
           catatan = COALESCE($7, catatan)
         WHERE id = $8`,
        [status, b.penerima ?? null, foto, ttd, lat, lng, b.catatan ?? null, id]
      );

      if (pengguna.karyawan_id) {
        await k.jalankan(
          `INSERT INTO aktivitas (karyawan_id, jenis, lat, lng, foto_url, pesanan_id, pengiriman_id, catatan)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [pengguna.karyawan_id, `pengiriman:${status}`, lat, lng, foto, kirim.pesanan_id, id, b.catatan ?? null]
        );
      }

      if (status === 'selesai') await k.jalankan(`UPDATE pesanan SET status_kirim = 'selesai' WHERE id = $1`, [kirim.pesanan_id]);
      if (status === 'berangkat') await k.jalankan(`UPDATE pesanan SET status_kirim = 'dikirim' WHERE id = $1`, [kirim.pesanan_id]);
    });

    res.json({ ok: true, status });
  })
);
