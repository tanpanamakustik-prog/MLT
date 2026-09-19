/**
 * Mengosongkan database dan menyiapkan satu akun owner.
 *
 * Dipakai untuk membuang data contoh sebelum sistem dipakai sungguhan. Seluruh
 * isi tabel dihapus — produk, customer, pesanan, stok, absensi, audit log —
 * lalu satu akun owner dibuat agar sistem masih bisa dimasuki.
 *
 *   npm run reset -- --ya
 *   npm run reset -- --ya --username aji --nama "Ahmad Wahyu Aji" --sandi "..."
 *
 * Tanpa --ya, skrip hanya melaporkan apa yang akan dihapus dan berhenti.
 * Penghapusan ini tidak bisa dibatalkan.
 */
import 'dotenv/config';
import crypto from 'crypto';
import { db, initDb, pool, transaksi } from '../backend/db.js';
import { hashSandi } from '../backend/auth.js';

const TABEL = [
  'audit_log', 'aktivitas', 'absensi', 'pengiriman',
  'pesanan_item', 'pesanan', 'pembelian_item', 'pembelian',
  'mutasi_stok', 'produk', 'customer', 'pengguna', 'karyawan',
  'supplier', 'kategori', 'pengaturan',
];

function argumen(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

await initDb();

const jumlah: Record<string, number> = {};
for (const t of TABEL) {
  jumlah[t] = Number((await db.satu<{ n: string }>(`SELECT COUNT(*) AS n FROM ${t}`))!.n);
}
const total = Object.values(jumlah).reduce((a, b) => a + b, 0);

console.log('Isi database saat ini:');
for (const [t, n] of Object.entries(jumlah)) {
  if (n > 0) console.log(`  ${t.padEnd(16)}${String(n).padStart(8)}`);
}
if (total === 0) console.log('  (sudah kosong)');

if (!process.argv.includes('--ya')) {
  console.log(`
Tidak ada yang dihapus.

Seluruh ${total.toLocaleString('id-ID')} baris di atas akan dihapus permanen dan
tidak dapat dikembalikan. Jalankan ulang dengan --ya bila memang itu yang
diinginkan:

  npm run reset -- --ya
`);
  await pool.end();
  process.exit(1);
}

const username = (argumen('username') ?? 'owner').toLowerCase();
const nama = argumen('nama') ?? 'Owner';
/* Kata sandi acak bila tidak diberikan: lebih baik pemilik menyalin satu nilai
   kuat sekali daripada sistem berisi data penjualan berjalan dengan sandi
   bawaan yang sama seperti yang tertulis di dokumentasi. */
const sandiDiberikan = argumen('sandi');
const sandi = sandiDiberikan ?? crypto.randomBytes(9).toString('base64url');

await transaksi(async (k) => {
  /* TRUNCATE ... CASCADE mengosongkan seluruh tabel sekaligus dan mengembalikan
     penghitung identity ke satu, sehingga nomor dokumen mulai dari awal lagi.
     DELETE satu per satu akan tersandung kunci asing antar tabel. */
  await k.jalankan(`TRUNCATE ${TABEL.join(', ')} RESTART IDENTITY CASCADE`);

  /* Pengaturan bukan data contoh melainkan konfigurasi; nilai bawaannya ditulis
     ulang supaya absensi dan saran kulakan tetap punya angka untuk dipakai. */
  const bawaan: Array<[string, string]> = [
    ['nama_usaha', argumen('usaha') ?? 'MLT — Mas Lukman Telur'],
    ['absensi_lat', process.env.ABSENSI_LAT ?? '-7.797068'],
    ['absensi_lng', process.env.ABSENSI_LNG ?? '110.370529'],
    ['absensi_radius_m', process.env.ABSENSI_RADIUS_M ?? '150'],
    ['absensi_jam_masuk', '08:00:00'],
    ['kulakan_hari_riwayat', '30'],
    ['kulakan_hari_cakupan', '7'],
  ];
  for (const [kunci, nilai] of bawaan) {
    await k.jalankan('INSERT INTO pengaturan (kunci, nilai) VALUES ($1, $2)', [kunci, nilai]);
  }

  await k.jalankan(
    'INSERT INTO pengguna (username, nama, kata_sandi, peran) VALUES ($1, $2, $3, $4)',
    [username, nama, hashSandi(sandi), 'owner']
  );

  await k.jalankan(
    `INSERT INTO audit_log (nama_user, aksi, entitas, ringkasan)
     VALUES ('sistem', 'reset', 'database', 'Database dikosongkan dan akun owner dibuat ulang.')`
  );
});

console.log(`
Database dikosongkan.

Akun owner
  username  : ${username}
  nama      : ${nama}
  kata sandi: ${sandi}
${sandiDiberikan ? '' : `
Kata sandi di atas dibuat acak dan hanya ditampilkan sekali. Salin sekarang.
Untuk menentukan sendiri, jalankan ulang dengan --sandi "..."
`}
Langkah berikutnya
  1. Masuk sebagai owner, lalu isi Pengaturan (nama usaha, titik absensi).
  2. Tambahkan kategori, supplier, dan produk.
  3. Tambahkan karyawan, lalu buat akun mereka dengan:
       npm run akun -- --username budi --nama "Budi" --peran gudang
`);

await pool.end();
