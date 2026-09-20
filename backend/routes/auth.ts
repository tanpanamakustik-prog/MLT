import { Router } from 'express';
import { db, transaksi } from '../db.js';
import { AKSES_MODUL, buatToken, cekSandi, hashSandi, wajibMasuk, type Pengguna } from '../auth.js';
import { bungkus, GalatPermintaan, wajibTeks } from '../http.js';

export const rutAuth = Router();

rutAuth.post(
  '/login',
  bungkus(async (req, res) => {
    const username = wajibTeks(req.body?.username, 'Username').toLowerCase();
    const sandi = wajibTeks(req.body?.kata_sandi, 'Kata sandi');

    const baris = await db.satu<Pengguna & { kata_sandi: string }>(
      `SELECT id, username, nama, peran, karyawan_id, customer_id, kata_sandi
       FROM pengguna WHERE lower(username) = $1 AND aktif = true`,
      [username]
    );

    /* Pesan yang sama untuk username salah dan sandi salah, agar halaman masuk
       tidak bisa dipakai memetakan akun mana yang ada. */
    if (!baris || !cekSandi(sandi, baris.kata_sandi)) {
      throw new GalatPermintaan('Username atau kata sandi salah.', 401);
    }

    const pengguna: Pengguna = {
      id: baris.id,
      username: baris.username,
      nama: baris.nama,
      peran: baris.peran,
      karyawan_id: baris.karyawan_id,
      customer_id: baris.customer_id,
    };
    /* Status customer ikut dikirim agar katalog tahu apakah pemesanan sudah
       boleh dibuka — tanpa ini buyer baru mengisi keranjang sampai checkout
       lalu ditolak, dan tidak ada yang menjelaskan kenapa. */
    const statusCustomer = pengguna.customer_id
      ? (await db.satu<{ status: string }>('SELECT status FROM customer WHERE id = $1', [pengguna.customer_id]))?.status
      : null;

    res.json({
      token: buatToken(pengguna),
      pengguna: { ...pengguna, status_customer: statusCustomer ?? null },
      modul: AKSES_MODUL[pengguna.peran],
    });
  })
);

rutAuth.get(
  '/saya',
  wajibMasuk,
  bungkus(async (req, res) => {
    const p = req.pengguna!;
    const statusCustomer = p.customer_id
      ? (await db.satu<{ status: string }>('SELECT status FROM customer WHERE id = $1', [p.customer_id]))?.status
      : null;
    res.json({ pengguna: { ...p, status_customer: statusCustomer ?? null }, modul: AKSES_MODUL[p.peran] });
  })
);

/**
 * Pendaftaran mandiri.
 *
 * Hanya menghasilkan akun buyer, tidak pernah akun karyawan. Peran gudang,
 * sales, dan driver memegang stok, harga, dan uang; akun untuk peran itu dibuat
 * owner atau admin lewat `npm run akun`. Bila peran karyawan bisa didaftarkan
 * sendiri, siapa pun yang memasang APK ini bisa memberi dirinya akses ke
 * seluruh gudang.
 *
 * Customer yang lahir dari sini berstatus 'menunggu': boleh melihat katalog,
 * belum boleh memesan. Distributor mengantar ke alamat sungguhan dan kerap
 * memberi tempo, jadi harus ada orang yang memeriksa lebih dulu.
 */
rutAuth.post(
  '/daftar',
  bungkus(async (req, res) => {
    const b = req.body ?? {};
    const username = wajibTeks(b.username, 'Username').toLowerCase();
    const sandi = wajibTeks(b.kata_sandi, 'Kata sandi');
    const namaToko = wajibTeks(b.nama_toko, 'Nama toko');
    const noHp = wajibTeks(b.no_hp, 'Nomor HP');
    const alamat = wajibTeks(b.alamat, 'Alamat');
    const namaPemilik = String(b.nama ?? '').trim() || namaToko;

    if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
      throw new GalatPermintaan('Username hanya boleh huruf kecil, angka, titik, garis bawah, dan strip (3–24 karakter).');
    }
    if (sandi.length < 8) throw new GalatPermintaan('Kata sandi minimal 8 karakter.');

    const digit = noHp.replace(/\D/g, '');
    if (digit.length < 9 || digit.length > 15) throw new GalatPermintaan('Nomor HP tidak sesuai.');

    await transaksi(async (k) => {
      if (await k.satu('SELECT 1 FROM pengguna WHERE lower(username) = $1', [username])) {
        throw new GalatPermintaan('Username itu sudah dipakai. Coba yang lain.', 409);
      }
      /* Nomor HP jadi penanda utama: distributor menelepon nomor inilah untuk
         memastikan tokonya benar ada sebelum mengaktifkan. Satu nomor satu
         akun, supaya satu orang tidak bisa memenuhi daftar dengan toko palsu. */
      if (await k.satu('SELECT 1 FROM customer WHERE no_hp = $1', [noHp])) {
        throw new GalatPermintaan('Nomor HP itu sudah terdaftar. Hubungi admin bila ini toko Anda.', 409);
      }

      const customer = await k.satu<{ id: number }>(
        `INSERT INTO customer (nama, alamat, no_hp, tipe, status)
         VALUES ($1, $2, $3, 'toko', 'menunggu') RETURNING id`,
        [namaToko, alamat, noHp]
      );
      await k.jalankan(
        `INSERT INTO pengguna (username, nama, no_hp, kata_sandi, peran, customer_id)
         VALUES ($1, $2, $3, $4, 'buyer', $5)`,
        [username, namaPemilik, noHp, hashSandi(sandi), customer!.id]
      );
    });

    res.status(201).json({
      ok: true,
      pesan:
        'Pendaftaran diterima. Anda sudah bisa masuk dan melihat katalog; ' +
        'pemesanan aktif setelah admin memverifikasi toko Anda lewat nomor HP yang didaftarkan.',
    });
  })
);
