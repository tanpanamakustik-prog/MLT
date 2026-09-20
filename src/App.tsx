import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { diAplikasi } from './lib/api';
import { KerangkaApk } from './apk/Kerangka';
import { AppShell } from './components/layout/AppShell';
import { Kartu, Kosong, Memuat } from './components/ui/Dasar';
import { useAuth } from './context/AuthContext';

/* Dashboard dan laporan dimuat terpisah: keduanya menarik pustaka grafik yang
   besar, sementara driver dan sales hampir tidak pernah membukanya. */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LaporanRingkas = lazy(() => import('./pages/laporan/Ringkas'));
const LaporanProduk = lazy(() => import('./pages/laporan/Produk'));
const LaporanKulakan = lazy(() => import('./pages/laporan/Kulakan'));
const LaporanKaryawan = lazy(() => import('./pages/laporan/Karyawan'));
const LaporanTahunan = lazy(() => import('./pages/laporan/Tahunan'));

/* Layar khusus APK. Dipisah dari halaman web, bukan dibuat responsif dari
   halaman yang sama: yang dibutuhkan di lapangan berbeda urutannya, bukan
   sekadar berbeda lebarnya. Sopir membuka daftar kiriman dan tombol absen;
   tabel dua belas kolom yang mengecil tidak menjadi layar yang baik hanya
   karena muat. */
const BerandaApk = lazy(() => import('./apk/Beranda'));
const KatalogApk = lazy(() => import('./apk/Katalog'));
const KeranjangApk = lazy(() => import('./apk/Keranjang'));
const KirimanApk = lazy(() => import('./apk/Kiriman'));
const PesananApk = lazy(() => import('./apk/Pesanan'));
const StokApk = lazy(() => import('./apk/Stok'));
const KulakanApk = lazy(() => import('./apk/Kulakan'));
const AkunApk = lazy(() => import('./apk/Akun'));

import Login from './pages/Login';
import Daftar from './pages/Daftar';
import Produk from './pages/Produk';
import Pesanan from './pages/Pesanan';
import PesananBaru from './pages/PesananBaru';
import PesananDetail from './pages/PesananDetail';
import Customer from './pages/Customer';
import CustomerDetail from './pages/CustomerDetail';
import Inventory from './pages/Inventory';
import Mutasi from './pages/Mutasi';
import Opname from './pages/Opname';
import Kulakan from './pages/Kulakan';
import PurchaseOrder from './pages/PurchaseOrder';
import Supplier from './pages/Supplier';
import Pengiriman from './pages/Pengiriman';
import PengirimanDetail from './pages/PengirimanDetail';
import Karyawan from './pages/Karyawan';
import Absensi from './pages/Absensi';
import Aktivitas from './pages/Aktivitas';
import Absen from './pages/lapangan/Absen';
import Audit from './pages/Audit';
import Pengaturan from './pages/Pengaturan';
import Katalog from './pages/Katalog';
import PesananSaya from './pages/PesananSaya';

/**
 * Penjaga rute berdasarkan modul yang dimiliki peran.
 *
 * Daftar modul datang dari server, sumber yang sama dengan yang dipakai
 * memasang wajibPeran di tiap endpoint. Penjaga ini hanya mencegah halaman
 * kosong dan pesan galat yang membingungkan — data tetap dijaga di server.
 */
function Jaga({ modul, children }: { modul: string; children: React.ReactNode }) {
  const { modul: dimiliki } = useAuth();
  if (!dimiliki.includes(modul)) {
    return (
      <Kartu>
        <Kosong pesan="Peran Anda tidak memiliki akses ke halaman ini. Hubungi admin bila seharusnya punya." />
      </Kartu>
    );
  }
  return <>{children}</>;
}

/** Halaman pertama berbeda per peran: buyer membuka katalog, bukan dashboard. */
function Beranda() {
  const { modul } = useAuth();
  if (modul.includes('dashboard')) return <Dashboard />;
  if (modul.includes('katalog')) return <Navigate to="/katalog" replace />;
  return <Navigate to="/lapangan/absen" replace />;
}

export default function App() {
  const { pengguna, memuat } = useAuth();

  if (memuat) {
    return (
      <div className="grid min-h-screen place-items-center bg-page">
        <Memuat />
      </div>
    );
  }

  /* Halaman masuk dan daftar punya alamatnya sendiri supaya tombol kembali
     peramban dan tautan langsung tetap bekerja. */
  if (!pengguna) {
    return (
      <Routes>
        <Route path="/daftar" element={<Daftar />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (diAplikasi()) return <AplikasiPonsel />;

  return (
    <AppShell>
      <Suspense fallback={<Memuat tinggi="h-64" />}>
      <Routes>
        <Route path="/" element={<Beranda />} />

        <Route path="/penjualan" element={<Jaga modul="penjualan"><Pesanan /></Jaga>} />
        <Route path="/penjualan/baru" element={<Jaga modul="penjualan"><PesananBaru /></Jaga>} />
        <Route path="/penjualan/:id" element={<Jaga modul="penjualan"><PesananDetail /></Jaga>} />
        <Route path="/produk" element={<Jaga modul="penjualan"><Produk /></Jaga>} />

        <Route path="/customer" element={<Jaga modul="customer"><Customer /></Jaga>} />
        <Route path="/customer/:id" element={<Jaga modul="customer"><CustomerDetail /></Jaga>} />

        <Route path="/inventory" element={<Jaga modul="inventory"><Inventory /></Jaga>} />
        <Route path="/inventory/mutasi" element={<Jaga modul="inventory"><Mutasi /></Jaga>} />
        <Route path="/inventory/opname" element={<Jaga modul="inventory"><Opname /></Jaga>} />

        <Route path="/kulakan" element={<Jaga modul="kulakan"><Kulakan /></Jaga>} />
        <Route path="/kulakan/po" element={<Jaga modul="kulakan"><PurchaseOrder /></Jaga>} />
        <Route path="/kulakan/supplier" element={<Jaga modul="kulakan"><Supplier /></Jaga>} />

        <Route path="/pengiriman" element={<Jaga modul="pengiriman"><Pengiriman /></Jaga>} />
        <Route path="/pengiriman/:id" element={<Jaga modul="pengiriman"><PengirimanDetail /></Jaga>} />

        <Route path="/karyawan" element={<Jaga modul="karyawan"><Karyawan /></Jaga>} />
        <Route path="/karyawan/absensi" element={<Jaga modul="absensi"><Absensi /></Jaga>} />
        <Route path="/karyawan/aktivitas" element={<Jaga modul="aktivitas"><Aktivitas /></Jaga>} />
        <Route path="/lapangan/absen" element={<Absen />} />

        <Route path="/laporan" element={<Jaga modul="laporan"><LaporanRingkas /></Jaga>} />
        <Route path="/laporan/produk" element={<Jaga modul="laporan"><LaporanProduk /></Jaga>} />
        <Route path="/laporan/kulakan" element={<Jaga modul="laporan"><LaporanKulakan /></Jaga>} />
        <Route path="/laporan/karyawan" element={<Jaga modul="laporan"><LaporanKaryawan /></Jaga>} />
        <Route path="/laporan/tahunan" element={<Jaga modul="laporan"><LaporanTahunan /></Jaga>} />

        <Route path="/audit" element={<Jaga modul="audit"><Audit /></Jaga>} />
        <Route path="/pengaturan" element={<Jaga modul="pengaturan"><Pengaturan /></Jaga>} />

        <Route path="/katalog" element={<Jaga modul="katalog"><Katalog /></Jaga>} />
        <Route path="/pesanan-saya" element={<Jaga modul="pesanan-saya"><PesananSaya /></Jaga>} />

        <Route path="*" element={<Kartu><Kosong pesan="Halaman tidak ditemukan." /></Kartu>} />
      </Routes>
      </Suspense>
    </AppShell>
  );
}


/**
 * Susunan rute di dalam APK.
 *
 * Beranda berbeda per peran: pembeli mendarat di katalog, sopir di daftar
 * kiriman, sisanya di ringkasan hari ini. Mendaratkan semuanya di layar yang
 * sama memaksa empat dari lima peran menekan satu tab lagi sebelum sampai ke
 * pekerjaannya.
 */
function AplikasiPonsel() {
  const { pengguna, modul } = useAuth();
  const peran = pengguna!.peran;
  const beranda = peran === 'buyer' ? <KatalogApk /> : peran === 'driver' ? <KirimanApk /> : <BerandaApk />;

  return (
    <KerangkaApk>
      <Suspense fallback={<Memuat tinggi="h-72" />}>
        <Routes>
          <Route path="/a" element={beranda} />
          <Route path="/a/keranjang" element={<Jaga modul="katalog"><KeranjangApk /></Jaga>} />
          <Route path="/a/pesanan" element={<PesananApk />} />
          <Route path="/a/pesanan/baru" element={<Jaga modul="penjualan"><PesananBaru /></Jaga>} />
          <Route path="/a/pesanan/:id" element={<PesananDetail />} />
          <Route path="/a/kiriman" element={<Jaga modul="pengiriman"><KirimanApk /></Jaga>} />
          <Route path="/a/kiriman/:id" element={<Jaga modul="pengiriman"><PengirimanDetail /></Jaga>} />
          <Route path="/a/stok" element={<Jaga modul="inventory"><StokApk /></Jaga>} />
          <Route path="/a/stok/:id" element={<Jaga modul="inventory"><Mutasi /></Jaga>} />
          <Route path="/a/opname" element={<Jaga modul="inventory"><Opname /></Jaga>} />
          <Route path="/a/kulakan" element={<Jaga modul="kulakan"><KulakanApk /></Jaga>} />
          <Route path="/a/customer" element={<Jaga modul="customer"><Customer /></Jaga>} />
          <Route path="/a/customer/:id" element={<Jaga modul="customer"><CustomerDetail /></Jaga>} />
          <Route path="/a/absen" element={<Absen />} />
          <Route path="/a/aktivitas" element={<Jaga modul="aktivitas"><Aktivitas /></Jaga>} />
          <Route path="/a/akun" element={<AkunApk />} />
          {/* Tautan lama dan alamat web apa pun dibawa ke beranda aplikasi. */}
          <Route path="*" element={<Navigate to="/a" replace />} />
        </Routes>
      </Suspense>
    </KerangkaApk>
  );
}
