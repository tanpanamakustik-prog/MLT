import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/cn';

/* --------------------------------------------------------------- Permukaan */

export function Kartu({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-line bg-surface', className)}>{children}</div>;
}

export function KepalaKartu({ judul, deskripsi, aksi }: { judul: ReactNode; deskripsi?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{judul}</h2>
        {deskripsi && <p className="mt-0.5 text-[13px] text-ink-2">{deskripsi}</p>}
      </div>
      {aksi && <div className="flex shrink-0 items-center gap-2">{aksi}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Kontrol */

const GAYA_TOMBOL = {
  utama: 'bg-brand text-brand-ink hover:brightness-110',
  netral: 'border border-line bg-surface text-ink hover:bg-surface-2',
  halus: 'bg-surface-2 text-ink hover:brightness-95',
  bahaya: 'bg-critical text-white hover:brightness-110',
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
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:pointer-events-none disabled:opacity-50',
        GAYA_TOMBOL[varian],
        className
      )}
    >
      {sibuk && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

const GAYA_MEDAN =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none';

export function Medan({
  label,
  petunjuk,
  className,
  ...sisa
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; petunjuk?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[12px] font-medium text-ink-2">{label}</span>}
      <input {...sisa} className={cn(GAYA_MEDAN, className)} />
      {petunjuk && <span className="mt-1 block text-[11px] text-ink-3">{petunjuk}</span>}
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
      {label && <span className="mb-1 block text-[12px] font-medium text-ink-2">{label}</span>}
      <select {...sisa} className={cn(GAYA_MEDAN, 'appearance-none pr-8', className)}>
        {children}
      </select>
    </label>
  );
}

/* -------------------------------------------------------------------- Label */

const GAYA_LENCANA: Record<string, string> = {
  netral: 'bg-surface-2 text-ink-2',
  baik: 'bg-good/12 text-good',
  awas: 'bg-warn/20 text-ink',
  serius: 'bg-serious/18 text-ink',
  kritis: 'bg-critical/12 text-critical',
  info: 'bg-brand-soft text-brand',
};

export function Lencana({ nada = 'netral', children }: { nada?: keyof typeof GAYA_LENCANA; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', GAYA_LENCANA[nada])}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- Tabel */

export function Tabel({ children, className }: { children: ReactNode; className?: string }) {
  /* Tabel dibungkus wadah yang menggulir sendiri: laporan produk dan karyawan
     punya banyak kolom, dan tanpa ini badan halaman ikut bergeser mendatar di
     layar ponsel. */
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-[640px] border-collapse text-[13px]', className)}>{children}</table>
    </div>
  );
}

export const Th = ({ children, kanan, className }: { children?: ReactNode; kanan?: boolean; className?: string }) => (
  <th
    className={cn(
      'border-b border-line px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3',
      kanan && 'text-right',
      className
    )}
  >
    {children}
  </th>
);

export const Td = ({ children, kanan, className }: { children?: ReactNode; kanan?: boolean; className?: string }) => (
  /* Kolom angka tidak boleh terbelah dua baris: pada kartu sempit seperti tabel
     perbandingan tahunan, "Rp8,25 M" yang terpotong jadi sulit dibandingkan
     dengan baris di bawahnya. */
  <td className={cn('border-b border-line px-3 py-2 align-middle text-ink', kanan && 'text-right angka whitespace-nowrap', className)}>
    {children}
  </td>
);

/* ----------------------------------------------------------------- Keadaan */

export function Memuat({ tinggi = 'h-40' }: { tinggi?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-[13px] text-ink-3', tinggi)}>
      <Loader2 size={15} className="animate-spin" /> Memuat…
    </div>
  );
}

export function Kosong({ pesan, aksi }: { pesan: string; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <p className="max-w-sm text-[13px] text-ink-2">{pesan}</p>
      {aksi}
    </div>
  );
}

export function Galat({ pesan }: { pesan: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/8 px-3 py-2 text-[13px] text-critical">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <span>{pesan}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ Dialog */

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
  /* Escape menutup dialog, dan gulir badan dikunci selama dialog terbuka agar
     halaman di belakangnya tidak ikut bergerak saat isi dialog digulir. */
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onMouseDown={tutup}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-xl',
          lebar
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-ink">{judul}</h2>
          <button onClick={tutup} aria-label="Tutup" className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {kaki && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{kaki}</div>}
      </div>
    </div>
  );
}
