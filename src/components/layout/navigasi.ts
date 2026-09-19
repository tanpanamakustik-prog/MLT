import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck, BarChart3, Boxes, CalendarCheck, ClipboardList, FileText, LayoutDashboard,
  Package, Receipt, Settings, ShoppingCart, Store, Truck, Users, Warehouse,
} from 'lucide-react';

export interface ButirMenu {
  label: string;
  ke: string;
  ikon?: LucideIcon;
  /* Nama modul pada AKSES_MODUL di server. Menu disembunyikan bila peran tidak
     memilikinya; rutenya sendiri tetap dijaga server. */
  modul: string;
  anak?: Array<{ label: string; ke: string }>;
}

export const MENU: ButirMenu[] = [
  { label: 'Dashboard', ke: '/', ikon: LayoutDashboard, modul: 'dashboard' },
  {
    label: 'Penjualan', ke: '/penjualan', ikon: ShoppingCart, modul: 'penjualan',
    anak: [
      { label: 'Pesanan', ke: '/penjualan' },
      { label: 'Pesanan Baru', ke: '/penjualan/baru' },
      { label: 'Produk', ke: '/produk' },
    ],
  },
  {
    label: 'Inventory', ke: '/inventory', ikon: Boxes, modul: 'inventory',
    anak: [
      { label: 'Stok', ke: '/inventory' },
      { label: 'Mutasi Stok', ke: '/inventory/mutasi' },
      { label: 'Stock Opname', ke: '/inventory/opname' },
    ],
  },
  {
    label: 'Kulakan', ke: '/kulakan', ikon: Warehouse, modul: 'kulakan',
    anak: [
      { label: 'Saran Pembelian', ke: '/kulakan' },
      { label: 'Purchase Order', ke: '/kulakan/po' },
      { label: 'Supplier', ke: '/kulakan/supplier' },
    ],
  },
  { label: 'Pengiriman', ke: '/pengiriman', ikon: Truck, modul: 'pengiriman' },
  { label: 'Customer', ke: '/customer', ikon: Store, modul: 'customer' },
  {
    label: 'Karyawan', ke: '/karyawan', ikon: Users, modul: 'karyawan',
    anak: [
      { label: 'Data Karyawan', ke: '/karyawan' },
      { label: 'Absensi', ke: '/karyawan/absensi' },
      { label: 'Aktivitas', ke: '/karyawan/aktivitas' },
    ],
  },
  {
    label: 'Laporan', ke: '/laporan', ikon: BarChart3, modul: 'laporan',
    anak: [
      { label: 'Rekap Periode', ke: '/laporan' },
      { label: 'Produk', ke: '/laporan/produk' },
      { label: 'Kulakan', ke: '/laporan/kulakan' },
      { label: 'Karyawan', ke: '/laporan/karyawan' },
      { label: 'Tahunan & YoY', ke: '/laporan/tahunan' },
    ],
  },
  { label: 'Audit Log', ke: '/audit', ikon: ClipboardList, modul: 'audit' },
  { label: 'Pengaturan', ke: '/pengaturan', ikon: Settings, modul: 'pengaturan' },

  /* Dua menu di bawah hanya dimiliki peran buyer; dipakai APK. */
  { label: 'Katalog', ke: '/katalog', ikon: Package, modul: 'katalog' },
  { label: 'Pesanan Saya', ke: '/pesanan-saya', ikon: Receipt, modul: 'pesanan-saya' },
];

/* Menu lapangan untuk bilah bawah di APK: absensi dan pengiriman adalah dua hal
   yang dibuka karyawan puluhan kali sehari. */
export const MENU_LAPANGAN: ButirMenu[] = [
  { label: 'Absen', ke: '/lapangan/absen', ikon: CalendarCheck, modul: 'absensi' },
  { label: 'Kiriman', ke: '/pengiriman', ikon: Truck, modul: 'pengiriman' },
  { label: 'Aktivitas', ke: '/karyawan/aktivitas', ikon: BadgeCheck, modul: 'aktivitas' },
  { label: 'Laporan', ke: '/laporan', ikon: FileText, modul: 'laporan' },
];
