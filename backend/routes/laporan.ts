import { Router } from 'express';
import { db } from '../db.js';
import { wajibMasuk, wajibPeran } from '../auth.js';
import { statusStok } from '../stok.js';
import { hitungSaranKulakan } from '../kulakan-cerdas.js';
import { hariIni, periodeSebelumnya, rentangPeriode } from '../util.js';
import { bungkus } from '../http.js';

export const rutLaporan = Router();
rutLaporan.use(wajibMasuk);

/**
 * Angka pendapatan dipisah dua, dan keduanya selalu dikembalikan bersama.
 *
 *   omzet           = seluruh yang ditagihkan ke customer, termasuk ongkir
 *   penjualan_bersih = subtotal dikurangi diskon, tanpa ongkir
 *
 * Laba kotor dihitung dari penjualan_bersih dikurangi HPP, bukan dari omzet.
 * Ongkir adalah penggantian biaya angkut, bukan hasil dagang; memasukkannya
 * akan menaikkan margin setiap kali ada pengiriman jauh, padahal barangnya
 * dijual dengan margin yang sama.
 */
const SQL_RINGKAS_JUAL = `
  SELECT
    COUNT(*)                                        AS jumlah_order,
    COALESCE(SUM(o.total), 0)                       AS omzet,
    COALESCE(SUM(o.subtotal - o.diskon), 0)         AS penjualan_bersih,
    COALESCE(SUM(o.hpp_total), 0)                   AS hpp,
    COALESCE(SUM(o.diskon), 0)                      AS total_diskon,
    COALESCE(SUM(o.ongkir), 0)                      AS total_ongkir,
    COUNT(DISTINCT o.customer_id)                   AS customer_aktif
  FROM pesanan o
  WHERE o.tanggal BETWEEN ? AND ? AND o.status_kirim <> 'batal'
`;

function ringkasPenjualan(mulai: string, selesai: string) {
  const r = db.prepare(SQL_RINGKAS_JUAL).get(mulai, selesai) as any;
  const labaKotor = r.penjualan_bersih - r.hpp;
  return {
    ...r,
    laba_kotor: labaKotor,
    margin: r.penjualan_bersih > 0 ? Math.round((labaKotor / r.penjualan_bersih) * 1000) / 10 : 0,
    rata_order: r.jumlah_order > 0 ? Math.round(r.omzet / r.jumlah_order) : 0,
  };
}

function ringkasPembelian(mulai: string, selesai: string) {
  return db
    .prepare(
      `SELECT COUNT(*) AS jumlah_po, COALESCE(SUM(total),0) AS nilai_pembelian,
              COUNT(DISTINCT supplier_id) AS jumlah_supplier
       FROM pembelian WHERE tanggal BETWEEN ? AND ? AND status <> 'batal'`
    )
    .get(mulai, selesai) as any;
}

function bacaPeriode(q: any) {
  return rentangPeriode(String(q.periode ?? 'harian'), String(q.acuan ?? hariIni()), q.dari, q.sampai);
}

/* --------------------------------------------------------------- Dashboard */

rutLaporan.get('/dashboard', (req, res) => {
  const p = bacaPeriode(req.query);
  const jual = ringkasPenjualan(p.mulai, p.selesai);
  const beli = ringkasPembelian(p.mulai, p.selesai);

  /* Angka tanpa pembanding tidak bisa dinilai. Rp731 juta bulan ini hanya
     berarti sesuatu bila diketahui bulan lalu berapa, jadi periode sebelumnya
     ikut dihitung dan selisihnya dikirim bersama angkanya.
 
     Ketika periode yang diminta masih berjalan, pembandingnya dipotong pada
     jumlah hari yang sama. Sembilan belas hari September dibanding tiga puluh
     satu hari Agustus selalu menghasilkan penurunan besar, dan itu memberi
     sinyal salah setiap kali bulan berjalan dibuka — yang berarti hampir
     sepanjang waktu. */
  const lalu = periodeSebelumnya(String(req.query.periode ?? 'harian'), p);
  const masihBerjalan = p.selesai > hariIni();
  if (masihBerjalan) {
    const hariBerjalan =
      Math.round((new Date(hariIni() + 'T00:00:00').getTime() - new Date(p.mulai + 'T00:00:00').getTime()) / 86400000) + 1;
    const potong = new Date(lalu.mulai + 'T00:00:00');
    potong.setDate(potong.getDate() + hariBerjalan - 1);
    const batas = potong.toLocaleDateString('sv-SE');
    if (batas < lalu.selesai) lalu.selesai = batas;
  }

  const jualLalu = ringkasPenjualan(lalu.mulai, lalu.selesai);
  const beliLalu = ringkasPembelian(lalu.mulai, lalu.selesai);
  const tumbuh = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

  const nilaiStok = (db.prepare('SELECT COALESCE(SUM(stok * harga_beli),0) AS n FROM produk WHERE aktif = 1').get() as any).n;

  /* Tren 14 hari terakhir, dihitung mundur dari akhir periode tetapi tidak
     pernah melewati hari ini. Periode bulan berjalan berakhir di tanggal 30,
     dan mengambil jendela dari sana akan menyisakan grafik berisi dua tiga
     titik karena sisanya hari yang belum terjadi. */
  const akhirTren = p.selesai > hariIni() ? hariIni() : p.selesai;

  const tren = db
    .prepare(
      `SELECT o.tanggal, COALESCE(SUM(o.total),0) AS omzet,
              COALESCE(SUM(o.subtotal - o.diskon - o.hpp_total),0) AS laba, COUNT(*) AS jumlah_order
       FROM pesanan o
       WHERE o.tanggal BETWEEN date(?, '-13 days') AND ? AND o.status_kirim <> 'batal'
       GROUP BY o.tanggal ORDER BY o.tanggal`
    )
    .all(akhirTren, akhirTren);

  const topProduk = db
    .prepare(
      `SELECT p.id, p.nama, p.satuan, SUM(i.qty) AS qty,
              SUM(i.subtotal) AS revenue, SUM(i.qty * (i.harga - i.harga_beli)) AS laba
       FROM pesanan_item i JOIN pesanan o ON o.id = i.pesanan_id JOIN produk p ON p.id = i.produk_id
       WHERE o.tanggal BETWEEN ? AND ? AND o.status_kirim <> 'batal'
       GROUP BY p.id ORDER BY qty DESC LIMIT 5`
    )
    .all(p.mulai, p.selesai);

  const stok = (db
    .prepare('SELECT id, nama, satuan, stok, stok_minimum FROM produk WHERE aktif = 1')
    .all() as any[]).map((s) => ({ ...s, status_stok: statusStok(s.stok, s.stok_minimum) }));

  const peringatanStok = stok
    .filter((s) => s.status_stok === 'critical' || s.status_stok === 'low')
    .sort((a, b) => (a.status_stok === b.status_stok ? a.stok - b.stok : a.status_stok === 'critical' ? -1 : 1))
    .slice(0, 8);

  const aktivitasTerbaru = db
    .prepare(
      `SELECT a.id, a.jenis, a.waktu, a.catatan, k.nama, k.jabatan
       FROM aktivitas a JOIN karyawan k ON k.id = a.karyawan_id
       WHERE date(a.waktu) = ? ORDER BY a.waktu DESC LIMIT 10`
    )
    .all(hariIni());

  const absensiHariIni = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM karyawan WHERE status = 'aktif') AS total_karyawan,
         (SELECT COUNT(*) FROM absensi WHERE tanggal = ?) AS hadir,
         (SELECT COUNT(*) FROM absensi WHERE tanggal = ? AND status = 'terlambat') AS terlambat`
    )
    .get(hariIni(), hariIni()) as any;

  const pengirimanBerjalan = (db
    .prepare(`SELECT COUNT(*) AS n FROM pengiriman WHERE status NOT IN ('selesai','gagal')`)
    .get() as any).n;

  res.json({
    periode: p,
    pembanding: {
      ...lalu,
      sebagian: masihBerjalan,
      omzet: jualLalu.omzet,
      laba_kotor: jualLalu.laba_kotor,
      jumlah_order: jualLalu.jumlah_order,
      nilai_pembelian: beliLalu.nilai_pembelian,
    },
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
      nilai_stok: nilaiStok,
      pengiriman_berjalan: pengirimanBerjalan,
    },
    tren,
    top_produk: topProduk,
    peringatan_stok: peringatanStok,
    ringkas_stok: {
      critical: stok.filter((s) => s.status_stok === 'critical').length,
      low: stok.filter((s) => s.status_stok === 'low').length,
      normal: stok.filter((s) => s.status_stok === 'normal').length,
      overstock: stok.filter((s) => s.status_stok === 'overstock').length,
    },
    absensi: absensiHariIni,
    aktivitas: aktivitasTerbaru,
    saran_kulakan: hitungSaranKulakan({ hanyaPerlu: true }).slice(0, 5),
  });
});

/* ------------------------------------------------------- Rekap per periode */

rutLaporan.get('/ringkas', (req, res) => {
  const p = bacaPeriode(req.query);
  const jual = ringkasPenjualan(p.mulai, p.selesai);
  const beli = ringkasPembelian(p.mulai, p.selesai);

  const totalItem = (db
    .prepare(
      `SELECT COALESCE(SUM(i.qty),0) AS n FROM pesanan_item i JOIN pesanan o ON o.id = i.pesanan_id
       WHERE o.tanggal BETWEEN ? AND ? AND o.status_kirim <> 'batal'`
    )
    .get(p.mulai, p.selesai) as any).n;

  /* Stok awal periode diambil dari saldo mutasi terakhir sebelum tanggal
     mulai, bukan dari stok sekarang dikurangi mutasi — cara kedua salah untuk
     produk yang baru dibuat di tengah periode. */
  const stok = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tipe = 'masuk' THEN qty ELSE 0 END), 0)        AS masuk,
         COALESCE(SUM(CASE WHEN tipe = 'keluar' THEN -qty ELSE 0 END), 0)      AS keluar,
         COALESCE(SUM(CASE WHEN tipe = 'adjustment' THEN qty ELSE 0 END), 0)   AS adjustment
       FROM mutasi_stok WHERE date(waktu) BETWEEN ? AND ?`
    )
    .get(p.mulai, p.selesai) as any;

  const karyawan = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM karyawan WHERE status = 'aktif') AS total,
         (SELECT COUNT(DISTINCT karyawan_id) FROM absensi WHERE tanggal BETWEEN ? AND ?) AS pernah_hadir,
         (SELECT COUNT(*) FROM absensi WHERE tanggal BETWEEN ? AND ?) AS hari_hadir,
         (SELECT COUNT(*) FROM absensi WHERE tanggal BETWEEN ? AND ? AND status = 'terlambat') AS terlambat,
         (SELECT COUNT(*) FROM aktivitas WHERE date(waktu) BETWEEN ? AND ?) AS jumlah_aktivitas`
    )
    .get(p.mulai, p.selesai, p.mulai, p.selesai, p.mulai, p.selesai, p.mulai, p.selesai) as any;

  const pengiriman = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS selesai,
              SUM(CASE WHEN status = 'gagal' THEN 1 ELSE 0 END)   AS gagal
       FROM pengiriman WHERE date(dibuat_pada) BETWEEN ? AND ?`
    )
    .get(p.mulai, p.selesai) as any;

  res.json({ periode: p, penjualan: { ...jual, total_item: totalItem }, pembelian: beli, stok, karyawan, pengiriman });
});

/* -------------------------------------------------------- Laporan per produk */

rutLaporan.get('/produk', (req, res) => {
  const p = bacaPeriode(req.query);
  res.json({
    periode: p,
    baris: db
      .prepare(
        `SELECT p.id, p.sku, p.nama, p.satuan, k.nama AS kategori,
                SUM(i.qty) AS qty, SUM(i.subtotal) AS revenue,
                SUM(i.qty * i.harga_beli) AS hpp,
                SUM(i.qty * (i.harga - i.harga_beli)) AS laba_kotor,
                p.stok AS stok_sekarang
         FROM pesanan_item i
         JOIN pesanan o ON o.id = i.pesanan_id
         JOIN produk p ON p.id = i.produk_id
         LEFT JOIN kategori k ON k.id = p.kategori_id
         WHERE o.tanggal BETWEEN ? AND ? AND o.status_kirim <> 'batal'
         GROUP BY p.id ORDER BY revenue DESC`
      )
      .all(p.mulai, p.selesai)
      .map((r: any) => ({ ...r, margin: r.revenue > 0 ? Math.round((r.laba_kotor / r.revenue) * 1000) / 10 : 0 })),
  });
});

/* ------------------------------------------------------- Laporan per karyawan */

rutLaporan.get('/karyawan', wajibPeran('owner', 'admin'), (req, res) => {
  const p = bacaPeriode(req.query);
  res.json({
    periode: p,
    baris: db
      .prepare(
        `SELECT k.id, k.nama, k.jabatan,
           (SELECT COUNT(*) FROM absensi a WHERE a.karyawan_id = k.id AND a.tanggal BETWEEN ? AND ?) AS hadir,
           (SELECT COUNT(*) FROM absensi a WHERE a.karyawan_id = k.id AND a.tanggal BETWEEN ? AND ? AND a.status = 'terlambat') AS terlambat,
           (SELECT COUNT(*) FROM aktivitas x WHERE x.karyawan_id = k.id AND date(x.waktu) BETWEEN ? AND ?) AS aktivitas,
           (SELECT COUNT(*) FROM pengiriman g WHERE g.driver_id = k.id AND date(g.dibuat_pada) BETWEEN ? AND ?) AS delivery,
           (SELECT COUNT(*) FROM pengiriman g WHERE g.driver_id = k.id AND g.status = 'selesai' AND date(g.dibuat_pada) BETWEEN ? AND ?) AS delivery_selesai,
           (SELECT COUNT(*) FROM pengiriman g WHERE g.driver_id = k.id AND g.status = 'gagal' AND date(g.dibuat_pada) BETWEEN ? AND ?) AS delivery_gagal,
           (SELECT COUNT(*) FROM pesanan o WHERE o.sales_id = k.id AND o.tanggal BETWEEN ? AND ? AND o.status_kirim <> 'batal') AS order_dibawa,
           (SELECT COALESCE(SUM(o.total),0) FROM pesanan o WHERE o.sales_id = k.id AND o.tanggal BETWEEN ? AND ? AND o.status_kirim <> 'batal') AS omzet,
           (SELECT COALESCE(AVG(julianday(g.selesai_pada) - julianday(g.dimulai_pada)) * 24 * 60, 0)
              FROM pengiriman g WHERE g.driver_id = k.id AND g.status = 'selesai'
                AND g.dimulai_pada IS NOT NULL AND date(g.dibuat_pada) BETWEEN ? AND ?) AS rata_menit_delivery
         FROM karyawan k WHERE k.status = 'aktif' ORDER BY k.nama`
      )
      .all(
        p.mulai, p.selesai, p.mulai, p.selesai, p.mulai, p.selesai, p.mulai, p.selesai,
        p.mulai, p.selesai, p.mulai, p.selesai, p.mulai, p.selesai, p.mulai, p.selesai, p.mulai, p.selesai
      )
      .map((r: any) => ({ ...r, rata_menit_delivery: Math.round(r.rata_menit_delivery) })),
  });
});

/* -------------------------------------------------------- Laporan kulakan */

rutLaporan.get('/kulakan', (req, res) => {
  const p = bacaPeriode(req.query);
  res.json({
    periode: p,
    baris: db
      .prepare(
        `SELECT p.id, p.sku, p.nama, p.satuan,
                SUM(bi.qty) AS qty_dipesan, SUM(bi.qty_diterima) AS qty_diterima,
                SUM(bi.qty_diterima * bi.harga) AS nilai_pembelian,
                CAST(AVG(bi.harga) AS INTEGER) AS harga_rata,
                COUNT(DISTINCT b.supplier_id) AS jumlah_supplier,
                p.stok AS stok_sekarang,
                COALESCE((SELECT SUM(i.qty) FROM pesanan_item i JOIN pesanan o ON o.id = i.pesanan_id
                          WHERE i.produk_id = p.id AND o.tanggal BETWEEN ? AND ? AND o.status_kirim <> 'batal'), 0) AS qty_terjual
         FROM pembelian_item bi
         JOIN pembelian b ON b.id = bi.pembelian_id
         JOIN produk p ON p.id = bi.produk_id
         WHERE b.tanggal BETWEEN ? AND ? AND b.status <> 'batal'
         GROUP BY p.id ORDER BY nilai_pembelian DESC`
      )
      .all(p.mulai, p.selesai, p.mulai, p.selesai),
  });
});

/* ------------------------------------------------ Tren bulanan & perbandingan */

/** Dua belas bulan dalam satu tahun, termasuk bulan yang tidak ada transaksinya. */
rutLaporan.get('/tren-bulanan', (req, res) => {
  const tahun = String(req.query.tahun ?? new Date().getFullYear());
  const baris = db
    .prepare(
      `SELECT strftime('%m', o.tanggal) AS bulan,
              COALESCE(SUM(o.total),0) AS omzet,
              COALESCE(SUM(o.subtotal - o.diskon - o.hpp_total),0) AS laba_kotor,
              COUNT(*) AS jumlah_order
       FROM pesanan o WHERE strftime('%Y', o.tanggal) = ? AND o.status_kirim <> 'batal'
       GROUP BY bulan`
    )
    .all(tahun) as any[];

  const pembelian = db
    .prepare(
      `SELECT strftime('%m', tanggal) AS bulan, COALESCE(SUM(total),0) AS pembelian
       FROM pembelian WHERE strftime('%Y', tanggal) = ? AND status <> 'batal' GROUP BY bulan`
    )
    .all(tahun) as any[];

  const NAMA = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  res.json({
    tahun,
    baris: NAMA.map((nama, i) => {
      const kunci = String(i + 1).padStart(2, '0');
      const j = baris.find((b) => b.bulan === kunci);
      const b = pembelian.find((x) => x.bulan === kunci);
      return {
        bulan: nama,
        omzet: j?.omzet ?? 0,
        laba_kotor: j?.laba_kotor ?? 0,
        jumlah_order: j?.jumlah_order ?? 0,
        pembelian: b?.pembelian ?? 0,
      };
    }),
  });
});

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
  bungkus((req, res) => {
    const tahun = Number(req.query.tahun ?? new Date().getFullYear());
    const tahunBerjalan = tahun === new Date().getFullYear();
    /* Tanggal potong disamakan persis, termasuk 29 Februari: tanggal itu
       cukup dipakai apa adanya karena batas bawahnya selalu 1 Januari. */
    const potong = tahunBerjalan ? hariIni().slice(5) : '12-31';

    const ambil = (t: number) => {
      const mulai = `${t}-01-01`;
      const selesai = `${t}-${potong}`;
      const jual = ringkasPenjualan(mulai, selesai);
      const beli = ringkasPembelian(mulai, selesai);
      const qty = (db
        .prepare(
          `SELECT COALESCE(SUM(i.qty),0) AS n FROM pesanan_item i JOIN pesanan o ON o.id = i.pesanan_id
           WHERE o.tanggal BETWEEN ? AND ? AND o.status_kirim <> 'batal'`
        )
        .get(mulai, selesai) as any).n;
      return { tahun: t, mulai, selesai, ...jual, nilai_pembelian: beli.nilai_pembelian, qty_terjual: qty };
    };

    const ini = ambil(tahun);
    const lalu = ambil(tahun - 1);
    const tumbuh = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);

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

rutLaporan.get('/audit', wajibPeran('owner', 'admin'), (req, res) => {
  const { entitas, dari, sampai } = req.query as Record<string, string>;
  res.json(
    db
      .prepare(
        `SELECT * FROM audit_log
         WHERE (? IS NULL OR entitas = ?) AND (? IS NULL OR date(waktu) >= ?) AND (? IS NULL OR date(waktu) <= ?)
         ORDER BY waktu DESC, id DESC LIMIT 300`
      )
      .all(entitas ?? null, entitas ?? null, dari ?? null, dari ?? null, sampai ?? null, sampai ?? null)
  );
});
