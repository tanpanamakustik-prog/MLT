/**
 * Monogram MLT.
 *
 * Inti logo usaha: M merah, L emas, T hitam di atas ubin krem. Tiap huruf
 * digambar dua kali — sekali sebagai goresan gelap yang lebih tebal, lalu
 * warnanya di atasnya — sehingga tersisa rim gelap tipis mengelilingi huruf,
 * perlakuan yang sama seperti pada logo aslinya. Rim itu bukan hiasan: emas di
 * atas krem hanya berkontras 1,9:1 dan tanpa rim huruf L akan lenyap.
 *
 * Dibuat dari goresan lurus, bukan huruf dari font sistem, supaya bentuknya
 * tetap sama di perangkat mana pun dan tetap terbaca sampai ukuran 24px.
 */
/* Kotak huruf 10..38 pada kanvas 48, dengan rim 5,2 yang melebar 2,6 ke tiap
   sisi: menyisakan sekitar 7 satuan napas ke tepi ubin. Digambar sampai tepi,
   monogramnya terasa sesak justru pada ukuran kecil, saat ia paling sering
   dilihat. */
const GORESAN = [
  { d: 'M 10 33 L 10 17 L 14 25.5 L 18 17 L 18 33', warna: 'var(--dh-logo-m)' },
  { d: 'M 21 17 L 21 33 L 27.5 33', warna: 'var(--dh-logo-l)' },
  { d: 'M 30.5 17 L 38 17 M 34.25 17 L 34.25 33', warna: 'var(--dh-logo-t)' },
];

export function LogoMLT({ ukuran = 32, className }: { ukuran?: number; className?: string }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="MLT"
    >
      <rect width="48" height="48" rx="11" fill="var(--dh-logo-ubin)" />
      <g fill="none" strokeLinecap="square" strokeLinejoin="miter">
        {GORESAN.map((g) => (
          <path key={g.d} d={g.d} stroke="var(--dh-logo-rim)" strokeWidth="5.2" />
        ))}
        {GORESAN.map((g) => (
          <path key={g.d} d={g.d} stroke={g.warna} strokeWidth="2.9" />
        ))}
      </g>
    </svg>
  );
}

/**
 * Mahkota dari logo, dipakai sebagai aksen kecil.
 *
 * Geometri murni: tiga puncak dan satu alas. Bukan gambar, jadi tetap tajam di
 * ukuran berapa pun dan tidak menuntut berkas aset terpisah.
 */
export function Mahkota({ ukuran = 14, className }: { ukuran?: number; className?: string }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M3 9.5 L7 13 L12 5.5 L17 13 L21 9.5 L19.4 18.5 L4.6 18.5 Z" />
    </svg>
  );
}
