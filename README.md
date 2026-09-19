# MLT

Sistem manajemen distributor untuk **MLT — Mas Lukman Telur** — web dashboard dan APK Android dari
satu basis kode. Mencakup penjualan, inventory, kulakan, pengiriman, absensi,
aktivitas karyawan, dan pelaporan harian sampai tahunan.

## Menjalankan

```bash
npm install
cp .env.example .env         # ganti JWT_SECRET sebelum dipakai di luar laptop
npm run reset -- --ya        # database kosong + satu akun owner
npm run dev                  # http://localhost:3335
```

`npm run reset` menampilkan kata sandi owner sekali saja. Untuk menentukan
sendiri: `npm run reset -- --ya --username aji --sandi "..."`.

Perintah lain: `npm run build` (produksi), `npm start` (jalankan hasil build),
`npm run lint` (typecheck), `npm run android` (build + buka Android Studio).

## Mengisi sistem yang masih kosong

1. Masuk sebagai owner, buka **Pengaturan**: nama usaha, titik dan radius
   absensi, parameter saran kulakan.
2. **Kulakan → Supplier**, lalu **Penjualan → Produk** (kategori dibuat lewat
   API `POST /api/master/kategori`).
3. **Karyawan → Data Karyawan**, lalu buatkan akunnya:

   ```bash
   npm run akun -- --daftar
   npm run akun -- --username budi --nama "Budi Santoso" --peran gudang
   npm run akun -- --username andi --nama "Andi" --peran driver --karyawan-id 3
   npm run akun -- --username budi --sandi "baru"        # ganti kata sandi
   npm run akun -- --username budi --nonaktif
   ```

   Peran `gudang`, `sales`, dan `driver` perlu `--karyawan-id` agar bisa memakai
   absensi dan aktivitas; peran `buyer` perlu `--customer-id`.
4. Stok awal masuk lewat **penerimaan kulakan** atau **stock opname** — tidak
   ada kolom stok awal di form produk, supaya setiap penambahan stok punya
   asal-usul yang bisa ditelusuri.

## Data contoh untuk pengembangan

`npm run seed` mengisi database dengan dua tahun transaksi buatan (~5.400
pesanan, enam akun peran dengan kata sandi `demo1234`) agar modul laporan bisa
dinilai tanpa menunggu data sungguhan terkumpul.

> `npm run seed` dan `npm run reset` sama-sama **menghapus seluruh isi
> database**. Jangan dijalankan pada data sungguhan.

## Susunan

```
server.ts          Express + Vite (dev) / berkas statis (produksi), satu proses
backend/
  db.ts            Skema SQLite dan pengaturan
  auth.ts          JWT, middleware peran, peta akses modul
  stok.ts          Satu-satunya pintu perubahan stok
  kulakan-cerdas.ts  Perhitungan titik pesan dan saran pembelian
  audit.ts         Jejak audit
  routes/          auth, master, penjualan, inventory, kulakan, operasional, laporan
src/
  pages/           Satu berkas per halaman
  components/      layout (shell, sidebar), ui (primitif, grafik, KPI), common
  lib/             api, format rupiah/tanggal, GPS dan kamera
scripts/seed.ts    Pembangkit data contoh
```

Teknologi: React 19, Vite 6, Tailwind 4, Recharts, Express 4, better-sqlite3,
Capacitor 8.

## Keputusan yang perlu diketahui

**Uang disimpan sebagai INTEGER rupiah penuh.** Bukan REAL. Harga bahan pokok
tidak memakai sen, sementara REAL membuat penjumlahan ratusan baris order
menghasilkan selisih recehan yang muncul di laporan bulanan dan tidak bisa
dijelaskan ke pemilik usaha.

**Harga beli disalin ke tiap baris pesanan saat transaksi dibuat.** Harga
kulakan berubah tiap minggu; tanpa salinan ini, laba bulan lalu ikut berubah
setiap kali harga beli hari ini diperbarui.

**Setiap perubahan stok melewati `ubahStok()`**, yang memperbarui `produk.stok`
dan menulis satu baris `mutasi_stok` dalam transaksi yang sama. Jumlah seluruh
mutasi sebuah produk karena itu selalu sama dengan stok tercatatnya. Rute mana
pun yang mengubah `produk.stok` langsung akan memutus jaminan ini.

**Stok dipotong saat pesanan dibuat, bukan saat dikirim.** Barang yang sudah
dijanjikan ke satu toko tidak boleh terlihat tersedia untuk toko berikutnya.
Pembatalan mengembalikannya, juga lewat buku besar.

**Stok tidak boleh negatif**, kecuali dari stock opname — di sana hasil hitung
fisik adalah kebenaran, termasuk ketika angkanya mengungkap stok sistem yang
selama ini kelebihan. Opname dan penyesuaian mewajibkan alasan.

**Laba kotor dihitung tanpa ongkir.** Omzet adalah seluruh yang ditagihkan;
penjualan bersih adalah subtotal dikurangi diskon. Ongkir adalah penggantian
biaya angkut, bukan hasil dagang — memasukkannya akan menaikkan margin setiap
kali ada pengiriman jauh meskipun barangnya dijual dengan margin yang sama.
Kedua angka selalu dikembalikan bersama-sama oleh API.

**Saran kulakan** memakai rumus:

```
rata-rata harian = qty terjual N hari terakhir / N        (N dapat diatur, bawaan 30)
titik pesan      = rata-rata harian × lead time + safety stock
target stok      = titik pesan + rata-rata harian × hari cakupan   (bawaan 7)
saran qty        = (target − stok), dibulatkan naik ke kelipatan pembelian
```

PRD mencontohkan stok 125, rata-rata 32/hari, lead 3 hari, safety 50 sehingga
titik pesan 146, lalu menyarankan membeli 150. Angka 150 di sana adalah titik
pesan yang dibulatkan, yang berarti barang datang tepat saat stok menyentuh
ambang lalu langsung turun lagi. Di sini pembelian diarahkan ke *target stok*
supaya setelah barang datang stoknya benar-benar berada di atas ambang. Kedua
parameter dapat diubah owner di Pengaturan.

**Perbandingan year-over-year memotong kedua tahun pada tanggal yang sama.**
Membandingkan sembilan bulan berjalan dengan dua belas bulan penuh selalu
menghasilkan pertumbuhan negatif, dan itu memberi sinyal salah justru pada
tahun yang sedang tumbuh.

**Absensi di luar radius tetap disimpan, tidak ditolak** — sopir yang mulai
hari dari gudang cabang tetap harus tercatat. Yang disimpan adalah jaraknya,
lalu ditandai untuk ditinjau owner. GPS dan foto wajib; tanpa keduanya absensi
kehilangan seluruh gunanya.

**Sidebar yang menyembunyikan menu bukan pengaman.** Setiap rute memeriksa
perannya sendiri lewat `wajibPeran`. Peta `AKSES_MODUL` di `backend/auth.ts`
adalah sumber tunggal untuk keduanya.

## Yang sudah jalan

- Auth 6 peran, produk, customer, supplier, karyawan
- Pesanan penjualan dengan potong stok transaksional, pembatalan, limit kredit
- Inventory: daftar stok berstatus, kartu stok per produk, opname, penyesuaian
- Kulakan: saran pembelian, purchase order, penerimaan sebagian
- Pengiriman: penugasan driver, alur status berjejak GPS, bukti foto penerimaan
- Absensi GPS + selfie dengan validasi radius; aktivitas karyawan
- Dashboard owner dan laporan harian/mingguan/bulanan/semester/tahunan + YoY
- Laporan produk, kulakan, karyawan; ekspor Excel dan cetak/PDF
- Audit log, pengaturan, mode gelap, tata letak sampai lebar 390px

## Yang belum

- Notifikasi (§26 PRD) — alert stok, kulakan, absensi, delivery belum ada
- Faktur/invoice sebagai dokumen tersendiri; saat ini rincian pesanan dicetak
- Pembayaran bertahap: `status_bayar` menyimpan tahap, bukan riwayat cicilan
- Tanda tangan penerima: kolom `ttd_url` sudah ada, layar tanda tangannya belum
- Manajemen akun pengguna lewat antarmuka; akun masih dibuat lewat `npm run akun`
- Form kategori produk di antarmuka; masih lewat API
- Phase 4 PRD: forecasting, deteksi anomali
