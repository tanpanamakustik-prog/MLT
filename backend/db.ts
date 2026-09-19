import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || 'data/distribusihub.sqlite';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

/* WAL supaya pembacaan laporan yang panjang tidak memblokir pencatatan
   transaksi di gudang. Distributor memakai sistem ini sambil jalan: kasir
   menginput order pada saat yang sama owner membuka rekap bulanan. */
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Seluruh nilai uang disimpan sebagai INTEGER rupiah penuh, bukan REAL.
 *
 * Harga bahan pokok tidak pernah memakai sen, sementara REAL membuat
 * penjumlahan ratusan baris order menghasilkan selisih recehan yang muncul di
 * laporan bulanan dan tidak bisa dijelaskan ke pemilik usaha.
 */
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pengguna (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      nama          TEXT NOT NULL,
      email         TEXT,
      no_hp         TEXT,
      kata_sandi    TEXT NOT NULL,
      peran         TEXT NOT NULL CHECK (peran IN ('owner','admin','gudang','sales','driver','buyer')),
      karyawan_id   INTEGER REFERENCES karyawan(id),
      customer_id   INTEGER REFERENCES customer(id),
      aktif         INTEGER NOT NULL DEFAULT 1,
      dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS karyawan (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      nama              TEXT NOT NULL,
      jabatan           TEXT NOT NULL,
      no_hp             TEXT,
      status            TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','cuti','nonaktif')),
      tanggal_bergabung TEXT,
      area_kerja        TEXT,
      foto_url          TEXT
    );

    CREATE TABLE IF NOT EXISTS kategori (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      nama  TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS supplier (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nama            TEXT NOT NULL,
      alamat          TEXT,
      kontak          TEXT,
      no_hp           TEXT,
      lead_time_hari  INTEGER NOT NULL DEFAULT 3,
      aktif           INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS produk (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      sku           TEXT NOT NULL UNIQUE,
      nama          TEXT NOT NULL,
      kategori_id   INTEGER REFERENCES kategori(id),
      supplier_id   INTEGER REFERENCES supplier(id),
      satuan        TEXT NOT NULL DEFAULT 'pcs',
      harga_beli    INTEGER NOT NULL DEFAULT 0,
      harga_jual    INTEGER NOT NULL DEFAULT 0,
      stok          INTEGER NOT NULL DEFAULT 0,
      stok_minimum  INTEGER NOT NULL DEFAULT 0,
      safety_stock  INTEGER NOT NULL DEFAULT 0,
      kelipatan_beli INTEGER NOT NULL DEFAULT 1,
      foto_url      TEXT,
      aktif         INTEGER NOT NULL DEFAULT 1,
      dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS customer (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      kode          TEXT UNIQUE,
      nama          TEXT NOT NULL,
      alamat        TEXT,
      no_hp         TEXT,
      tipe          TEXT NOT NULL DEFAULT 'toko' CHECK (tipe IN ('toko','grosir','retail','horeka')),
      sales_id      INTEGER REFERENCES karyawan(id),
      limit_kredit  INTEGER NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','nonaktif','blokir')),
      lat           REAL,
      lng           REAL,
      dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pesanan (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor         TEXT NOT NULL UNIQUE,
      customer_id   INTEGER NOT NULL REFERENCES customer(id),
      sales_id      INTEGER REFERENCES karyawan(id),
      tanggal       TEXT NOT NULL,
      subtotal      INTEGER NOT NULL DEFAULT 0,
      diskon        INTEGER NOT NULL DEFAULT 0,
      ongkir        INTEGER NOT NULL DEFAULT 0,
      total         INTEGER NOT NULL DEFAULT 0,
      hpp_total     INTEGER NOT NULL DEFAULT 0,
      status_bayar  TEXT NOT NULL DEFAULT 'belum' CHECK (status_bayar IN ('belum','sebagian','lunas')),
      status_kirim  TEXT NOT NULL DEFAULT 'baru' CHECK (status_kirim IN ('baru','diproses','dikirim','selesai','batal')),
      catatan       TEXT,
      dibuat_oleh   INTEGER REFERENCES pengguna(id),
      dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    /* harga_beli disalin ke tiap baris saat transaksi dibuat, bukan dibaca dari
       produk saat laporan dijalankan. Harga kulakan bahan pokok berubah tiap
       minggu; tanpa salinan ini, profit bulan lalu ikut berubah setiap kali
       harga beli hari ini diperbarui. */
    CREATE TABLE IF NOT EXISTS pesanan_item (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      pesanan_id  INTEGER NOT NULL REFERENCES pesanan(id) ON DELETE CASCADE,
      produk_id   INTEGER NOT NULL REFERENCES produk(id),
      qty         INTEGER NOT NULL,
      harga       INTEGER NOT NULL,
      harga_beli  INTEGER NOT NULL DEFAULT 0,
      subtotal    INTEGER NOT NULL
    );

    /* Buku besar stok. Setiap perubahan stok produk wajib menulis satu baris di
       sini pada transaksi yang sama, supaya stok akhir selalu bisa ditelusuri
       balik ke asalnya. */
    CREATE TABLE IF NOT EXISTS mutasi_stok (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      produk_id     INTEGER NOT NULL REFERENCES produk(id),
      tipe          TEXT NOT NULL CHECK (tipe IN ('masuk','keluar','adjustment')),
      qty           INTEGER NOT NULL,
      stok_sebelum  INTEGER NOT NULL,
      stok_sesudah  INTEGER NOT NULL,
      ref_tipe      TEXT,
      ref_id        INTEGER,
      catatan       TEXT,
      oleh          INTEGER REFERENCES pengguna(id),
      waktu         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pembelian (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor         TEXT NOT NULL UNIQUE,
      supplier_id   INTEGER NOT NULL REFERENCES supplier(id),
      tanggal       TEXT NOT NULL,
      total         INTEGER NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','dipesan','diterima','batal')),
      catatan       TEXT,
      dibuat_oleh   INTEGER REFERENCES pengguna(id),
      dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pembelian_item (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      pembelian_id  INTEGER NOT NULL REFERENCES pembelian(id) ON DELETE CASCADE,
      produk_id     INTEGER NOT NULL REFERENCES produk(id),
      qty           INTEGER NOT NULL,
      qty_diterima  INTEGER NOT NULL DEFAULT 0,
      harga         INTEGER NOT NULL,
      subtotal      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pengiriman (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor         TEXT NOT NULL UNIQUE,
      pesanan_id    INTEGER NOT NULL REFERENCES pesanan(id),
      driver_id     INTEGER REFERENCES karyawan(id),
      status        TEXT NOT NULL DEFAULT 'ditugaskan'
                    CHECK (status IN ('ditugaskan','berangkat','sampai','bongkar','diterima','selesai','gagal')),
      dimulai_pada  TEXT,
      selesai_pada  TEXT,
      penerima      TEXT,
      foto_url      TEXT,
      ttd_url       TEXT,
      lat           REAL,
      lng           REAL,
      catatan       TEXT,
      dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS aktivitas (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      karyawan_id   INTEGER NOT NULL REFERENCES karyawan(id),
      jenis         TEXT NOT NULL,
      waktu         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      lat           REAL,
      lng           REAL,
      foto_url      TEXT,
      pesanan_id    INTEGER REFERENCES pesanan(id),
      pengiriman_id INTEGER REFERENCES pengiriman(id),
      catatan       TEXT
    );

    CREATE TABLE IF NOT EXISTS absensi (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      karyawan_id   INTEGER NOT NULL REFERENCES karyawan(id),
      tanggal       TEXT NOT NULL,
      jam_masuk     TEXT,
      lat_masuk     REAL,
      lng_masuk     REAL,
      foto_masuk    TEXT,
      jarak_masuk_m INTEGER,
      jam_pulang    TEXT,
      lat_pulang    REAL,
      lng_pulang    REAL,
      foto_pulang   TEXT,
      jarak_pulang_m INTEGER,
      status        TEXT NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir','terlambat','izin','sakit','alpha')),
      UNIQUE (karyawan_id, tanggal)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES pengguna(id),
      nama_user   TEXT,
      aksi        TEXT NOT NULL,
      entitas     TEXT NOT NULL,
      entitas_id  INTEGER,
      ringkasan   TEXT,
      nilai_lama  TEXT,
      nilai_baru  TEXT,
      waktu       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pengaturan (
      kunci TEXT PRIMARY KEY,
      nilai TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pesanan_tanggal   ON pesanan(tanggal);
    CREATE INDEX IF NOT EXISTS idx_pesanan_customer  ON pesanan(customer_id);
    CREATE INDEX IF NOT EXISTS idx_item_pesanan      ON pesanan_item(pesanan_id);
    CREATE INDEX IF NOT EXISTS idx_item_produk       ON pesanan_item(produk_id);
    CREATE INDEX IF NOT EXISTS idx_mutasi_produk     ON mutasi_stok(produk_id, waktu);
    CREATE INDEX IF NOT EXISTS idx_pembelian_tanggal ON pembelian(tanggal);
    CREATE INDEX IF NOT EXISTS idx_absensi_tanggal   ON absensi(tanggal);
    CREATE INDEX IF NOT EXISTS idx_aktivitas_waktu   ON aktivitas(karyawan_id, waktu);
    CREATE INDEX IF NOT EXISTS idx_audit_waktu       ON audit_log(waktu);
  `);
}

/** Pengaturan disimpan sebagai pasangan kunci-nilai agar owner bisa mengubah
    radius absensi atau hari cakupan kulakan tanpa rilis ulang. */
export function ambilPengaturan(kunci: string, bawaan: string): string {
  const baris = db.prepare('SELECT nilai FROM pengaturan WHERE kunci = ?').get(kunci) as { nilai: string } | undefined;
  return baris?.nilai ?? bawaan;
}

export function simpanPengaturan(kunci: string, nilai: string) {
  db.prepare(
    'INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai'
  ).run(kunci, nilai);
}
