/**
 * Data contoh MLT.
 *
 * Menghasilkan riwayat dua tahun berjalan supaya laporan bulanan, semester,
 * tahunan, dan perbandingan year-over-year punya isi sejak pertama dibuka —
 * modul analisis tidak bisa dinilai dari database kosong.
 *
 * Menjalankan ulang skrip ini MENGHAPUS seluruh isi database.
 */
import 'dotenv/config';
import { initDb, pool, transaksi, type Kueri } from '../backend/db.js';
import { hashSandi } from '../backend/auth.js';
import { ubahStok } from '../backend/stok.js';

/* Menolak berjalan terhadap Supabase kecuali dipaksa. Skrip ini membangkitkan
   puluhan ribu baris; dijalankan terhadap project berbayar-nol, ia menghabiskan
   jatah egress dan ruang tanpa memberi apa pun yang tidak bisa didapat dari
   database lokal. */
if (/supabase\.(co|com)/.test(process.env.DATABASE_URL ?? '') && !process.argv.includes('--paksa')) {
  console.error(`DATABASE_URL menunjuk ke Supabase.

Data contoh sebaiknya dibangkitkan di database lokal, bukan di project Supabase:
isinya sekitar 40.000 baris dan hanya berguna untuk menguji tampilan laporan.

Jalankan terhadap Postgres lokal, atau tambahkan --paksa bila memang disengaja.`);
  process.exit(1);
}

await initDb();

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

/* ------------------------------------------------------------- Master data */

const KATEGORI = ['Beras', 'Minyak Goreng', 'Gula', 'Telur', 'Tepung', 'Mie Instan', 'Kopi & Teh', 'Bumbu Dapur'];
const SUPPLIER = [
  { nama: 'PT Sumber Pangan Nusantara', alamat: 'Jl. Raya Solo KM 8, Klaten', kontak: 'Pak Hartono', no_hp: '0812-3344-5566', lead_time_hari: 3 },
  { nama: 'CV Minyak Jaya Abadi',       alamat: 'Kawasan Industri Semarang',  kontak: 'Bu Ratna',    no_hp: '0813-7788-9900', lead_time_hari: 5 },
  { nama: 'UD Tani Makmur',             alamat: 'Pasar Legi, Surakarta',      kontak: 'Pak Slamet',  no_hp: '0857-1122-3344', lead_time_hari: 2 },
  { nama: 'PT Boga Distribusi Utama',   alamat: 'Jl. Magelang KM 12, Sleman', kontak: 'Bu Indah',    no_hp: '0821-5566-7788', lead_time_hari: 4 },
];

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

/* ---------------------------------------------------------------- Penulisan */

const NAMA_TOKO = [
  'Toko Sumber Rejeki','Toko Barokah Jaya','Warung Bu Tini','Toko Makmur Sentosa','UD Tani Subur',
  'Toko Sinar Pagi','Warung Pak Kasno','Toko Berkah Abadi','Toko Amanah','Grosir Mitra Usaha',
  'Toko Sri Rejeki','Warung Mbak Yuni','Toko Harapan Baru','UD Karya Mandiri','Toko Lancar Jaya',
  'Katering Dapur Ibu','Rumah Makan Padang Sederhana','Toko Anugerah','Warung Sembako Pak Har','Toko Cahaya Timur',
  'Grosir Pasar Legi','Toko Mulya','Warung Bu Sri','Toko Setia Kawan','UD Pangan Sejahtera',
];

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

const JENIS_AKTIVITAS = ['mulai-kerja', 'berangkat', 'sampai-lokasi', 'bongkar-barang', 'selesai-pengiriman', 'kembali-gudang'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const tglAwal = new Date(TANGGAL_MULAI + 'T00:00:00Z');
const tglAkhir = new Date(TANGGAL_AKHIR + 'T00:00:00Z');

/* Pertumbuhan bertahap plus puncak menjelang Lebaran dan akhir tahun, supaya
   grafik tren dan angka year-over-year memperlihatkan pola yang masuk akal
   alih-alih garis datar. */
function faktorBulan(d: Date): number {
  const bulanKe = (d.getUTCFullYear() - 2025) * 12 + d.getUTCMonth();
  const musiman = [1.0, 1.02, 1.18, 1.22, 0.92, 0.98, 1.0, 1.03, 1.05, 1.02, 1.04, 1.12][d.getUTCMonth()];
  return (1 + bulanKe * 0.012) * musiman;
}

console.log('Mengosongkan database…');

await transaksi(async (k: Kueri) => {
  await k.jalankan(`TRUNCATE audit_log, aktivitas, absensi, pengiriman, pesanan_item, pesanan,
    pembelian_item, pembelian, mutasi_stok, produk, customer, pengguna, karyawan, supplier, kategori, pengaturan
    RESTART IDENTITY CASCADE`);

  /* --- Master ----------------------------------------------------------- */
  const idKategori: Record<string, number> = {};
  for (const nama of KATEGORI) {
    idKategori[nama] = (await k.satu<{ id: number }>('INSERT INTO kategori (nama) VALUES ($1) RETURNING id', [nama]))!.id;
  }

  const idSupplier: number[] = [];
  for (const s of SUPPLIER) {
    idSupplier.push(
      (await k.satu<{ id: number }>(
        'INSERT INTO supplier (nama, alamat, kontak, no_hp, lead_time_hari) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [s.nama, s.alamat, s.kontak, s.no_hp, s.lead_time_hari]
      ))!.id
    );
  }

  const idProduk: number[] = [];
  for (const p of PRODUK) {
    idProduk.push(
      (await k.satu<{ id: number }>(
        `INSERT INTO produk (sku, nama, kategori_id, supplier_id, satuan, harga_beli, harga_jual, stok,
                             stok_minimum, safety_stock, kelipatan_beli)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10) RETURNING id`,
        [p.sku, p.nama, idKategori[p.kat], idSupplier[p.sup], p.satuan, p.beli, p.jual,
         Math.round(p.laju * 3), Math.round(p.laju * 2), p.satuan === 'pcs' ? 12 : 5]
      ))!.id
    );
  }

  const idKaryawan: number[] = [];
  for (const kr of KARYAWAN) {
    idKaryawan.push(
      (await k.satu<{ id: number }>(
        'INSERT INTO karyawan (nama, jabatan, no_hp, status, tanggal_bergabung, area_kerja) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [kr.nama, kr.jabatan, `08${acakInt(10, 89)}-${acakInt(1000, 9999)}-${acakInt(1000, 9999)}`, 'aktif', '2024-06-01', kr.area]
      ))!.id
    );
  }
  const idSales = [idKaryawan[6], idKaryawan[7]];
  const idDriver = [idKaryawan[4], idKaryawan[5]];

  const idCustomer: number[] = [];
  for (const [i, nama] of NAMA_TOKO.entries()) {
    idCustomer.push(
      (await k.satu<{ id: number }>(
        `INSERT INTO customer (kode, nama, alamat, no_hp, tipe, sales_id, limit_kredit, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'aktif') RETURNING id`,
        [
          `C${String(i + 1).padStart(3, '0')}`, nama,
          `Jl. ${pilih(['Merdeka','Diponegoro','Kartini','Sudirman','Gatot Subroto','Ahmad Yani'])} No. ${acakInt(1, 180)}, ${pilih(['Klaten','Sleman','Bantul','Sukoharjo','Boyolali'])}`,
          `08${acakInt(10, 89)}-${acakInt(1000, 9999)}-${acakInt(1000, 9999)}`,
          pilih(['toko', 'toko', 'grosir', 'retail', 'horeka']),
          pilih(idSales), pilih([0, 10_000_000, 25_000_000, 50_000_000]),
        ]
      ))!.id
    );
  }

  for (const u of [
    { username: 'owner',  nama: 'Ahmad Wahyu Aji', peran: 'owner',  karyawan: 0 },
    { username: 'admin',  nama: 'Siti Nurhaliza',  peran: 'admin',  karyawan: 1 },
    { username: 'gudang', nama: 'Budi Santoso',    peran: 'gudang', karyawan: 2 },
    { username: 'sales',  nama: 'Dewi Lestari',    peran: 'sales',  karyawan: 6 },
    { username: 'driver', nama: 'Andi Prasetyo',   peran: 'driver', karyawan: 4 },
  ]) {
    await k.jalankan(
      'INSERT INTO pengguna (username, nama, kata_sandi, peran, karyawan_id) VALUES ($1,$2,$3,$4,$5)',
      [u.username, u.nama, hashSandi(SANDI_DEMO), u.peran, idKaryawan[u.karyawan]]
    );
  }
  await k.jalankan(
    'INSERT INTO pengguna (username, nama, kata_sandi, peran, customer_id) VALUES ($1,$2,$3,$4,$5)',
    ['buyer', NAMA_TOKO[0], hashSandi(SANDI_DEMO), 'buyer', idCustomer[0]]
  );

  for (const [kunci, nilai] of [
    ['nama_usaha', 'MLT — Mas Lukman Telur'],
    ['absensi_lat', process.env.ABSENSI_LAT ?? '-7.797068'],
    ['absensi_lng', process.env.ABSENSI_LNG ?? '110.370529'],
    ['absensi_radius_m', process.env.ABSENSI_RADIUS_M ?? '150'],
    ['absensi_jam_masuk', '08:00:00'],
    ['kulakan_hari_riwayat', '30'],
    ['kulakan_hari_cakupan', '7'],
  ] as Array<[string, string]>) {
    await k.jalankan('INSERT INTO pengaturan (kunci, nilai) VALUES ($1,$2)', [kunci, nilai]);
  }

  /* --- Transaksi -------------------------------------------------------- */
  console.log(`Membangkitkan transaksi ${TANGGAL_MULAI} sampai ${TANGGAL_AKHIR}…`);
  let nomorPO = 0;

  for (let d = new Date(tglAwal); d <= tglAkhir; d.setUTCDate(d.getUTCDate() + 1)) {
    const tanggal = iso(d);
    const faktor = faktorBulan(d);

    /* Setiap Senin: satu purchase order per supplier yang mengisi stok kembali
       ke sekitar dua belas hari penjualan. Ditulis sebagai pengisian ulang
       menuju target, bukan borongan tetap tiap periode — borongan tetap membuat
       stok menumpuk tanpa henti selama dua tahun data ini. */
    if (d.getUTCDay() === 1) {
      for (let s = 0; s < idSupplier.length; s++) {
        const barisPO: Array<{ i: number; qty: number; harga: number }> = [];
        for (const [i, p] of PRODUK.entries()) {
          if (p.sup !== s) continue;
          const stokKini = (await k.satu<{ stok: number }>('SELECT stok FROM produk WHERE id = $1', [idProduk[i]]))!.stok;
          const qty = Math.max(0, Math.ceil(p.laju * 12 * faktor) - stokKini);
          if (qty === 0) continue;
          barisPO.push({ i, qty, harga: Math.round(p.beli * (0.97 + acak() * 0.06)) });
        }
        if (barisPO.length === 0) continue;

        nomorPO++;
        const nomor = `PO-${tanggal.replace(/-/g, '')}-${String(nomorPO % 1000).padStart(3, '0')}`;
        const poId = (await k.satu<{ id: number }>(
          `INSERT INTO pembelian (nomor, supplier_id, tanggal, total, status, dibuat_oleh, dibuat_pada)
           VALUES ($1,$2,$3,0,'diterima',3,$4) RETURNING id`,
          [nomor, idSupplier[s], tanggal, `${tanggal} 06:00:00`]
        ))!.id;

        let total = 0;
        for (const { i, qty, harga } of barisPO) {
          total += qty * harga;
          await k.jalankan(
            'INSERT INTO pembelian_item (pembelian_id, produk_id, qty, qty_diterima, harga, subtotal) VALUES ($1,$2,$3,$3,$4,$5)',
            [poId, idProduk[i], qty, harga, qty * harga]
          );
          await ubahStok(k, {
            produkId: idProduk[i], delta: qty, tipe: 'masuk', refTipe: 'pembelian', refId: poId,
            catatan: `Penerimaan ${nomor}`, waktu: `${tanggal} 06:30:00`,
          });
          await k.jalankan('UPDATE produk SET harga_beli = $1 WHERE id = $2', [harga, idProduk[i]]);
        }
        await k.jalankan('UPDATE pembelian SET total = $1 WHERE id = $2', [total, poId]);
      }
    }

    /* Minggu hanya melayani sebagian kecil pesanan; pasar bahan pokok tetap
       jalan tapi jauh lebih sepi. */
    const jumlahOrder = d.getUTCDay() === 0 ? acakInt(0, 2) : Math.round(acakInt(6, 11) * faktor);

    for (let o = 0; o < jumlahOrder; o++) {
      const customerId = pilih(idCustomer);
      const salesId = (await k.satu<{ sales_id: number }>('SELECT sales_id FROM customer WHERE id = $1', [customerId]))!.sales_id;
      const dipakai = new Set<number>();
      const baris: Array<{ pid: number; qty: number; harga: number; beli: number; sub: number }> = [];
      let subtotal = 0;
      let hpp = 0;

      for (let b = 0; b < acakInt(2, 6); b++) {
        const idx = acakInt(0, PRODUK.length - 1);
        if (dipakai.has(idx)) continue;
        dipakai.add(idx);

        const p = PRODUK[idx];
        const kini = (await k.satu<any>('SELECT stok, harga_beli FROM produk WHERE id = $1', [idProduk[idx]]))!;
        /* Sebuah produk muncul kira-kira 1,5 kali sehari di seluruh pesanan,
           jadi porsi per baris disetel agar penjualan hariannya mendekati laju. */
        const qty = Math.min(Math.max(1, Math.round(p.laju * 0.54 * (0.5 + acak() * 1.5))), kini.stok);
        if (qty <= 0) continue;

        /* Potongan grosir sesekali, seperti yang biasa diberikan distributor. */
        const harga = acak() < 0.15 ? Math.round(p.jual * 0.97) : p.jual;
        subtotal += harga * qty;
        hpp += Number(kini.harga_beli) * qty;
        baris.push({ pid: idProduk[idx], qty, harga, beli: Number(kini.harga_beli), sub: harga * qty });
      }
      if (baris.length === 0) continue;

      const diskon = acak() < 0.25 ? Math.round((subtotal * acakInt(1, 3)) / 100 / 1000) * 1000 : 0;
      const ongkir = acak() < 0.55 ? pilih([0, 25000, 35000, 50000, 75000]) : 0;
      const nomor = `SO-${tanggal.replace(/-/g, '')}-${String((o + 1) % 1000).padStart(3, '0')}`;
      const jam = `${String(acakInt(7, 16)).padStart(2, '0')}:${String(acakInt(0, 59)).padStart(2, '0')}:00`;
      const hariLalu = Math.round((tglAkhir.getTime() - d.getTime()) / 86400000);
      /* Pesanan lama hampir selalu sudah lunas dan selesai; yang baru masih
         tersebar di berbagai status, supaya papan kerja harian tidak kosong. */
      const statusBayar = hariLalu > 14 ? 'lunas' : pilih(['lunas', 'lunas', 'belum', 'sebagian']);
      const statusKirim = hariLalu > 7 ? 'selesai' : pilih(['baru', 'diproses', 'dikirim', 'selesai']);

      const pesananId = (await k.satu<{ id: number }>(
        `INSERT INTO pesanan (nomor, customer_id, sales_id, tanggal, subtotal, diskon, ongkir, total, hpp_total,
                              status_bayar, status_kirim, dibuat_oleh, dibuat_pada)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,2,$12) RETURNING id`,
        [nomor, customerId, salesId, tanggal, subtotal, diskon, ongkir,
         subtotal - diskon + ongkir, hpp, statusBayar, statusKirim, `${tanggal} ${jam}`]
      ))!.id;

      for (const r of baris) {
        await k.jalankan(
          'INSERT INTO pesanan_item (pesanan_id, produk_id, qty, harga, harga_beli, subtotal) VALUES ($1,$2,$3,$4,$5,$6)',
          [pesananId, r.pid, r.qty, r.harga, r.beli, r.sub]
        );
        await ubahStok(k, {
          produkId: r.pid, delta: -r.qty, tipe: 'keluar', refTipe: 'pesanan', refId: pesananId,
          catatan: `Penjualan ${nomor}`, waktu: `${tanggal} ${jam}`,
        });
      }

      /* Pengiriman hanya dibuat untuk pesanan 45 hari terakhir: tabel ini
         dipakai papan kerja driver, bukan arsip dua tahun. */
      if (hariLalu <= 45 && statusKirim !== 'baru') {
        const statusDO = statusKirim === 'selesai' ? 'selesai' : pilih(['ditugaskan', 'berangkat', 'sampai', 'bongkar']);
        await k.jalankan(
          `INSERT INTO pengiriman (nomor, pesanan_id, driver_id, status, dimulai_pada, selesai_pada, penerima, dibuat_pada)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$5)`,
          [
            `DO-${tanggal.replace(/-/g, '')}-${String((o + 1) % 1000).padStart(3, '0')}`,
            pesananId, pilih(idDriver), statusDO, `${tanggal} ${jam}`,
            statusDO === 'selesai' ? `${tanggal} ${String(Math.min(21, Number(jam.slice(0, 2)) + acakInt(1, 3))).padStart(2, '0')}:${jam.slice(3)}` : null,
            statusDO === 'selesai' ? pilih(['Bu Tini', 'Pak Kasno', 'Mbak Yuni', 'Pak Har', 'Bu Sri']) : null,
          ]
        );
      }
    }
  }

  /* --- Absensi & aktivitas 45 hari terakhir ------------------------------ */
  for (let i = 44; i >= 0; i--) {
    const d = new Date(tglAkhir);
    d.setUTCDate(d.getUTCDate() - i);
    if (d.getUTCDay() === 0) continue;
    const tanggal = iso(d);

    for (const kid of idKaryawan) {
      if (acak() < 0.06) continue; // sesekali ada yang tidak masuk
      const terlambat = acak() < 0.15;
      const jamMasuk = terlambat
        ? `08:${String(acakInt(1, 45)).padStart(2, '0')}:00`
        : `07:${String(acakInt(30, 59)).padStart(2, '0')}:00`;
      await k.jalankan(
        `INSERT INTO absensi (karyawan_id, tanggal, jam_masuk, lat_masuk, lng_masuk, jarak_masuk_m,
                              jam_pulang, lat_pulang, lng_pulang, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          kid, tanggal, jamMasuk,
          -7.797068 + (acak() - 0.5) * 0.001, 110.370529 + (acak() - 0.5) * 0.001, acakInt(5, 140),
          `1${acakInt(6, 8)}:${String(acakInt(0, 59)).padStart(2, '0')}:00`,
          -7.797068 + (acak() - 0.5) * 0.001, 110.370529 + (acak() - 0.5) * 0.001,
          terlambat ? 'terlambat' : 'hadir',
        ]
      );

      for (let a = 0; a < acakInt(2, 6); a++) {
        await k.jalankan(
          'INSERT INTO aktivitas (karyawan_id, jenis, waktu, lat, lng) VALUES ($1,$2,$3,$4,$5)',
          [
            kid, pilih(JENIS_AKTIVITAS),
            `${tanggal} ${String(acakInt(8, 17)).padStart(2, '0')}:${String(acakInt(0, 59)).padStart(2, '0')}:00`,
            -7.79 + (acak() - 0.5) * 0.08, 110.37 + (acak() - 0.5) * 0.08,
          ]
        );
      }
    }
  }

  await k.jalankan(
    `INSERT INTO audit_log (user_id, nama_user, aksi, entitas, ringkasan)
     VALUES (1, 'Sistem', 'seed', 'database', 'Database diisi ulang dengan data contoh.')`
  );
});

const hitung = async (t: string) => Number((await (await import('../backend/db.js')).db.satu<{ n: string }>(`SELECT COUNT(*) AS n FROM ${t}`))!.n);
console.log(`
Selesai.
  produk      : ${await hitung('produk')}
  customer    : ${await hitung('customer')}
  pesanan     : ${await hitung('pesanan')}
  item        : ${await hitung('pesanan_item')}
  pembelian   : ${await hitung('pembelian')}
  mutasi stok : ${await hitung('mutasi_stok')}
  pengiriman  : ${await hitung('pengiriman')}
  absensi     : ${await hitung('absensi')}
  aktivitas   : ${await hitung('aktivitas')}

Akun demo (kata sandi: ${SANDI_DEMO})
  owner / admin / gudang / sales / driver / buyer
`);

await pool.end();
