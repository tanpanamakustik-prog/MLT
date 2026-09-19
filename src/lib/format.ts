/** Rupiah penuh tanpa desimal — harga bahan pokok tidak memakai sen. */
export const rupiah = (n: number | null | undefined): string =>
  `Rp${Math.round(Number(n ?? 0)).toLocaleString('id-ID')}`;

/**
 * Rupiah ringkas untuk kartu KPI dan sumbu grafik.
 *
 * Angka omzet distributor cepat menyentuh miliaran; ditulis penuh, nilainya
 * memakan lebar kartu dan membuat dua KPI bersebelahan tidak bisa dibandingkan
 * sekilas. Nilai penuh tetap tersedia lewat atribut title dan tabel.
 */
export function rupiahRingkas(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  const tanda = v < 0 ? '−' : '';
  const a = Math.abs(v);
  /* Koma sebagai pemisah desimal, titik sebagai pemisah ribuan — kebalikan dari
     bawaan toFixed. Rp9.47 M terbaca sebagai sembilan juta empat ratus ribu
     oleh pembaca Indonesia, bukan sembilan koma empat tujuh miliar. */
  const desimal = (x: number, digit: number) => x.toFixed(digit).replace('.', ',');
  if (a >= 1_000_000_000) return `${tanda}Rp${desimal(a / 1_000_000_000, a >= 10_000_000_000 ? 1 : 2)} M`;
  if (a >= 1_000_000) return `${tanda}Rp${desimal(a / 1_000_000, a >= 10_000_000 ? 0 : 1)} jt`;
  if (a >= 1_000) return `${tanda}Rp${desimal(a / 1_000, 0)} rb`;
  return `${tanda}Rp${a}`;
}

/* Tanda minus matematis (U+2212), bukan tanda hubung. Keduanya bercampur dalam
   satu kolom terbaca sebagai dua hal berbeda, dan tanda hubung lebih pendek
   sehingga angka negatif tampak tidak sejajar pada kolom bertabular. */
export const angka = (n: number | null | undefined): string =>
  Number(n ?? 0).toLocaleString('id-ID').replace('-', '\u2212');

export const persen = (n: number | null | undefined, digit = 1): string =>
  n == null ? '—' : `${Number(n).toFixed(digit).replace('.', ',')}%`;

export function tanggal(t: string | null | undefined, gaya: 'pendek' | 'panjang' = 'pendek'): string {
  if (!t) return '—';
  const d = new Date(t.length <= 10 ? `${t}T00:00:00` : t.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('id-ID', gaya === 'panjang' ? { dateStyle: 'long' } : { day: '2-digit', month: 'short', year: 'numeric' });
}

export function waktu(t: string | null | undefined): string {
  if (!t) return '—';
  const d = new Date(t.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const jam = (t: string | null | undefined): string => (t ? t.slice(0, 5) : '—');

export const hariIniISO = (): string => new Date().toLocaleDateString('sv-SE');
