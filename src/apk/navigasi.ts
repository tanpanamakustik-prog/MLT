import type { LucideIcon } from 'lucide-react';
import {
  Boxes, CalendarCheck, ClipboardList, Home, Package, Receipt, ShoppingBag,
  ShoppingCart, Store, Truck, User, Warehouse,
} from 'lucide-react';
import type { Peran } from '../context/AuthContext';

export interface Tab {
  label: string;
  ke: string;
  ikon: LucideIcon;
}

/**
 * Bilah bawah per peran.
 *
 * Tiga sampai empat tab, bukan seluruh menu. Yang dipakai di lapangan hanya
 * beberapa layar dan dibuka puluhan kali sehari — sopir membuka daftar kiriman
 * dan tombol absen, bukan laporan tahunan. Menu lengkap tetap ada di tab Akun,
 * jadi tidak ada yang hilang, hanya tidak ikut berebut tempat di ibu jari.
 */
export const TAB: Record<Peran, Tab[]> = {
  buyer: [
    { label: 'Katalog', ke: '/a', ikon: ShoppingBag },
    { label: 'Keranjang', ke: '/a/keranjang', ikon: ShoppingCart },
    { label: 'Pesanan', ke: '/a/pesanan', ikon: Receipt },
    { label: 'Akun', ke: '/a/akun', ikon: User },
  ],
  driver: [
    { label: 'Kiriman', ke: '/a', ikon: Truck },
    { label: 'Absen', ke: '/a/absen', ikon: CalendarCheck },
    { label: 'Aktivitas', ke: '/a/aktivitas', ikon: ClipboardList },
    { label: 'Akun', ke: '/a/akun', ikon: User },
  ],
  sales: [
    { label: 'Beranda', ke: '/a', ikon: Home },
    { label: 'Pesanan', ke: '/a/pesanan', ikon: Receipt },
    { label: 'Customer', ke: '/a/customer', ikon: Store },
    { label: 'Akun', ke: '/a/akun', ikon: User },
  ],
  gudang: [
    { label: 'Beranda', ke: '/a', ikon: Home },
    { label: 'Stok', ke: '/a/stok', ikon: Boxes },
    { label: 'Kulakan', ke: '/a/kulakan', ikon: Warehouse },
    { label: 'Akun', ke: '/a/akun', ikon: User },
  ],
  owner: [
    { label: 'Beranda', ke: '/a', ikon: Home },
    { label: 'Penjualan', ke: '/a/pesanan', ikon: Receipt },
    { label: 'Stok', ke: '/a/stok', ikon: Boxes },
    { label: 'Akun', ke: '/a/akun', ikon: User },
  ],
  admin: [
    { label: 'Beranda', ke: '/a', ikon: Home },
    { label: 'Penjualan', ke: '/a/pesanan', ikon: Receipt },
    { label: 'Stok', ke: '/a/stok', ikon: Boxes },
    { label: 'Akun', ke: '/a/akun', ikon: User },
  ],
};

/** Pintasan di beranda: pekerjaan yang paling sering dibuka tiap peran. */
export const PINTASAN: Record<Peran, Array<{ label: string; ke: string; ikon: LucideIcon }>> = {
  buyer:  [{ label: 'Katalog', ke: '/a', ikon: ShoppingBag }, { label: 'Pesanan saya', ke: '/a/pesanan', ikon: Receipt }],
  driver: [
    { label: 'Absen', ke: '/a/absen', ikon: CalendarCheck },
    { label: 'Kiriman hari ini', ke: '/a', ikon: Truck },
    { label: 'Aktivitas', ke: '/a/aktivitas', ikon: ClipboardList },
  ],
  sales: [
    { label: 'Pesanan baru', ke: '/a/pesanan/baru', ikon: Package },
    { label: 'Customer', ke: '/a/customer', ikon: Store },
    { label: 'Absen', ke: '/a/absen', ikon: CalendarCheck },
  ],
  gudang: [
    { label: 'Stok', ke: '/a/stok', ikon: Boxes },
    { label: 'Saran kulakan', ke: '/a/kulakan', ikon: Warehouse },
    { label: 'Opname', ke: '/a/opname', ikon: ClipboardList },
    { label: 'Absen', ke: '/a/absen', ikon: CalendarCheck },
  ],
  owner: [
    { label: 'Penjualan', ke: '/a/pesanan', ikon: Receipt },
    { label: 'Stok', ke: '/a/stok', ikon: Boxes },
    { label: 'Kulakan', ke: '/a/kulakan', ikon: Warehouse },
    { label: 'Customer', ke: '/a/customer', ikon: Store },
  ],
  admin: [
    { label: 'Pesanan baru', ke: '/a/pesanan/baru', ikon: Package },
    { label: 'Penjualan', ke: '/a/pesanan', ikon: Receipt },
    { label: 'Stok', ke: '/a/stok', ikon: Boxes },
    { label: 'Customer', ke: '/a/customer', ikon: Store },
  ],
};
