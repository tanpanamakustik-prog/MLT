import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect } from 'react';
import { AlertCircle, ChevronDown, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/cn';

/* --------------------------------------------------------------- Permukaan */

/**
 * Kartu.
 *
 * Ketinggian dinyatakan sekali saja — lewat garis tepi, bukan garis tepi
 * ditambah bayangan. Keduanya sekaligus menghasilkan kartu hantu: bingkai tipis
 * yang mengambang di atas bayangan lebar tanpa memilih mana yang menanggung
 * pemisahan.
 */
export function Kartu({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-line bg-surface', className)}>{children}</div>;
}

export function KepalaKartu({ judul, deskripsi, aksi }: { judul: ReactNode; deskripsi?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-3.5">
      <div className="min-w-0">
        <h2 className="text-sedang font-semibold tracking-[-0.01em] text-ink">{judul}</h2>
        {deskripsi && <p className="mt-0.5 text-mini text-ink-2">{deskripsi}</p>}
      </div>
      {aksi && <div className="flex shrink-0 items-center gap-2">{aksi}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Kontrol */

/**
 * Varian tombol.
 *
 * Aksi utama memakai merah merek, dan merah perusak hanya berjarak tiga derajat
 * hue darinya. Keduanya karena itu dibedakan lewat bentuk, bukan warna: aksi
 * utama berisi penuh, aksi merusak bergaris dengan latar tipis. Dibedakan warna
 * saja, tombol "Simpan" dan tombol "Batalkan pesanan" akan terlihat sama bagi
 * siapa pun yang membacanya sekilas — dan yang kedua tidak bisa dibatalkan.
 */
const GAYA_TOMBOL = {
  utama: 'bg-brand text-brand-ink hover:brightness-115 active:brightness-95',
  netral: 'border border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-kuat active:bg-surface-3',
  halus: 'bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink active:brightness-95',
  bahaya: 'border border-critical/45 bg-critical/8 text-critical-teks hover:bg-critical/16 hover:border-critical/70 active:bg-critical/24',
} as const;

interface PropTombol extends ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: keyof typeof GAYA_TOMBOL;
  sibuk?: boolean;
}

export function Tombol({ varian = 'netral', sibuk, className, children, disabled, ...sisa }: PropTombol) {
  return (
    <button
      {...sisa}
      disabled={disabled || sibuk}
      aria-busy={sibuk || undefined}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-kecil font-medium',
        'transition-[background-color,border-color,filter,opacity] duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        GAYA_TOMBOL[varian],
        className
      )}
    >
      {sibuk && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

const GAYA_MEDAN = cn(
  'h-9 w-full rounded-lg border border-line bg-surface px-3 text-kecil text-ink',
  'placeholder:text-ink-3 transition-colors duration-150',
  'hover:border-line-kuat focus:border-brand-teks focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3'
);

export function Medan({
  label,
  petunjuk,
  className,
  ...sisa
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; petunjuk?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-mini font-medium text-ink-2">{label}</span>}
      <input {...sisa} className={cn(GAYA_MEDAN, className)} />
      {petunjuk && <span className="mt-1 block text-mikro leading-snug text-ink-3">{petunjuk}</span>}
    </label>
  );
}

export function Pilihan({
  label,
  children,
  className,
  ...sisa
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-mini font-medium text-ink-2">{label}</span>}
      {/* Panah bawaan peramban diganti ikon yang sama dengan sisa antarmuka;
          panah bawaan berbeda bentuk di tiap sistem operasi. */}
      <span className="relative block">
        <select {...sisa} className={cn(GAYA_MEDAN, 'appearance-none pr-8', className)}>
          {children}
        </select>
        <ChevronDown
          size={14}
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3"
        />
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------- Label */

const GAYA_LENCANA: Record<string, string> = {
  netral: 'bg-surface-2 text-ink-2',
  baik: 'bg-good/12 text-good-teks',
  awas: 'bg-warn/18 text-warn-teks',
  serius: 'bg-serious/18 text-ink',
  kritis: 'bg-critical/12 text-critical-teks',
  info: 'bg-brand-soft text-brand-teks',
};

export function Lencana({ nada = 'netral', children }: { nada?: keyof typeof GAYA_LENCANA; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-mikro font-medium',
        GAYA_LENCANA[nada]
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------- Tabel */

export function Tabel({ children, className }: { children: ReactNode; className?: string }) {
  /* Tabel menggulir di wadahnya sendiri: laporan produk dan karyawan punya
     banyak kolom, dan tanpa ini badan halaman ikut bergeser mendatar di ponsel. */
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-[640px] border-collapse text-kecil', className)}>{children}</table>
    </div>
  );
}

export const Th = ({ children, kanan, className }: { children?: ReactNode; kanan?: boolean; className?: string }) => (
  <th
    className={cn(
      'sticky top-0 border-y border-line bg-surface-2 px-3 py-2 text-left text-mikro font-semibold uppercase tracking-[0.06em] text-ink-3',
      kanan && 'text-right',
      className
    )}
  >
    {children}
  </th>
);

export const Td = ({ children, kanan, className }: { children?: ReactNode; kanan?: boolean; className?: string }) => (
  /* Kolom angka tidak boleh terbelah dua baris: pada kartu sempit, "Rp8,25 M"
     yang terpotong jadi sulit dibandingkan dengan baris di bawahnya. */
  <td className={cn('border-b border-line px-3 py-2.5 align-middle text-ink', kanan && 'text-right angka whitespace-nowrap', className)}>
    {children}
  </td>
);

export const Baris = ({ children, className }: { children: ReactNode; className?: string }) => (
  <tr className={cn('transition-colors duration-150 hover:bg-surface-2', className)}>{children}</tr>
);

/* ------------------------------------------------------------------ Keadaan */

/**
 * Rangka muat.
 *
 * Bentuknya meniru isi yang akan menggantikannya, sehingga tata letak tidak
 * melompat saat data tiba. Pemintal di tengah kotak kosong memberi tahu bahwa
 * sesuatu sedang terjadi tetapi tidak memberi tahu apa yang akan muncul.
 */
export function Rangka({ className }: { className?: string }) {
  return <div className={cn('rangka', className)} aria-hidden />;
}

export function RangkaTabel({ baris = 6, kolom = 5 }: { baris?: number; kolom?: number }) {
  return (
    <div className="px-4 py-3" role="status" aria-label="Memuat data">
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
          {Array.from({ length: kolom }).map((_, j) => (
            <Rangka key={j} className={cn('h-3.5', j === 0 ? 'w-[26%]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function RangkaKartu({ tinggi = 'h-40' }: { tinggi?: string }) {
  return (
    <div className={cn('px-4 py-4', tinggi)} role="status" aria-label="Memuat">
      <Rangka className="mb-3 h-3.5 w-1/3" />
      <Rangka className="h-[calc(100%-2rem)] w-full" />
    </div>
  );
}

/** Dipertahankan untuk tempat yang memang hanya menunggu sesaat, bukan memuat data. */
export function Memuat({ tinggi = 'h-40' }: { tinggi?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-kecil text-ink-3', tinggi)} role="status">
      <Loader2 size={15} className="animate-spin" /> Memuat…
    </div>
  );
}

/**
 * Keadaan kosong.
 *
 * Menjelaskan apa yang biasanya ada di sini dan bagaimana mengisinya, bukan
 * sekadar memberi tahu bahwa tidak ada apa-apa.
 */
export function Kosong({ judul, pesan, aksi }: { judul?: string; pesan: string; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      {judul && <p className="text-dasar font-medium text-ink">{judul}</p>}
      <p className="max-w-sm text-kecil leading-relaxed text-ink-2">{pesan}</p>
      {aksi && <div className="mt-2">{aksi}</div>}
    </div>
  );
}

export function Galat({ pesan }: { pesan: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/8 px-3 py-2.5 text-kecil leading-relaxed text-critical-teks"
    >
      <AlertCircle size={15} className="mt-[1px] shrink-0" />
      <span>{pesan}</span>
    </div>
  );
}

export function Sukses({ pesan, judul }: { pesan: string; judul?: string }) {
  return (
    <div className="rounded-lg border border-good/30 bg-good/8 px-3 py-2.5 text-kecil leading-relaxed">
      {judul && <p className="font-medium text-good-teks">{judul}</p>}
      <p className="text-ink-2">{pesan}</p>
    </div>
  );
}

/* ------------------------------------------------------------------- Dialog */

export function Dialog({
  judul,
  lebar = 'max-w-lg',
  tutup,
  children,
  kaki,
}: {
  judul: string;
  lebar?: string;
  tutup: () => void;
  children: ReactNode;
  kaki?: ReactNode;
}) {
  useEffect(() => {
    const saatTekan = (e: KeyboardEvent) => e.key === 'Escape' && tutup();
    document.addEventListener('keydown', saatTekan);
    const gulirLama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', saatTekan);
      document.body.style.overflow = gulirLama;
    };
  }, [tutup]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onMouseDown={tutup}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-naik sm:rounded-xl',
          lebar
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sedang font-semibold tracking-[-0.01em] text-ink">{judul}</h2>
          <button
            onClick={tutup}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {kaki && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{kaki}</div>}
      </div>
    </div>
  );
}
