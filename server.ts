/* dotenv dimuat sebagai impor pertama, bukan dipanggil di badan berkas.
   Modul di bawah membaca process.env saat dievaluasi — db.ts untuk DB_PATH dan
   auth.ts untuk JWT_SECRET — dan impor ESM dijalankan sebelum baris kode mana
   pun di sini. Memanggil dotenv.config() belakangan berarti keduanya sudah
   terlanjur membaca lingkungan yang kosong. */
import 'dotenv/config';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';

import { initDb } from './backend/db.js';
import { penangananGalat } from './backend/http.js';
import { rutAuth } from './backend/routes/auth.js';
import { rutInventory } from './backend/routes/inventory.js';
import { rutKulakan } from './backend/routes/kulakan.js';
import { rutLaporan } from './backend/routes/laporan.js';
import { rutMaster } from './backend/routes/master.js';
import { rutOperasional } from './backend/routes/operasional.js';
import { rutPenjualan } from './backend/routes/penjualan.js';

initDb();

const app = express();
const PORT = Number(process.env.PORT) || 4040;
const PRODUKSI = process.env.NODE_ENV === 'production';

app.use(compression());
/* Batas 8 MB, bukan bawaan 100 KB: foto absensi dan bukti kirim dikirim APK
   sebagai data URL base64, yang membengkakkan berkas sekitar sepertiga. */
app.use(express.json({ limit: '8mb' }));

/* Capacitor memuat halaman dari asalnya sendiri, bukan dari server ini, jadi
   asal-asal tersebut harus disebut. Daftar tertutup, bukan '*', karena
   permintaan ke API ini membawa token bearer. */
app.use(
  cors({
    origin: [
      'http://localhost:4040',
      'http://localhost:5173',
      'http://localhost',
      'capacitor://localhost',
      ...(process.env.ASAL_TAMBAHAN ?? '').split(',').filter(Boolean),
    ],
  })
);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
  /* Jawaban API berisi angka penjualan dan data customer; tidak boleh mengendap
     di singgahan perantara mana pun. */
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/sehat', (_req, res) => res.json({ ok: true, waktu: new Date().toISOString() }));

app.use('/api/auth', rutAuth);
app.use('/api/master', rutMaster);
app.use('/api/penjualan', rutPenjualan);
app.use('/api/inventory', rutInventory);
app.use('/api/kulakan', rutKulakan);
app.use('/api/operasional', rutOperasional);
app.use('/api/laporan', rutLaporan);

fs.mkdirSync('uploads', { recursive: true });
app.use('/uploads', express.static('uploads', { maxAge: '7d' }));

app.use('/api', (_req, res) => res.status(404).json({ pesan: 'Endpoint tidak ditemukan.' }));
app.use(penangananGalat);

async function jalankan() {
  if (PRODUKSI) {
    const akar = path.resolve('dist');
    app.use(express.static(akar, { index: false }));
    /* Semua jalur non-API dikembalikan ke index.html agar rute React yang
       dibuka langsung, misalnya /laporan/bulanan, tidak menghasilkan 404. */
    app.get('*', (_req, res) => res.sendFile(path.join(akar, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`DistribusiHub berjalan di http://localhost:${PORT} (${PRODUKSI ? 'produksi' : 'pengembangan'})`);
  });
}

jalankan();
