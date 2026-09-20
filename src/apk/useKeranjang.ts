import { useCallback, useEffect, useState } from 'react';

const KUNCI = 'mlt.keranjang';

/**
 * Isi keranjang, bertahan di ponsel.
 *
 * Disimpan di localStorage, bukan di state satu layar: pembeli berpindah antara
 * katalog dan keranjang lewat bilah bawah, dan tiap perpindahan melepas layar
 * sebelumnya. Isinya juga selamat ketika aplikasi ditutup di tengah memilih
 * barang, yang di lapangan lebih sering terjadi daripada sekali duduk selesai.
 *
 * Peristiwa 'storage' tidak terpicu pada tab yang menulis, jadi perubahan
 * disiarkan sendiri agar bilah bawah dan layar keranjang ikut berubah seketika.
 */
const PERISTIWA = 'mlt:keranjang';

function baca(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(KUNCI) ?? '{}');
  } catch {
    return {};
  }
}

function tulis(isi: Record<number, number>) {
  localStorage.setItem(KUNCI, JSON.stringify(isi));
  window.dispatchEvent(new Event(PERISTIWA));
}

export function useKeranjang() {
  const [isi, setIsi] = useState<Record<number, number>>(baca);

  useEffect(() => {
    const segarkan = () => setIsi(baca());
    window.addEventListener(PERISTIWA, segarkan);
    window.addEventListener('storage', segarkan);
    return () => {
      window.removeEventListener(PERISTIWA, segarkan);
      window.removeEventListener('storage', segarkan);
    };
  }, []);

  const ubah = useCallback((produkId: number, qty: number, stok: number) => {
    const baru = { ...baca() };
    const nilai = Math.max(0, Math.min(stok, qty));
    if (nilai === 0) delete baru[produkId];
    else baru[produkId] = nilai;
    tulis(baru);
  }, []);

  const kosongkan = useCallback(() => tulis({}), []);

  const jumlahJenis = Object.keys(isi).length;
  return { isi, ubah, kosongkan, jumlahJenis };
}
