/**
 * Membuat atau memperbarui akun pengguna.
 *
 * Sistem belum punya layar manajemen akun, sedangkan setelah database
 * dikosongkan hanya ada satu owner. Skrip ini yang menambah akun staf sampai
 * layar tersebut ada.
 *
 *   npm run akun -- --username budi --nama "Budi Santoso" --peran gudang
 *   npm run akun -- --username budi --sandi "baru"            (ganti sandi)
 *   npm run akun -- --daftar                                  (lihat semua akun)
 *   npm run akun -- --username budi --nonaktif
 */
import 'dotenv/config';
import crypto from 'crypto';
import { db, initDb, pool } from '../backend/db.js';
import { hashSandi, type Peran } from '../backend/auth.js';

const PERAN: Peran[] = ['owner', 'admin', 'gudang', 'sales', 'driver', 'buyer'];

function argumen(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const ada = (nama: string) => process.argv.includes(`--${nama}`);
const selesai = async (kode = 0) => {
  await pool.end();
  process.exit(kode);
};

await initDb();

if (ada('daftar')) {
  const baris = await db.banyak<any>(
    `SELECT p.username, p.nama, p.peran, p.aktif, k.nama AS karyawan, c.nama AS customer
     FROM pengguna p LEFT JOIN karyawan k ON k.id = p.karyawan_id
     LEFT JOIN customer c ON c.id = p.customer_id ORDER BY p.peran, p.username`
  );
  if (baris.length === 0) {
    console.log('Belum ada akun. Jalankan: npm run reset -- --ya');
    await selesai();
  }
  console.log('username'.padEnd(14) + 'peran'.padEnd(9) + 'status'.padEnd(10) + 'nama');
  for (const b of baris) {
    console.log(
      b.username.padEnd(14) + b.peran.padEnd(9) + (b.aktif ? 'aktif' : 'nonaktif').padEnd(10) +
      b.nama + (b.karyawan ? ` (karyawan: ${b.karyawan})` : '') + (b.customer ? ` (customer: ${b.customer})` : '')
    );
  }
  await selesai();
}

const username = argumen('username')?.toLowerCase();
if (!username) {
  console.error(`Username wajib diisi.

  npm run akun -- --daftar
  npm run akun -- --username budi --nama "Budi Santoso" --peran gudang
  npm run akun -- --username budi --sandi "baru"
  npm run akun -- --username budi --nonaktif | --aktifkan

Peran yang tersedia: ${PERAN.join(', ')}

Peran gudang, sales, dan driver perlu ditautkan ke data karyawan agar bisa
memakai absensi dan aktivitas: tambahkan --karyawan-id <id>.
Peran buyer perlu ditautkan ke customer: --customer-id <id>.`);
  await selesai(1);
}

const lama = await db.satu<any>('SELECT * FROM pengguna WHERE username = $1', [username]);

if (ada('nonaktif') || ada('aktifkan')) {
  if (!lama) {
    console.error(`Akun "${username}" tidak ditemukan.`);
    await selesai(1);
  }
  const aktif = ada('aktifkan');
  await db.jalankan('UPDATE pengguna SET aktif = $1 WHERE id = $2', [aktif, lama.id]);
  console.log(`Akun "${username}" kini ${aktif ? 'aktif' : 'nonaktif'}.`);
  await selesai();
}

const peran = argumen('peran') as Peran | undefined;
if (peran && !PERAN.includes(peran)) {
  console.error(`Peran "${peran}" tidak dikenali. Pilih salah satu: ${PERAN.join(', ')}`);
  await selesai(1);
}

const sandiDiberikan = argumen('sandi');
const karyawanId = argumen('karyawan-id');
const customerId = argumen('customer-id');

/* Penautan diperiksa lebih dulu: akun driver yang menunjuk karyawan yang tidak
   ada baru ketahuan salah saat orangnya gagal absen di lapangan. */
for (const [label, tabel, nilai] of [['karyawan', 'karyawan', karyawanId], ['customer', 'customer', customerId]] as const) {
  if (nilai && !(await db.satu(`SELECT id FROM ${tabel} WHERE id = $1`, [Number(nilai)]))) {
    console.error(`Data ${label} dengan id ${nilai} tidak ditemukan.`);
    await selesai(1);
  }
}

if (lama) {
  await db.jalankan(
    `UPDATE pengguna SET nama = $1, peran = $2, kata_sandi = $3, karyawan_id = $4, customer_id = $5 WHERE id = $6`,
    [
      argumen('nama') ?? lama.nama,
      peran ?? lama.peran,
      sandiDiberikan ? hashSandi(sandiDiberikan) : lama.kata_sandi,
      karyawanId ? Number(karyawanId) : lama.karyawan_id,
      customerId ? Number(customerId) : lama.customer_id,
      lama.id,
    ]
  );
  console.log(`Akun "${username}" diperbarui.${sandiDiberikan ? ' Kata sandi diganti.' : ''}`);
} else {
  if (!peran) {
    console.error('Akun baru wajib menyebutkan --peran.');
    await selesai(1);
  }
  const sandi = sandiDiberikan ?? crypto.randomBytes(9).toString('base64url');
  await db.jalankan(
    'INSERT INTO pengguna (username, nama, kata_sandi, peran, karyawan_id, customer_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [
      username, argumen('nama') ?? username, hashSandi(sandi), peran,
      karyawanId ? Number(karyawanId) : null, customerId ? Number(customerId) : null,
    ]
  );
  console.log(`Akun "${username}" dibuat dengan peran ${peran}.`);
  if (!sandiDiberikan) console.log(`Kata sandi: ${sandi}  (hanya ditampilkan sekali)`);
}

await selesai();
