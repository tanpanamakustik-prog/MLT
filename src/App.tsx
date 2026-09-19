import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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

import Login from './pages/Login';
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

  if (!pengguna) return <Login />;

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
