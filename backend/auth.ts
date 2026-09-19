import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

export type Peran = 'owner' | 'admin' | 'gudang' | 'sales' | 'driver' | 'buyer';

export interface Pengguna {
  id: number;
  username: string;
  nama: string;
  peran: Peran;
  karyawan_id: number | null;
  customer_id: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      pengguna?: Pengguna;
    }
  }
}

/* JWT_SECRET tidak punya nilai bawaan yang dapat dipakai. Nilai bawaan yang
   diam-diam berfungsi adalah cara termudah sebuah sistem berisi data penjualan
   naik ke server dengan kunci yang sama seperti di repositori publik. */
const RAHASIA = process.env.JWT_SECRET;
if (!RAHASIA || RAHASIA.length < 16) {
  throw new Error('JWT_SECRET belum diisi di .env (minimal 16 karakter). Salin dari .env.example lalu ganti nilainya.');
}
const MASA_BERLAKU = '12h';

export function buatToken(p: Pengguna): string {
  return jwt.sign({ sub: p.id }, RAHASIA!, { expiresIn: MASA_BERLAKU });
}

export function cekSandi(sandi: string, hash: string): boolean {
  return bcrypt.compareSync(sandi, hash);
}

export function hashSandi(sandi: string): string {
  return bcrypt.hashSync(sandi, 10);
}

export function wajibMasuk(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ pesan: 'Sesi tidak ditemukan. Silakan masuk kembali.' });
  }

  let sub: number;
  try {
    sub = (jwt.verify(header.slice(7), RAHASIA!) as unknown as { sub: number }).sub;
  } catch {
    return res.status(401).json({ pesan: 'Sesi berakhir. Silakan masuk kembali.' });
  }

  /* Pengguna dibaca ulang dari database tiap permintaan, bukan diambil dari isi
     token: peran yang dicabut atau akun yang dinonaktifkan harus langsung
     berlaku, tidak menunggu token kedaluwarsa dua belas jam.

     Hanya enam kolom yang diambil, bukan SELECT *. Kueri ini berjalan pada
     setiap permintaan API, sehingga kolom yang tidak dipakai — termasuk hash
     kata sandi — akan mengalir keluar Supabase ribuan kali sehari tanpa guna. */
  db.satu<Pengguna>(
    `SELECT id, username, nama, peran, karyawan_id, customer_id
     FROM pengguna WHERE id = $1 AND aktif = true`,
    [sub]
  )
    .then((pengguna) => {
      if (!pengguna) return res.status(401).json({ pesan: 'Akun tidak aktif.' });
      req.pengguna = pengguna;
      next();
    })
    .catch(next);
}

export function wajibPeran(...peran: Peran[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.pengguna) return res.status(401).json({ pesan: 'Sesi tidak ditemukan.' });
    if (!peran.includes(req.pengguna.peran)) {
      return res.status(403).json({ pesan: 'Peran Anda tidak memiliki akses ke bagian ini.' });
    }
    next();
  };
}

/**
 * Menu yang boleh dilihat tiap peran.
 *
 * Dipakai server untuk menyusun menu dan sekaligus jadi acuan pemasangan
 * wajibPeran di tiap rute. Sidebar yang menyembunyikan menu bukan pengaman —
 * setiap rute tetap memeriksa perannya sendiri.
 */
export const AKSES_MODUL: Record<Peran, string[]> = {
  owner:  ['dashboard','penjualan','inventory','kulakan','pengiriman','customer','karyawan','absensi','aktivitas','laporan','audit','pengaturan'],
  admin:  ['dashboard','penjualan','inventory','kulakan','pengiriman','customer','karyawan','absensi','aktivitas','laporan','audit'],
  gudang: ['dashboard','inventory','kulakan','pengiriman'],
  sales:  ['dashboard','penjualan','customer','absensi','aktivitas'],
  driver: ['dashboard','pengiriman','absensi','aktivitas'],
  buyer:  ['katalog','pesanan-saya'],
};
