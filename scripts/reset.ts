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
import { db, initDb, simpanPengaturan } from '../backend/db.js';
import { hashSandi } from '../backend/auth.js';

/* Urutan penting: tabel anak lebih dulu, karena foreign key menyala. */
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

initDb();

const jumlah = Object.fromEntries(
  TABEL.map((t) => [t, (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as any).n as number])
);
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
  process.exit(1);
}

const username = (argumen('username') ?? 'owner').toLowerCase();
const nama = argumen('nama') ?? 'Owner';
/* Kata sandi acak bila tidak diberikan: lebih baik pemilik menyalin satu nilai
   kuat sekali daripada sistem berisi data penjualan berjalan dengan sandi
   bawaan yang sama seperti yang tertulis di dokumentasi. */
const sandiDiberikan = argumen('sandi');
const sandi = sandiDiberikan ?? crypto.randomBytes(9).toString('base64url');

/* Kunci asing dimatikan di luar transaksi, bukan di dalamnya: SQLite
   mengabaikan pragma ini selama transaksi berjalan, sehingga menaruhnya di
   dalam db.transaction() membuatnya tidak berpengaruh sama sekali dan
   penghapusan gagal di tabel pertama yang masih ditunjuk tabel lain. */
db.pragma('foreign_keys = OFF');

const kosongkan = db.transaction(() => {
  for (const t of TABEL) db.prepare(`DELETE FROM ${t}`).run();
  db.prepare(`DELETE FROM sqlite_sequence`).run();

  /* Pengaturan bukan data contoh melainkan konfigurasi; nilai bawaannya ditulis
     ulang supaya absensi dan saran kulakan tetap punya angka untuk dipakai. */
  simpanPengaturan('nama_usaha', argumen('usaha') ?? 'MLT — Mas Lukman Telur');
  simpanPengaturan('absensi_lat', process.env.ABSENSI_LAT ?? '-7.797068');
  simpanPengaturan('absensi_lng', process.env.ABSENSI_LNG ?? '110.370529');
  simpanPengaturan('absensi_radius_m', process.env.ABSENSI_RADIUS_M ?? '150');
  simpanPengaturan('absensi_jam_masuk', '08:00:00');
  simpanPengaturan('kulakan_hari_riwayat', '30');
  simpanPengaturan('kulakan_hari_cakupan', '7');

  db.prepare('INSERT INTO pengguna (username, nama, kata_sandi, peran) VALUES (?, ?, ?, ?)')
    .run(username, nama, hashSandi(sandi), 'owner');

  db.prepare(
    `INSERT INTO audit_log (nama_user, aksi, entitas, ringkasan)
     VALUES ('sistem', 'reset', 'database', 'Database dikosongkan dan akun owner dibuat ulang.')`
  ).run();
});

kosongkan();
db.pragma('foreign_keys = ON');
/* VACUUM tidak bisa berada di dalam transaksi; dijalankan setelahnya supaya
   berkas sqlite menyusut dan tidak menyisakan ruang bekas data contoh. */
db.exec('VACUUM');

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
