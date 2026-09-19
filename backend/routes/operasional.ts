import { Router } from 'express';
import { db, ambilPengaturan } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { catatAudit } from '../audit.js';
import { simpanFotoBase64 } from '../berkas.js';
import { hariIni, jarakMeter, nomorBerikutnya, waktuSekarang } from '../util.js';
import { angka, bungkus, GalatPermintaan, wajibTeks } from '../http.js';

export const rutOperasional = Router();
rutOperasional.use(wajibMasuk);

/** Karyawan yang terkait akun yang sedang masuk; dipakai absensi dan aktivitas. */
function karyawanSaya(req: any): number {
  const id = req.pengguna?.karyawan_id;
  if (!id) throw new GalatPermintaan('Akun Anda belum terhubung ke data karyawan. Hubungi admin.', 409);
  return id;
}

function titikKantor() {
  return {
    lat: Number(ambilPengaturan('absensi_lat', process.env.ABSENSI_LAT ?? '-7.797068')),
    lng: Number(ambilPengaturan('absensi_lng', process.env.ABSENSI_LNG ?? '110.370529')),
    radius: Number(ambilPengaturan('absensi_radius_m', process.env.ABSENSI_RADIUS_M ?? '150')),
  };
}

/* ----------------------------------------------------------------- Absensi */

rutOperasional.get('/absensi/hari-ini', (req, res) => {
  const baris = db.prepare('SELECT * FROM absensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawanSaya(req), hariIni());
  res.json({ absensi: baris ?? null, kantor: titikKantor() });
});

rutOperasional.get('/absensi', wajibPeran('owner', 'admin'), (req, res) => {
  const dari = String(req.query.dari ?? hariIni());
  const sampai = String(req.query.sampai ?? hariIni());
  res.json(
    db
      .prepare(
        `SELECT a.*, k.nama, k.jabatan FROM absensi a JOIN karyawan k ON k.id = a.karyawan_id
         WHERE a.tanggal BETWEEN ? AND ? ORDER BY a.tanggal DESC, k.nama`
      )
      .all(dari, sampai)
  );
});

/**
 * Absen masuk dan pulang.
 *
 * Foto dan koordinat wajib. Absensi di luar radius tetap disimpan, tidak
 * ditolak — sopir yang mulai hari dari gudang cabang atau sales yang langsung
 * ke pasar tetap harus tercatat. Yang dicatat adalah jaraknya, supaya owner
 * melihat mana yang di luar area dan menilai sendiri.
 */
function catatAbsen(req: any, sesi: 'masuk' | 'pulang') {
  const karyawanId = karyawanSaya(req);
  const b = req.body ?? {};
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new GalatPermintaan('Lokasi GPS tidak terbaca. Aktifkan izin lokasi lalu coba lagi.');
  }
  const foto = simpanFotoBase64(b.foto, `absen-${sesi}`);
  if (!foto) throw new GalatPermintaan('Foto selfie wajib diambil.');

  const kantor = titikKantor();
  const jarak = jarakMeter(lat, lng, kantor.lat, kantor.lng);
  const diLuarArea = jarak > kantor.radius;
  const tanggal = hariIni();
  const jam = waktuSekarang().slice(11, 19);

  if (sesi === 'masuk') {
    const sudah = db.prepare('SELECT id FROM absensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawanId, tanggal);
    if (sudah) throw new GalatPermintaan('Anda sudah melakukan absen masuk hari ini.', 409);

    const batasMasuk = ambilPengaturan('absensi_jam_masuk', '08:00:00');
    db.prepare(
      `INSERT INTO absensi (karyawan_id, tanggal, jam_masuk, lat_masuk, lng_masuk, foto_masuk, jarak_masuk_m, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(karyawanId, tanggal, jam, lat, lng, foto, jarak, jam > batasMasuk ? 'terlambat' : 'hadir');
  } else {
    const baris = db.prepare('SELECT id FROM absensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawanId, tanggal) as any;
    if (!baris) throw new GalatPermintaan('Belum ada absen masuk hari ini.', 409);
    db.prepare('UPDATE absensi SET jam_pulang = ?, lat_pulang = ?, lng_pulang = ?, foto_pulang = ?, jarak_pulang_m = ? WHERE id = ?')
      .run(jam, lat, lng, foto, jarak, baris.id);
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

rutOperasional.post('/absensi/masuk', bungkus((req, res) => res.json(catatAbsen(req, 'masuk'))));
rutOperasional.post('/absensi/pulang', bungkus((req, res) => res.json(catatAbsen(req, 'pulang'))));

/* --------------------------------------------------------------- Aktivitas */

rutOperasional.get('/aktivitas', (req, res) => {
  const pengguna = req.pengguna!;
  /* Peran lapangan hanya melihat aktivitasnya sendiri; owner dan admin melihat
     semuanya dan boleh menyaring per karyawan. */
  const bolehSemua = ['owner', 'admin'].includes(pengguna.peran);
  const karyawanId = bolehSemua ? (req.query.karyawan_id ? Number(req.query.karyawan_id) : null) : pengguna.karyawan_id;
  const dari = String(req.query.dari ?? hariIni());
  const sampai = String(req.query.sampai ?? hariIni());

  res.json(
    db
      .prepare(
        `SELECT a.*, k.nama, k.jabatan, o.nomor AS nomor_pesanan
         FROM aktivitas a JOIN karyawan k ON k.id = a.karyawan_id
         LEFT JOIN pesanan o ON o.id = a.pesanan_id
         WHERE date(a.waktu) BETWEEN ? AND ? AND (? IS NULL OR a.karyawan_id = ?)
         ORDER BY a.waktu DESC LIMIT 500`
      )
      .all(dari, sampai, karyawanId, karyawanId)
  );
});

rutOperasional.post(
  '/aktivitas',
  bungkus((req, res) => {
    const b = req.body ?? {};
    const foto = simpanFotoBase64(b.foto, 'aktivitas');
    const hasil = db
      .prepare(
        `INSERT INTO aktivitas (karyawan_id, jenis, lat, lng, foto_url, pesanan_id, pengiriman_id, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        karyawanSaya(req),
        wajibTeks(b.jenis, 'Jenis aktivitas'),
        b.lat != null ? Number(b.lat) : null,
        b.lng != null ? Number(b.lng) : null,
        foto,
        b.pesanan_id ? Number(b.pesanan_id) : null,
        b.pengiriman_id ? Number(b.pengiriman_id) : null,
        b.catatan ?? null
      );
    res.status(201).json({ id: hasil.lastInsertRowid });
  })
);

/* -------------------------------------------------------------- Pengiriman */

rutOperasional.get('/pengiriman', (req, res) => {
  const pengguna = req.pengguna!;
  const driverId = pengguna.peran === 'driver' ? pengguna.karyawan_id : req.query.driver_id ? Number(req.query.driver_id) : null;
  const status = req.query.status ? String(req.query.status) : null;

  res.json(
    db
      .prepare(
        `SELECT g.*, o.nomor AS nomor_pesanan, o.total, c.nama AS customer, c.alamat, c.no_hp, k.nama AS driver
         FROM pengiriman g
         JOIN pesanan o ON o.id = g.pesanan_id
         JOIN customer c ON c.id = o.customer_id
         LEFT JOIN karyawan k ON k.id = g.driver_id
         WHERE (? IS NULL OR g.driver_id = ?) AND (? IS NULL OR g.status = ?)
         ORDER BY CASE g.status WHEN 'selesai' THEN 1 WHEN 'gagal' THEN 1 ELSE 0 END, g.id DESC
         LIMIT 200`
      )
      .all(driverId, driverId, status, status)
  );
});

rutOperasional.get(
  '/pengiriman/:id',
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const kirim = db
      .prepare(
        `SELECT g.*, o.nomor AS nomor_pesanan, o.total, c.nama AS customer, c.alamat, c.no_hp, k.nama AS driver
         FROM pengiriman g JOIN pesanan o ON o.id = g.pesanan_id JOIN customer c ON c.id = o.customer_id
         LEFT JOIN karyawan k ON k.id = g.driver_id WHERE g.id = ?`
      )
      .get(id) as any;
    if (!kirim) throw new GalatPermintaan('Data pengiriman tidak ditemukan.', 404);
    kirim.item = db
      .prepare('SELECT i.qty, i.harga, i.subtotal, p.nama, p.satuan FROM pesanan_item i JOIN produk p ON p.id = i.produk_id WHERE i.pesanan_id = ?')
      .all(kirim.pesanan_id);
    kirim.timeline = db.prepare('SELECT * FROM aktivitas WHERE pengiriman_id = ? ORDER BY waktu').all(id);
    res.json(kirim);
  })
);

rutOperasional.post(
  '/pengiriman',
  wajibPeran('owner', 'admin', 'gudang'),
  bungkus((req, res) => {
    const pesananId = Number(req.body?.pesanan_id);
    const pesanan = db.prepare('SELECT * FROM pesanan WHERE id = ?').get(pesananId) as any;
    if (!pesanan) throw new GalatPermintaan('Pesanan tidak ditemukan.', 404);
    if (pesanan.status_kirim === 'batal') throw new GalatPermintaan('Pesanan ini sudah dibatalkan.', 409);

    const nomor = nomorBerikutnya('pengiriman', 'DO');
    const hasil = db
      .prepare('INSERT INTO pengiriman (nomor, pesanan_id, driver_id, catatan) VALUES (?, ?, ?, ?)')
      .run(nomor, pesananId, req.body?.driver_id ? Number(req.body.driver_id) : null, req.body?.catatan ?? null);
    db.prepare(`UPDATE pesanan SET status_kirim = 'diproses' WHERE id = ?`).run(pesananId);

    catatAudit({ user: req.pengguna, aksi: 'tambah', entitas: 'pengiriman', entitasId: Number(hasil.lastInsertRowid), ringkasan: `${nomor} untuk ${pesanan.nomor}` });
    res.status(201).json({ id: hasil.lastInsertRowid, nomor });
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
  bungkus((req, res) => {
    const id = Number(req.params.id);
    const kirim = db.prepare('SELECT * FROM pengiriman WHERE id = ?').get(id) as any;
    if (!kirim) throw new GalatPermintaan('Data pengiriman tidak ditemukan.', 404);

    const pengguna = req.pengguna!;
    if (pengguna.peran === 'driver' && kirim.driver_id !== pengguna.karyawan_id) {
      throw new GalatPermintaan('Pengiriman ini ditugaskan ke driver lain.', 403);
    }

    const b = req.body ?? {};
    const status = String(b.status ?? '');
    if (!URUTAN_KIRIM.includes(status as any) && status !== 'gagal') {
      throw new GalatPermintaan('Status pengiriman tidak dikenali.');
    }
    if (['selesai', 'gagal'].includes(kirim.status)) {
      throw new GalatPermintaan('Pengiriman ini sudah ditutup.', 409);
    }

    const foto = simpanFotoBase64(b.foto, `kirim-${status}`);
    const lat = b.lat != null ? Number(b.lat) : null;
    const lng = b.lng != null ? Number(b.lng) : null;

    /* Bukti serah terima diminta tepat pada langkah 'diterima', bukan di akhir:
       pada titik inilah driver masih berhadapan dengan penerima. */
    if (status === 'diterima') {
      if (!foto) throw new GalatPermintaan('Foto bukti penerimaan wajib diambil.');
      if (!String(b.penerima ?? '').trim()) throw new GalatPermintaan('Nama penerima wajib diisi.');
    }

    const proses = db.transaction(() => {
      db.prepare(
        `UPDATE pengiriman SET status = ?,
           dimulai_pada = COALESCE(dimulai_pada, CASE WHEN ? = 'berangkat' THEN datetime('now','localtime') END),
           selesai_pada = CASE WHEN ? IN ('selesai','gagal') THEN datetime('now','localtime') ELSE selesai_pada END,
           penerima = COALESCE(?, penerima), foto_url = COALESCE(?, foto_url),
           ttd_url = COALESCE(?, ttd_url), lat = COALESCE(?, lat), lng = COALESCE(?, lng),
           catatan = COALESCE(?, catatan)
         WHERE id = ?`
      ).run(
        status, status, status,
        b.penerima ?? null, foto, simpanFotoBase64(b.ttd, 'ttd'),
        lat, lng, b.catatan ?? null, id
      );

      if (pengguna.karyawan_id) {
        db.prepare(
          `INSERT INTO aktivitas (karyawan_id, jenis, lat, lng, foto_url, pesanan_id, pengiriman_id, catatan)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(pengguna.karyawan_id, `pengiriman:${status}`, lat, lng, foto, kirim.pesanan_id, id, b.catatan ?? null);
      }

      if (status === 'selesai') db.prepare(`UPDATE pesanan SET status_kirim = 'selesai' WHERE id = ?`).run(kirim.pesanan_id);
      if (status === 'berangkat') db.prepare(`UPDATE pesanan SET status_kirim = 'dikirim' WHERE id = ?`).run(kirim.pesanan_id);
    });

    proses();
    res.json({ ok: true, status });
  })
);
