/**
 * Data contoh DistribusiHub.
 *
 * Menghasilkan riwayat dua tahun berjalan supaya laporan bulanan, semester,
 * tahunan, dan perbandingan year-over-year punya isi sejak pertama dibuka —
 * modul analisis tidak bisa dinilai dari database kosong.
 *
 * Menjalankan ulang skrip ini MENGHAPUS seluruh isi database.
 */
import 'dotenv/config';
import { db, initDb, simpanPengaturan } from '../backend/db.js';
import { hashSandi } from '../backend/auth.js';
import { ubahStok } from '../backend/stok.js';

initDb();

const TANGGAL_MULAI = '2025-01-01';
const TANGGAL_AKHIR = new Date().toLocaleDateString('sv-SE');
const SANDI_DEMO = 'demo1234';

/* Acak dengan benih tetap: menjalankan ulang seed menghasilkan angka yang sama,
   sehingga tangkapan layar dan diskusi soal laporan tidak berubah tiap kali. */
let benih = 20260919;
function acak(): number {
  benih = (benih * 1103515245 + 12345) & 0x7fffffff;
  return benih / 0x7fffffff;
}
const acakInt = (min: number, maks: number) => Math.floor(acak() * (maks - min + 1)) + min;
const pilih = <T,>(arr: T[]): T => arr[Math.floor(acak() * arr.length)];

console.log('Mengosongkan database…');
db.exec(`
  PRAGMA foreign_keys = OFF;
  DELETE FROM audit_log; DELETE FROM aktivitas; DELETE FROM absensi;
  DELETE FROM pengiriman; DELETE FROM pesanan_item; DELETE FROM pesanan;
  DELETE FROM pembelian_item; DELETE FROM pembelian; DELETE FROM mutasi_stok;
  DELETE FROM produk; DELETE FROM customer; DELETE FROM pengguna;
  DELETE FROM karyawan; DELETE FROM supplier; DELETE FROM kategori;
  DELETE FROM pengaturan; DELETE FROM sqlite_sequence;
  PRAGMA foreign_keys = ON;
`);

/* ------------------------------------------------------------- Master data */

const KATEGORI = ['Beras', 'Minyak Goreng', 'Gula', 'Telur', 'Tepung', 'Mie Instan', 'Kopi & Teh', 'Bumbu Dapur'];
const idKategori: Record<string, number> = {};
for (const nama of KATEGORI) {
  idKategori[nama] = Number(db.prepare('INSERT INTO kategori (nama) VALUES (?)').run(nama).lastInsertRowid);
}

const SUPPLIER = [
  { nama: 'PT Sumber Pangan Nusantara', alamat: 'Jl. Raya Solo KM 8, Klaten', kontak: 'Pak Hartono', no_hp: '0812-3344-5566', lead_time_hari: 3 },
  { nama: 'CV Minyak Jaya Abadi',       alamat: 'Kawasan Industri Semarang',  kontak: 'Bu Ratna',    no_hp: '0813-7788-9900', lead_time_hari: 5 },
  { nama: 'UD Tani Makmur',             alamat: 'Pasar Legi, Surakarta',      kontak: 'Pak Slamet',  no_hp: '0857-1122-3344', lead_time_hari: 2 },
  { nama: 'PT Boga Distribusi Utama',   alamat: 'Jl. Magelang KM 12, Sleman', kontak: 'Bu Indah',    no_hp: '0821-5566-7788', lead_time_hari: 4 },
];
const idSupplier = SUPPLIER.map(
  (s) =>
    Number(
      db.prepare('INSERT INTO supplier (nama, alamat, kontak, no_hp, lead_time_hari) VALUES (?, ?, ?, ?, ?)')
        .run(s.nama, s.alamat, s.kontak, s.no_hp, s.lead_time_hari).lastInsertRowid
    )
);

/* laju = perkiraan penjualan per hari, dipakai untuk membangkitkan transaksi
   sekaligus menentukan besar kulakan bulanan agar stok tidak pernah minus. */
const PRODUK = [
  { sku: 'BRP05', nama: 'Beras Premium 5 kg',      kat: 'Beras',        sup: 0, satuan: 'sak',  beli: 65000, jual: 78000, min: 50, laju: 34 },
  { sku: 'BRM25', nama: 'Beras Medium 25 kg',      kat: 'Beras',        sup: 0, satuan: 'sak',  beli: 285000, jual: 322000, min: 30, laju: 12 },
  { sku: 'BRIR5', nama: 'Beras IR64 5 kg',         kat: 'Beras',        sup: 0, satuan: 'sak',  beli: 58000, jual: 68000, min: 40, laju: 22 },
  { sku: 'MGK01', nama: 'Minyak Goreng 1 L',       kat: 'Minyak Goreng',sup: 1, satuan: 'pcs',  beli: 15500, jual: 18500, min: 200, laju: 95 },
  { sku: 'MGK02', nama: 'Minyak Goreng 2 L',       kat: 'Minyak Goreng',sup: 1, satuan: 'pcs',  beli: 30000, jual: 35500, min: 120, laju: 48 },
  { sku: 'MGC05', nama: 'Minyak Curah 5 L',        kat: 'Minyak Goreng',sup: 1, satuan: 'jerigen', beli: 72000, jual: 82000, min: 60, laju: 18 },
  { sku: 'GPS01', nama: 'Gula Pasir 1 kg',         kat: 'Gula',         sup: 2, satuan: 'pcs',  beli: 14000, jual: 16500, min: 150, laju: 70 },
  { sku: 'GPS50', nama: 'Gula Pasir Karung 50 kg', kat: 'Gula',         sup: 2, satuan: 'karung', beli: 680000, jual: 745000, min: 15, laju: 5 },
  { sku: 'TLR01', nama: 'Telur Ayam 1 kg',         kat: 'Telur',        sup: 2, satuan: 'kg',   beli: 26000, jual: 30500, min: 100, laju: 55 },
  { sku: 'TLR15', nama: 'Telur Ayam Peti 15 kg',   kat: 'Telur',        sup: 2, satuan: 'peti', beli: 382000, jual: 425000, min: 20, laju: 9 },
  { sku: 'TPG01', nama: 'Tepung Terigu 1 kg',      kat: 'Tepung',       sup: 3, satuan: 'pcs',  beli: 11000, jual: 13500, min: 120, laju: 42 },
  { sku: 'TPG25', nama: 'Tepung Terigu 25 kg',     kat: 'Tepung',       sup: 3, satuan: 'sak',  beli: 258000, jual: 288000, min: 25, laju: 7 },
  { sku: 'TPB01', nama: 'Tepung Beras 500 g',      kat: 'Tepung',       sup: 3, satuan: 'pcs',  beli: 7500, jual: 9500, min: 80, laju: 16 },
  { sku: 'MIE40', nama: 'Mie Instan Goreng Dus',   kat: 'Mie Instan',   sup: 3, satuan: 'dus',  beli: 108000, jual: 124000, min: 60, laju: 26 },
  { sku: 'MIK40', nama: 'Mie Instan Kuah Dus',     kat: 'Mie Instan',   sup: 3, satuan: 'dus',  beli: 105000, jual: 120000, min: 60, laju: 21 },
  { sku: 'KPB01', nama: 'Kopi Bubuk 250 g',        kat: 'Kopi & Teh',   sup: 3, satuan: 'pcs',  beli: 13500, jual: 17000, min: 70, laju: 14 },
  { sku: 'THC25', nama: 'Teh Celup 25 sachet',     kat: 'Kopi & Teh',   sup: 3, satuan: 'pcs',  beli: 6800, jual: 9000, min: 70, laju: 12 },
  { sku: 'GRM01', nama: 'Garam Dapur 500 g',       kat: 'Bumbu Dapur',  sup: 2, satuan: 'pcs',  beli: 3200, jual: 4500, min: 100, laju: 24 },
  { sku: 'KCP62', nama: 'Kecap Manis 620 ml',      kat: 'Bumbu Dapur',  sup: 3, satuan: 'pcs',  beli: 18500, jual: 22500, min: 80, laju: 17 },
  { sku: 'SAU34', nama: 'Saus Sambal 340 ml',      kat: 'Bumbu Dapur',  sup: 3, satuan: 'pcs',  beli: 11500, jual: 14500, min: 80, laju: 13 },
];

const idProduk = PRODUK.map((p) =>
  Number(
    db.prepare(
      `INSERT INTO produk (sku, nama, kategori_id, supplier_id, satuan, harga_beli, harga_jual, stok, stok_minimum, safety_stock, kelipatan_beli)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(
      p.sku, p.nama, idKategori[p.kat], idSupplier[p.sup], p.satuan, p.beli, p.jual,
      /* Ambang dinyatakan dalam hari penjualan, bukan angka tetap: 200 pcs
         adalah dua hari bagi minyak 1 L tapi berbulan-bulan bagi gula karung. */
      Math.round(p.laju * 3), Math.round(p.laju * 2), p.satuan === 'pcs' ? 12 : 5
    ).lastInsertRowid
  )
);

const KARYAWAN = [
  { nama: 'Ahmad Wahyu Aji', jabatan: 'Owner',           area: 'Kantor Pusat' },
  { nama: 'Siti Nurhaliza',  jabatan: 'Admin Penjualan', area: 'Kantor Pusat' },
  { nama: 'Budi Santoso',    jabatan: 'Kepala Gudang',   area: 'Gudang Utama' },
  { nama: 'Rudi Hartanto',   jabatan: 'Staf Gudang',     area: 'Gudang Utama' },
  { nama: 'Andi Prasetyo',   jabatan: 'Driver',          area: 'Rute Selatan' },
  { nama: 'Joko Susilo',     jabatan: 'Driver',          area: 'Rute Utara' },
  { nama: 'Dewi Lestari',    jabatan: 'Sales',           area: 'Klaten & Sekitar' },
  { nama: 'Bagus Firmansyah',jabatan: 'Sales',           area: 'Sleman & Sekitar' },
];
const idKaryawan = KARYAWAN.map((k) =>
  Number(
    db.prepare('INSERT INTO karyawan (nama, jabatan, no_hp, status, tanggal_bergabung, area_kerja) VALUES (?, ?, ?, ?, ?, ?)')
      .run(k.nama, k.jabatan, `08${acakInt(10, 89)}-${acakInt(1000, 9999)}-${acakInt(1000, 9999)}`, 'aktif', '2024-06-01', k.area)
      .lastInsertRowid
  )
);
const idSales = [idKaryawan[6], idKaryawan[7]];
const idDriver = [idKaryawan[4], idKaryawan[5]];

const NAMA_TOKO = [
  'Toko Sumber Rejeki','Toko Barokah Jaya','Warung Bu Tini','Toko Makmur Sentosa','UD Tani Subur',
  'Toko Sinar Pagi','Warung Pak Kasno','Toko Berkah Abadi','Toko Amanah','Grosir Mitra Usaha',
  'Toko Sri Rejeki','Warung Mbak Yuni','Toko Harapan Baru','UD Karya Mandiri','Toko Lancar Jaya',
  'Katering Dapur Ibu','Rumah Makan Padang Sederhana','Toko Anugerah','Warung Sembako Pak Har','Toko Cahaya Timur',
  'Grosir Pasar Legi','Toko Mulya','Warung Bu Sri','Toko Setia Kawan','UD Pangan Sejahtera',
];
const idCustomer = NAMA_TOKO.map((nama, i) =>
  Number(
    db.prepare(
      `INSERT INTO customer (kode, nama, alamat, no_hp, tipe, sales_id, limit_kredit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'aktif')`
    ).run(
      `C${String(i + 1).padStart(3, '0')}`,
      nama,
      `Jl. ${pilih(['Merdeka','Diponegoro','Kartini','Sudirman','Gatot Subroto','Ahmad Yani'])} No. ${acakInt(1, 180)}, ${pilih(['Klaten','Sleman','Bantul','Sukoharjo','Boyolali'])}`,
      `08${acakInt(10, 89)}-${acakInt(1000, 9999)}-${acakInt(1000, 9999)}`,
      pilih(['toko', 'toko', 'grosir', 'retail', 'horeka']),
      pilih(idSales),
      pilih([0, 10_000_000, 25_000_000, 50_000_000]),
    ).lastInsertRowid
  )
);

const PENGGUNA = [
  { username: 'owner',  nama: 'Ahmad Wahyu Aji', peran: 'owner',  karyawan: 0 },
  { username: 'admin',  nama: 'Siti Nurhaliza',  peran: 'admin',  karyawan: 1 },
  { username: 'gudang', nama: 'Budi Santoso',    peran: 'gudang', karyawan: 2 },
  { username: 'sales',  nama: 'Dewi Lestari',    peran: 'sales',  karyawan: 6 },
  { username: 'driver', nama: 'Andi Prasetyo',   peran: 'driver', karyawan: 4 },
];
for (const u of PENGGUNA) {
  db.prepare('INSERT INTO pengguna (username, nama, kata_sandi, peran, karyawan_id) VALUES (?, ?, ?, ?, ?)')
    .run(u.username, u.nama, hashSandi(SANDI_DEMO), u.peran, idKaryawan[u.karyawan]);
}
db.prepare('INSERT INTO pengguna (username, nama, kata_sandi, peran, customer_id) VALUES (?, ?, ?, ?, ?)')
  .run('buyer', NAMA_TOKO[0], hashSandi(SANDI_DEMO), 'buyer', idCustomer[0]);

simpanPengaturan('absensi_lat', process.env.ABSENSI_LAT ?? '-7.797068');
simpanPengaturan('absensi_lng', process.env.ABSENSI_LNG ?? '110.370529');
simpanPengaturan('absensi_radius_m', process.env.ABSENSI_RADIUS_M ?? '150');
simpanPengaturan('absensi_jam_masuk', '08:00:00');
simpanPengaturan('kulakan_hari_riwayat', '30');
simpanPengaturan('kulakan_hari_cakupan', '7');
simpanPengaturan('nama_usaha', 'DistribusiHub — Distributor Bahan Pokok');

/* ------------------------------------------------------------- Transaksi */

const tglAwal = new Date(TANGGAL_MULAI + 'T00:00:00');
const tglAkhir = new Date(TANGGAL_AKHIR + 'T00:00:00');
const iso = (d: Date) => d.toLocaleDateString('sv-SE');

/* Pertumbuhan bertahap plus puncak menjelang Lebaran dan akhir tahun, supaya
   grafik tren dan angka year-over-year memperlihatkan pola yang masuk akal
   alih-alih garis datar. */
function faktorBulan(d: Date): number {
  const bulanKe = (d.getFullYear() - 2025) * 12 + d.getMonth();
  const pertumbuhan = 1 + bulanKe * 0.012;
  const musiman = [1.0, 1.02, 1.18, 1.22, 0.92, 0.98, 1.0, 1.03, 1.05, 1.02, 1.04, 1.12][d.getMonth()];
  return pertumbuhan * musiman;
}

let nomorSO = 0;
let nomorPO = 0;
const simpanPesanan = db.prepare(
  `INSERT INTO pesanan (nomor, customer_id, sales_id, tanggal, subtotal, diskon, ongkir, total, hpp_total, status_bayar, status_kirim, dibuat_oleh, dibuat_pada)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?)`
);
const simpanItem = db.prepare(
  'INSERT INTO pesanan_item (pesanan_id, produk_id, qty, harga, harga_beli, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
);

const jalankan = db.transaction(() => {
  for (let d = new Date(tglAwal); d <= tglAkhir; d.setDate(d.getDate() + 1)) {
    const tanggal = iso(d);
    const faktor = faktorBulan(d);

    /* Setiap Senin: satu purchase order per supplier yang mengisi stok kembali
       ke sekitar dua belas hari penjualan. Ditulis sebagai pengisian ulang
       menuju target, bukan borongan tetap tiap periode — borongan tetap membuat
       stok menumpuk tanpa henti selama dua tahun data ini. */
    if (d.getDay() === 1) {
      for (let s = 0; s < idSupplier.length; s++) {
        const produkSupplier = PRODUK.map((p, i) => ({ p, i })).filter((x) => x.p.sup === s);
        if (produkSupplier.length === 0) continue;

        let total = 0;
        const barisPO: Array<{ p: (typeof PRODUK)[number]; i: number; qty: number; harga: number }> = [];
        for (const { p, i } of produkSupplier) {
          const target = Math.ceil(p.laju * 12 * faktor);
          const stokKini = (db.prepare('SELECT stok FROM produk WHERE id = ?').get(idProduk[i]) as any).stok as number;
          const qty = Math.max(0, target - stokKini);
          if (qty === 0) continue;
          const harga = Math.round(p.beli * (0.97 + acak() * 0.06));
          barisPO.push({ p, i, qty, harga });
        }
        if (barisPO.length === 0) continue;

        nomorPO++;
        const nomor = `PO-${tanggal.replace(/-/g, '')}-${String(nomorPO % 1000).padStart(3, '0')}`;
        const poId = Number(
          db.prepare(`INSERT INTO pembelian (nomor, supplier_id, tanggal, total, status, dibuat_oleh, dibuat_pada) VALUES (?, ?, ?, 0, 'diterima', 3, ?)`)
            .run(nomor, idSupplier[s], tanggal, tanggal + ' 08:00:00').lastInsertRowid
        );

        for (const { p, i, qty, harga } of barisPO) {
          const sub = qty * harga;
          total += sub;
          db.prepare('INSERT INTO pembelian_item (pembelian_id, produk_id, qty, qty_diterima, harga, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
            .run(poId, idProduk[i], qty, qty, harga, sub);
          ubahStok({
            produkId: idProduk[i], delta: qty, tipe: 'masuk', refTipe: 'pembelian', refId: poId,
            catatan: `Penerimaan ${nomor}`, waktu: `${tanggal} 08:30:00`,
          });
          db.prepare('UPDATE produk SET harga_beli = ? WHERE id = ?').run(harga, idProduk[i]);
        }
        db.prepare('UPDATE pembelian SET total = ? WHERE id = ?').run(total, poId);
      }
    }

    /* Minggu hanya melayani sebagian kecil pesanan; pasar bahan pokok tetap
       jalan tapi jauh lebih sepi. */
    const jumlahOrder = d.getDay() === 0 ? acakInt(0, 2) : Math.round(acakInt(6, 11) * faktor);

    for (let o = 0; o < jumlahOrder; o++) {
      const customerId = pilih(idCustomer);
      const cust = db.prepare('SELECT sales_id FROM customer WHERE id = ?').get(customerId) as any;
      const jumlahBaris = acakInt(2, 6);
      const dipakai = new Set<number>();
      const baris: Array<{ pid: number; qty: number; harga: number; beli: number; sub: number }> = [];
      let subtotal = 0;
      let hpp = 0;

      for (let b = 0; b < jumlahBaris; b++) {
        const idx = acakInt(0, PRODUK.length - 1);
        if (dipakai.has(idx)) continue;
        dipakai.add(idx);

        const p = PRODUK[idx];
        const produkId = idProduk[idx];
        const stokKini = (db.prepare('SELECT stok, harga_beli FROM produk WHERE id = ?').get(produkId) as any);
        /* Sebuah produk muncul kira-kira 1,5 kali sehari di seluruh pesanan
           (8-11 pesanan, 2-6 baris, 20 produk), jadi porsi per baris disetel
           agar penjualan hariannya mendekati laju yang ditetapkan di atas. */
        const diminta = Math.max(1, Math.round(p.laju * 0.54 * (0.5 + acak() * 1.5)));
        const qty = Math.min(diminta, stokKini.stok);
        if (qty <= 0) continue;

        /* Potongan grosir sesekali, seperti yang biasa diberikan distributor
           untuk pembelian besar — bukan pada hampir setiap baris, yang akan
           menggerus margin seluruh laporan. */
        const harga = acak() < 0.15 ? Math.round(p.jual * 0.97) : p.jual;
        const sub = harga * qty;
        subtotal += sub;
        hpp += stokKini.harga_beli * qty;
        baris.push({ pid: produkId, qty, harga, beli: stokKini.harga_beli, sub });
      }
      if (baris.length === 0) continue;

      const diskon = acak() < 0.25 ? Math.round((subtotal * acakInt(1, 3)) / 100 / 1000) * 1000 : 0;
      const ongkir = acak() < 0.55 ? pilih([0, 25000, 35000, 50000, 75000]) : 0;
      const total = subtotal - diskon + ongkir;
      nomorSO++;
      const nomor = `SO-${tanggal.replace(/-/g, '')}-${String((o + 1) % 1000).padStart(3, '0')}`;
      const jam = `${String(acakInt(7, 16)).padStart(2, '0')}:${String(acakInt(0, 59)).padStart(2, '0')}:00`;
      const hariLalu = Math.round((tglAkhir.getTime() - d.getTime()) / 86400000);
      /* Pesanan lama hampir selalu sudah lunas dan selesai; yang baru masih
         tersebar di berbagai status, supaya papan kerja harian tidak kosong. */
      const statusBayar = hariLalu > 14 ? 'lunas' : pilih(['lunas', 'lunas', 'belum', 'sebagian']);
      const statusKirim = hariLalu > 7 ? 'selesai' : pilih(['baru', 'diproses', 'dikirim', 'selesai']);

      const pesananId = Number(
        simpanPesanan.run(nomor, customerId, cust.sales_id, tanggal, subtotal, diskon, ongkir, total, hpp, statusBayar, statusKirim, `${tanggal} ${jam}`).lastInsertRowid
      );
      for (const r of baris) {
        simpanItem.run(pesananId, r.pid, r.qty, r.harga, r.beli, r.sub);
        ubahStok({
          produkId: r.pid, delta: -r.qty, tipe: 'keluar', refTipe: 'pesanan', refId: pesananId,
          catatan: `Penjualan ${nomor}`, waktu: `${tanggal} ${jam}`,
        });
      }

      /* Pengiriman hanya dibuat untuk pesanan 45 hari terakhir: tabel ini
         dipakai papan kerja driver, bukan arsip dua tahun. */
      if (hariLalu <= 45 && statusKirim !== 'baru') {
        const driverId = pilih(idDriver);
        const statusKirimDO = statusKirim === 'selesai' ? 'selesai' : pilih(['ditugaskan', 'berangkat', 'sampai', 'bongkar']);
        const mulai = `${tanggal} ${jam}`;
        const selesai = statusKirimDO === 'selesai' ? `${tanggal} ${String(Math.min(21, Number(jam.slice(0, 2)) + acakInt(1, 3))).padStart(2, '0')}:${jam.slice(3)}` : null;
        db.prepare(
          `INSERT INTO pengiriman (nomor, pesanan_id, driver_id, status, dimulai_pada, selesai_pada, penerima, dibuat_pada)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          `DO-${tanggal.replace(/-/g, '')}-${String((o + 1) % 1000).padStart(3, '0')}`,
          pesananId, driverId, statusKirimDO, mulai, selesai,
          statusKirimDO === 'selesai' ? pilih(['Bu Tini', 'Pak Kasno', 'Mbak Yuni', 'Pak Har', 'Bu Sri']) : null,
          mulai
        );
      }
    }
  }
});

console.log(`Membangkitkan transaksi ${TANGGAL_MULAI} sampai ${TANGGAL_AKHIR}…`);
jalankan();

/* ------------------------------------------------- Absensi & aktivitas 45 hari */

const JENIS_AKTIVITAS = ['mulai-kerja', 'berangkat', 'sampai-lokasi', 'bongkar-barang', 'selesai-pengiriman', 'kembali-gudang'];
const isiOperasional = db.transaction(() => {
  for (let i = 44; i >= 0; i--) {
    const d = new Date(tglAkhir);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0) continue;
    const tanggal = iso(d);

    for (const kid of idKaryawan) {
      if (acak() < 0.06) continue; // sesekali ada yang tidak masuk
      const terlambat = acak() < 0.15;
      const jamMasuk = terlambat
        ? `08:${String(acakInt(1, 45)).padStart(2, '0')}:00`
        : `07:${String(acakInt(30, 59)).padStart(2, '0')}:00`;
      db.prepare(
        `INSERT INTO absensi (karyawan_id, tanggal, jam_masuk, lat_masuk, lng_masuk, jarak_masuk_m, jam_pulang, lat_pulang, lng_pulang, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        kid, tanggal, jamMasuk,
        -7.797068 + (acak() - 0.5) * 0.001, 110.370529 + (acak() - 0.5) * 0.001, acakInt(5, 140),
        `1${acakInt(6, 8)}:${String(acakInt(0, 59)).padStart(2, '0')}:00`,
        -7.797068 + (acak() - 0.5) * 0.001, 110.370529 + (acak() - 0.5) * 0.001,
        terlambat ? 'terlambat' : 'hadir'
      );

      for (let a = 0; a < acakInt(2, 6); a++) {
        db.prepare('INSERT INTO aktivitas (karyawan_id, jenis, waktu, lat, lng, catatan) VALUES (?, ?, ?, ?, ?, ?)')
          .run(
            kid, pilih(JENIS_AKTIVITAS),
            `${tanggal} ${String(acakInt(8, 17)).padStart(2, '0')}:${String(acakInt(0, 59)).padStart(2, '0')}:00`,
            -7.79 + (acak() - 0.5) * 0.08, 110.37 + (acak() - 0.5) * 0.08, null
          );
      }
    }
  }
});
isiOperasional();

db.prepare(
  `INSERT INTO audit_log (user_id, nama_user, aksi, entitas, entitas_id, ringkasan)
   VALUES (1, 'Sistem', 'seed', 'database', NULL, 'Database diisi ulang dengan data contoh.')`
).run();

const hitung = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as any).n;
console.log(`
Selesai.
  produk      : ${hitung('produk')}
  customer    : ${hitung('customer')}
  pesanan     : ${hitung('pesanan')}
  item        : ${hitung('pesanan_item')}
  pembelian   : ${hitung('pembelian')}
  mutasi stok : ${hitung('mutasi_stok')}
  pengiriman  : ${hitung('pengiriman')}
  absensi     : ${hitung('absensi')}
  aktivitas   : ${hitung('aktivitas')}

Akun demo (kata sandi: ${SANDI_DEMO})
  owner / admin / gudang / sales / driver / buyer
`);
