import { Router } from 'express';
import { db } from '../db.js';
import { AKSES_MODUL, buatToken, cekSandi, wajibMasuk, type Pengguna } from '../auth.js';
import { bungkus, GalatPermintaan, wajibTeks } from '../http.js';

export const rutAuth = Router();

rutAuth.post(
  '/login',
  bungkus((req, res) => {
    const username = wajibTeks(req.body?.username, 'Username').toLowerCase();
    const sandi = wajibTeks(req.body?.kata_sandi, 'Kata sandi');

    const baris = db
      .prepare('SELECT * FROM pengguna WHERE lower(username) = ? AND aktif = 1')
      .get(username) as (Pengguna & { kata_sandi: string }) | undefined;

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
    res.json({ token: buatToken(pengguna), pengguna, modul: AKSES_MODUL[pengguna.peran] });
  })
);

rutAuth.get('/saya', wajibMasuk, (req, res) => {
  res.json({ pengguna: req.pengguna, modul: AKSES_MODUL[req.pengguna!.peran] });
});
