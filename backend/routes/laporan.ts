import { Router } from 'express';
import { db } from '../db.js';
import { STAF, wajibMasuk, wajibPeran } from '../auth.js';
import { statusStok } from '../stok.js';
import { hitungSaranKulakan } from '../kulakan-cerdas.js';
import { hariIni, periodeSebelumnya, rentangPeriode } from '../util.js';
import { angka, bungkus } from '../http.js';

export const rutLaporan = Router();
rutLaporan.use(wajibMasuk);

/* Postgres mengembalikan bigint sebagai string agar presisi 64 bit tidak hilang
   di JavaScript. Nilai uang usaha ini masih jauh di bawah batas aman angka JS,
   jadi dikonversi di sini supaya sisi peramban tetap menerima angka. */
const n = (v: unknown): number => Number(v ?? 0);

/**
 * Angka pendapatan dipisah dua, dan keduanya selalu dikembalikan bersama.
 *
 *   omzet            = seluruh yang ditagihkan ke customer, termasuk ongkir
 *   penjualan_bersih = subtotal dikurangi diskon, tanpa ongkir
 *
 * Laba kotor dihitung dari penjualan_bersih dikurangi HPP, bukan dari omzet.
 * Ongkir adalah penggantian biaya angkut, bukan hasil dagang; memasukkannya
 * akan menaikkan margin setiap kali ada pengiriman jauh, padahal barangnya
 * dijual dengan margin yang sama.
 */
async function ringkasPenjualan(mulai: string, selesai: string) {
  const r = await db.satu<any>(
    `SELECT
       COUNT(*)::int                                  AS jumlah_order,
       COALESCE(SUM(o.total), 0)                      AS omzet,
       COALESCE(SUM(o.subtotal - o.diskon), 0)        AS penjualan_bersih,
       COALESCE(SUM(o.hpp_total), 0)                  AS hpp,
       COALESCE(SUM(o.diskon), 0)                     AS total_diskon,
       COALESCE(SUM(o.ongkir), 0)                     AS total_ongkir,
       COUNT(DISTINCT o.customer_id)::int             AS customer_aktif
     FROM pesanan o
     WHERE o.tanggal BETWEEN $1::date AND $2::date AND o.status_kirim <> 'batal'`,
    [mulai, selesai]
  );
  const omzet = n(r.omzet);
  const bersih = n(r.penjualan_bersih);
  const labaKotor = bersih - n(r.hpp);
  return {
    jumlah_order: r.jumlah_order,
    omzet,
    penjualan_bersih: bersih,
    hpp: n(r.hpp),
    total_diskon: n(r.total_diskon),
    total_ongkir: n(r.total_ongkir),
    customer_aktif: r.customer_aktif,
    laba_kotor: labaKotor,
    margin: bersih > 0 ? Math.round((labaKotor / bersih) * 1000) / 10 : 0,
    rata_order: r.jumlah_order > 0 ? Math.round(omzet / r.jumlah_order) : 0,
  };
}

async function ringkasPembelian(mulai: string, selesai: string) {
  const r = await db.satu<any>(
    `SELECT COUNT(*)::int AS jumlah_po, COALESCE(SUM(total),0) AS nilai_pembelian,
            COUNT(DISTINCT supplier_id)::int AS jumlah_supplier
     FROM pembelian WHERE tanggal BETWEEN $1::date AND $2::date AND status <> 'batal'`,
    [mulai, selesai]
  );
  return { jumlah_po: r.jumlah_po, nilai_pembelian: n(r.nilai_pembelian), jumlah_supplier: r.jumlah_supplier };
}

const bacaPeriode = (q: any) =>
  rentangPeriode(String(q.periode ?? 'harian'), String(q.acuan ?? hariIni()), q.dari, q.sampai);

const tumbuh = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

/* --------------------------------------------------------------- Dashboard */

rutLaporan.get(
  '/dashboard',
  wajibPeran(...STAF),
  bungkus(async (req, res) => {
    const p = bacaPeriode(req.query);

    /* Angka tanpa pembanding tidak bisa dinilai. Ketika periode yang diminta
       masih berjalan, pembandingnya dipotong pada jumlah hari yang sama:
       sembilan belas hari September dibanding tiga puluh satu hari Agustus
       selalu menghasilkan penurunan besar, dan itu memberi sinyal salah setiap
       kali bulan berjalan dibuka — yang berarti hampir sepanjang waktu. */
    const lalu = periodeSebelumnya(String(req.query.periode ?? 'harian'), p);
    const masihBerjalan = p.selesai > hariIni();
    if (masihBerjalan) {
      const hariBerjalan =
        Math.round((Date.parse(hariIni()) - Date.parse(p.mulai)) / 86400000) + 1;
      const batas = new Date(Date.parse(lalu.mulai) + (hariBerjalan - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
      if (batas < lalu.selesai) lalu.selesai = batas;
    }

    const akhirTren = p.selesai > hariIni() ? hariIni() : p.selesai;

    const [jual, beli, jualLalu, beliLalu, nilaiStokBaris, tren, topProduk, stokSemua, aktivitas, absensi, kirimJalan, saran] =
      await Promise.all([
        ringkasPenjualan(p.mulai, p.selesai),
        ringkasPembelian(p.mulai, p.selesai),
        ringkasPenjualan(lalu.mulai, lalu.selesai),
        ringkasPembelian(lalu.mulai, lalu.selesai),
        db.satu<any>('SELECT COALESCE(SUM(stok::bigint * harga_beli),0) AS nilai FROM produk WHERE aktif = true'),
        db.banyak<any>(
          `SELECT o.tanggal, COALESCE(SUM(o.total),0) AS omzet,
                  COALESCE(SUM(o.subtotal - o.diskon - o.hpp_total),0) AS laba, COUNT(*)::int AS jumlah_order
           FROM pesanan o
           WHERE o.tanggal BETWEEN ($1::date - INTERVAL '13 days') AND $1::date AND o.status_kirim <> 'batal'
           GROUP BY o.tanggal ORDER BY o.tanggal`,
          [akhirTren]
        ),
        db.banyak<any>(
          `SELECT p.id, p.nama, p.satuan, SUM(i.qty)::int AS qty,
                  SUM(i.subtotal) AS revenue, SUM(i.qty * (i.harga - i.harga_beli)) AS laba
           FROM pesanan_item i JOIN pesanan o ON o.id = i.pesanan_id JOIN produk p ON p.id = i.produk_id
           WHERE o.tanggal BETWEEN $1::date AND $2::date AND o.status_kirim <> 'batal'
           GROUP BY p.id ORDER BY qty DESC LIMIT 5`,
          [p.mulai, p.selesai]
        ),
        db.banyak<any>('SELECT id, nama, satuan, stok, stok_minimum FROM produk WHERE aktif = true'),
        db.banyak<any>(
          `SELECT a.id, a.jenis, a.waktu, k.nama, k.jabatan
           FROM aktivitas a JOIN karyawan k ON k.id = a.karyawan_id
           WHERE a.waktu::date = $1::date ORDER BY a.waktu DESC LIMIT 10`,
          [hariIni()]
        ),
        db.satu<any>(
          `SELECT (SELECT COUNT(*)::int FROM karyawan WHERE status = 'aktif') AS total_karyawan,
                  (SELECT COUNT(*)::int FROM absensi WHERE tanggal = $1::date) AS hadir,
                  (SELECT COUNT(*)::int FROM absensi WHERE tanggal = $1::date AND status = 'terlambat') AS terlambat`,
          [hariIni()]
        ),
        db.satu<any>(`SELECT COUNT(*)::int AS n FROM pengiriman WHERE status NOT IN ('selesai','gagal')`),
        hitungSaranKulakan({ hanyaPerlu: true }),
      ]);

    const stok = stokSemua.map((s) => ({ ...s, status_stok: statusStok(s.stok, s.stok_minimum) }));
    const peringatanStok = stok
      .filter((s) => s.status_stok === 'critical' || s.status_stok === 'low')
      .sort((a, b) => (a.status_stok === b.status_stok ? a.stok - b.stok : a.status_stok === 'critical' ? -1 : 1))
      .slice(0, 8);

    res.json({
      periode: p,
      pembanding: { ...lalu, sebagian: masihBerjalan, omzet: jualLalu.omzet, laba_kotor: jualLalu.laba_kotor, jumlah_order: jualLalu.jumlah_order, nilai_pembelian: beliLalu.nilai_pembelian },
      pertumbuhan: {
        omzet: tumbuh(jual.omzet, jualLalu.omzet),
        laba_kotor: tumbuh(jual.laba_kotor, jualLalu.laba_kotor),
        jumlah_order: tumbuh(jual.jumlah_order, jualLalu.jumlah_order),
        nilai_pembelian: tumbuh(beli.nilai_pembelian, beliLalu.nilai_pembelian),
      },
      kpi: {
        ...jual,
        nilai_pembelian: beli.nilai_pembelian,
        jumlah_po: beli.jumlah_po,
        nilai_stok: n(nilaiStokBaris.nilai),
        pengiriman_berjalan: kirimJalan.n,
      },
      tren: tren.map((t) => ({ tanggal: t.tanggal, omzet: n(t.omzet), laba: n(t.laba), jumlah_order: t.jumlah_order })),
      top_produk: topProduk.map((t) => ({ ...t, revenue: n(t.revenue), laba: n(t.laba) })),
      peringatan_stok: peringatanStok,
      ringkas_stok: {
        critical: stok.filter((s) => s.status_stok === 'critical').length,
        low: stok.filter((s) => s.status_stok === 'low').length,
        normal: stok.filter((s) => s.status_stok === 'normal').length,
        overstock: stok.filter((s) => s.status_stok === 'overstock').length,
      },
      absensi,
      aktivitas,
      saran_kulakan: saran.slice(0, 5),
    });
  })
);

/* ------------------------------------------------------- Rekap per periode */

rutLaporan.get(
  '/ringkas',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const p = bacaPeriode(req.query);
    const [jual, beli, item, stok, karyawan, pengiriman] = await Promise.all([
      ringkasPenjualan(p.mulai, p.selesai),
      ringkasPembelian(p.mulai, p.selesai),
      db.satu<any>(
        `SELECT COALESCE(SUM(i.qty),0)::int AS n FROM pesanan_item i JOIN pesanan o ON o.id = i.pesanan_id
         WHERE o.tanggal BETWEEN $1::date AND $2::date AND o.status_kirim <> 'batal'`,
        [p.mulai, p.selesai]
      ),
      db.satu<any>(
        `SELECT
           COALESCE(SUM(CASE WHEN tipe = 'masuk' THEN qty ELSE 0 END), 0)::int      AS masuk,
           COALESCE(SUM(CASE WHEN tipe = 'keluar' THEN -qty ELSE 0 END), 0)::int    AS keluar,
           COALESCE(SUM(CASE WHEN tipe = 'adjustment' THEN qty ELSE 0 END), 0)::int AS adjustment
         FROM mutasi_stok WHERE waktu::date BETWEEN $1::date AND $2::date`,
        [p.mulai, p.selesai]
      ),
      db.satu<any>(
        `SELECT
           (SELECT COUNT(*)::int FROM karyawan WHERE status = 'aktif') AS total,
           (SELECT COUNT(DISTINCT karyawan_id)::int FROM absensi WHERE tanggal BETWEEN $1::date AND $2::date) AS pernah_hadir,
           (SELECT COUNT(*)::int FROM absensi WHERE tanggal BETWEEN $1::date AND $2::date) AS hari_hadir,
           (SELECT COUNT(*)::int FROM absensi WHERE tanggal BETWEEN $1::date AND $2::date AND status = 'terlambat') AS terlambat,
           (SELECT COUNT(*)::int FROM aktivitas WHERE waktu::date BETWEEN $1::date AND $2::date) AS jumlah_aktivitas`,
        [p.mulai, p.selesai]
      ),
      db.satu<any>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'selesai')::int AS selesai,
                COUNT(*) FILTER (WHERE status = 'gagal')::int   AS gagal
         FROM pengiriman WHERE dibuat_pada::date BETWEEN $1::date AND $2::date`,
        [p.mulai, p.selesai]
      ),
    ]);

    res.json({ periode: p, penjualan: { ...jual, total_item: item.n }, pembelian: beli, stok, karyawan, pengiriman });
  })
);

/* -------------------------------------------------------- Laporan per produk */

rutLaporan.get(
  '/produk',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const p = bacaPeriode(req.query);
    const baris = await db.banyak<any>(
      `SELECT p.id, p.sku, p.nama, p.satuan, k.nama AS kategori,
              SUM(i.qty)::int AS qty, SUM(i.subtotal) AS revenue,
              SUM(i.qty * i.harga_beli) AS hpp,
              SUM(i.qty * (i.harga - i.harga_beli)) AS laba_kotor,
              p.stok AS stok_sekarang
       FROM pesanan_item i
       JOIN pesanan o ON o.id = i.pesanan_id
       JOIN produk p ON p.id = i.produk_id
       LEFT JOIN kategori k ON k.id = p.kategori_id
       WHERE o.tanggal BETWEEN $1::date AND $2::date AND o.status_kirim <> 'batal'
       GROUP BY p.id, k.nama ORDER BY revenue DESC`,
      [p.mulai, p.selesai]
    );
    res.json({
      periode: p,
      baris: baris.map((r) => {
        const revenue = n(r.revenue);
        const laba = n(r.laba_kotor);
        return { ...r, revenue, hpp: n(r.hpp), laba_kotor: laba, margin: revenue > 0 ? Math.round((laba / revenue) * 1000) / 10 : 0 };
      }),
    });
  })
);

/* ------------------------------------------------------- Laporan per karyawan */

rutLaporan.get(
  '/karyawan',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const p = bacaPeriode(req.query);
    /* Setiap sumber diagregasi sekali lalu digabungkan, bukan sembilan subkueri
       berkorelasi untuk tiap karyawan. Bentuk lama menjalankan sembilan kali
       jumlah-karyawan kueri pada setiap kali halaman dibuka. */
    const baris = await db.banyak<any>(
      `WITH hadir AS (
         SELECT karyawan_id, COUNT(*)::int AS hadir,
                COUNT(*) FILTER (WHERE status = 'terlambat')::int AS terlambat
         FROM absensi WHERE tanggal BETWEEN $1::date AND $2::date GROUP BY karyawan_id
       ), akt AS (
         SELECT karyawan_id, COUNT(*)::int AS aktivitas
         FROM aktivitas WHERE waktu::date BETWEEN $1::date AND $2::date GROUP BY karyawan_id
       ), kirim AS (
         SELECT driver_id,
                COUNT(*)::int AS delivery,
                COUNT(*) FILTER (WHERE status = 'selesai')::int AS delivery_selesai,
                COUNT(*) FILTER (WHERE status = 'gagal')::int   AS delivery_gagal,
                COALESCE(AVG(EXTRACT(EPOCH FROM (selesai_pada - dimulai_pada)) / 60)
                         FILTER (WHERE status = 'selesai' AND dimulai_pada IS NOT NULL), 0) AS rata_menit
         FROM pengiriman WHERE dibuat_pada::date BETWEEN $1::date AND $2::date GROUP BY driver_id
       ), jual AS (
         SELECT sales_id, COUNT(*)::int AS order_dibawa, COALESCE(SUM(total),0) AS omzet
         FROM pesanan WHERE tanggal BETWEEN $1::date AND $2::date AND status_kirim <> 'batal'
         GROUP BY sales_id
       )
       SELECT k.id, k.nama, k.jabatan,
              COALESCE(h.hadir,0) AS hadir, COALESCE(h.terlambat,0) AS terlambat,
              COALESCE(a.aktivitas,0) AS aktivitas,
              COALESCE(d.delivery,0) AS delivery,
              COALESCE(d.delivery_selesai,0) AS delivery_selesai,
              COALESCE(d.delivery_gagal,0) AS delivery_gagal,
              COALESCE(d.rata_menit,0) AS rata_menit_delivery,
              COALESCE(j.order_dibawa,0) AS order_dibawa,
              COALESCE(j.omzet,0) AS omzet
       FROM karyawan k
       LEFT JOIN hadir h ON h.karyawan_id = k.id
       LEFT JOIN akt   a ON a.karyawan_id = k.id
       LEFT JOIN kirim d ON d.driver_id  = k.id
       LEFT JOIN jual  j ON j.sales_id   = k.id
       WHERE k.status = 'aktif' ORDER BY k.nama`,
      [p.mulai, p.selesai]
    );
    res.json({
      periode: p,
      baris: baris.map((r) => ({ ...r, omzet: n(r.omzet), rata_menit_delivery: Math.round(Number(r.rata_menit_delivery)) })),
    });
  })
);

/* -------------------------------------------------------- Laporan kulakan */

rutLaporan.get(
  '/kulakan',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const p = bacaPeriode(req.query);
    const baris = await db.banyak<any>(
      `WITH terjual AS (
         SELECT i.produk_id, SUM(i.qty)::int AS qty
         FROM pesanan_item i JOIN pesanan o ON o.id = i.pesanan_id
         WHERE o.tanggal BETWEEN $1::date AND $2::date AND o.status_kirim <> 'batal'
         GROUP BY i.produk_id
       )
       SELECT p.id, p.sku, p.nama, p.satuan,
              SUM(bi.qty)::int AS qty_dipesan, SUM(bi.qty_diterima)::int AS qty_diterima,
              SUM(bi.qty_diterima::bigint * bi.harga) AS nilai_pembelian,
              ROUND(AVG(bi.harga))::bigint AS harga_rata,
              COUNT(DISTINCT b.supplier_id)::int AS jumlah_supplier,
              p.stok AS stok_sekarang,
              COALESCE(t.qty, 0) AS qty_terjual
       FROM pembelian_item bi
       JOIN pembelian b ON b.id = bi.pembelian_id
       JOIN produk p ON p.id = bi.produk_id
       LEFT JOIN terjual t ON t.produk_id = p.id
       WHERE b.tanggal BETWEEN $1::date AND $2::date AND b.status <> 'batal'
       GROUP BY p.id, t.qty ORDER BY nilai_pembelian DESC`,
      [p.mulai, p.selesai]
    );
    res.json({ periode: p, baris: baris.map((r) => ({ ...r, nilai_pembelian: n(r.nilai_pembelian), harga_rata: n(r.harga_rata) })) });
  })
);

/* ------------------------------------------------ Tren bulanan & perbandingan */

/** Dua belas bulan dalam satu tahun, termasuk bulan yang tidak ada transaksinya. */
rutLaporan.get(
  '/tren-bulanan',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const tahun = Math.round(angka(req.query.tahun, new Date().getFullYear()));
    const [jualBulan, beliBulan] = await Promise.all([
      db.banyak<any>(
        `SELECT EXTRACT(MONTH FROM o.tanggal)::int AS bulan,
                COALESCE(SUM(o.total),0) AS omzet,
                COALESCE(SUM(o.subtotal - o.diskon - o.hpp_total),0) AS laba_kotor,
                COUNT(*)::int AS jumlah_order
         FROM pesanan o WHERE EXTRACT(YEAR FROM o.tanggal) = $1 AND o.status_kirim <> 'batal'
         GROUP BY bulan`,
        [tahun]
      ),
      db.banyak<any>(
        `SELECT EXTRACT(MONTH FROM tanggal)::int AS bulan, COALESCE(SUM(total),0) AS pembelian
         FROM pembelian WHERE EXTRACT(YEAR FROM tanggal) = $1 AND status <> 'batal' GROUP BY bulan`,
        [tahun]
      ),
    ]);

    const NAMA = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    res.json({
      tahun: String(tahun),
      baris: NAMA.map((nama, i) => {
        const j = jualBulan.find((b) => b.bulan === i + 1);
        const b = beliBulan.find((x) => x.bulan === i + 1);
        return {
          bulan: nama,
          omzet: n(j?.omzet),
          laba_kotor: n(j?.laba_kotor),
          jumlah_order: j?.jumlah_order ?? 0,
          pembelian: n(b?.pembelian),
        };
      }),
    });
  })
);

/**
 * Perbandingan tahun berjalan dengan tahun sebelumnya.
 *
 * Untuk tahun yang masih berjalan, kedua sisi dipotong pada tanggal yang sama:
 * Januari sampai hari ini, dibanding Januari sampai tanggal yang sama tahun
 * lalu. Membandingkan sembilan bulan berjalan dengan dua belas bulan penuh
 * selalu menghasilkan angka pertumbuhan negatif, dan itu membuat laporan
 * memberi sinyal yang salah justru pada tahun yang sedang tumbuh.
 */
rutLaporan.get(
  '/yoy',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const tahun = Math.round(angka(req.query.tahun, new Date().getFullYear()));
    const tahunBerjalan = tahun === new Date().getFullYear();
    const potong = tahunBerjalan ? hariIni().slice(5) : '12-31';

    const ambil = async (t: number) => {
      const mulai = `${t}-01-01`;
      const selesai = `${t}-${potong}`;
      const [jual, beli, qty] = await Promise.all([
        ringkasPenjualan(mulai, selesai),
        ringkasPembelian(mulai, selesai),
        db.satu<any>(
          `SELECT COALESCE(SUM(i.qty),0)::int AS n FROM pesanan_item i JOIN pesanan o ON o.id = i.pesanan_id
           WHERE o.tanggal BETWEEN $1::date AND $2::date AND o.status_kirim <> 'batal'`,
          [mulai, selesai]
        ),
      ]);
      return { tahun: t, mulai, selesai, ...jual, nilai_pembelian: beli.nilai_pembelian, qty_terjual: qty.n };
    };

    const [ini, lalu] = await Promise.all([ambil(tahun), ambil(tahun - 1)]);

    res.json({
      ini,
      lalu,
      sebagian_tahun: tahunBerjalan,
      pertumbuhan: {
        omzet: tumbuh(ini.omzet, lalu.omzet),
        laba_kotor: tumbuh(ini.laba_kotor, lalu.laba_kotor),
        jumlah_order: tumbuh(ini.jumlah_order, lalu.jumlah_order),
        customer_aktif: tumbuh(ini.customer_aktif, lalu.customer_aktif),
        qty_terjual: tumbuh(ini.qty_terjual, lalu.qty_terjual),
        nilai_pembelian: tumbuh(ini.nilai_pembelian, lalu.nilai_pembelian),
        rata_order: tumbuh(ini.rata_order, lalu.rata_order),
      },
    });
  })
);

/* ----------------------------------------------------------------- Audit log */

rutLaporan.get(
  '/audit',
  wajibPeran('owner', 'admin'),
  bungkus(async (req, res) => {
    const { entitas, dari, sampai } = req.query as Record<string, string>;
    /* nilai_lama dan nilai_baru tidak ikut daftar: keduanya hanya dibaca saat
       satu baris dibuka, sementara ukurannya jauh melebihi kolom lain. */
    res.json(
      await db.banyak(
        `SELECT id, user_id, nama_user, aksi, entitas, entitas_id, ringkasan, waktu
         FROM audit_log
         WHERE ($1::text IS NULL OR entitas = $1)
           AND ($2::date IS NULL OR waktu::date >= $2::date)
           AND ($3::date IS NULL OR waktu::date <= $3::date)
         ORDER BY waktu DESC, id DESC LIMIT $4`,
        [entitas ?? null, dari ?? null, sampai ?? null, Math.min(300, Math.max(1, Math.round(angka(req.query.batas, 100))))]
      )
    );
  })
);
