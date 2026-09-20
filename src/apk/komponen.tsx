import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { Rangka } from '../components/ui/Dasar';

/**
 * Satu baris daftar berbentuk kartu.
 *
 * Tabel tidak dipakai di ponsel: delapan kolom pada lebar 360 piksel memaksa
 * menggulir mendatar untuk membaca satu baris. Kartu menaruh yang paling
 * penting di depan dan sisanya sebagai keterangan, dan seluruh kartunya
 * menjadi sasaran sentuh — bukan tautan setinggi 16 piksel di dalam sel.
 */
export function KartuDaftar({
  ke,
  judul,
  sub,
  kanan,
  bawah,
  onClick,
}: {
  ke?: string;
  judul: ReactNode;
  sub?: ReactNode;
  kanan?: ReactNode;
  bawah?: ReactNode;
  onClick?: () => void;
}) {
  const isi = (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-dasar font-medium leading-tight text-ink">{judul}</div>
          {sub && <div className="mt-1 text-mini leading-snug text-ink-3">{sub}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {kanan}
          {(ke || onClick) && <ChevronRight size={16} className="text-ink-3" />}
        </div>
      </div>
      {bawah && <div className="mt-2.5 border-t border-line pt-2.5">{bawah}</div>}
    </>
  );

  const kelas =
    'block w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-colors duration-150 active:bg-surface-2';

  if (ke) return <Link to={ke} className={kelas}>{isi}</Link>;
  if (onClick) return <button onClick={onClick} className={kelas}>{isi}</button>;
  return <div className={kelas}>{isi}</div>;
}

/** Penyaring berbentuk pil, menggulir mendatar bila tidak muat. */
export function BarisPil({
  pilihan,
  nilai,
  ubah,
}: {
  pilihan: Array<{ nilai: string; label: string }>;
  nilai: string;
  ubah: (n: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
      {pilihan.map((p) => (
        <button
          key={p.nilai}
          onClick={() => ubah(p.nilai)}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-mini font-medium transition-colors duration-150',
            nilai === p.nilai
              ? 'border-brand bg-brand text-brand-ink'
              : 'border-line bg-surface text-ink-2 active:bg-surface-2'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function KosongApk({ judul, pesan, aksi }: { judul: string; pesan: string; aksi?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <p className="text-dasar font-medium text-ink">{judul}</p>
      <p className="max-w-xs text-kecil leading-relaxed text-ink-2">{pesan}</p>
      {aksi && <div className="mt-2">{aksi}</div>}
    </div>
  );
}

export function RangkaDaftar({ baris = 5 }: { baris?: number }) {
  return (
    <div className="flex flex-col gap-2.5" role="status" aria-label="Memuat">
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface px-4 py-3.5">
          <Rangka className="h-4 w-2/5" />
          <Rangka className="mt-2 h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

/** Isi layar dengan jarak tepi yang sama di semua tempat. */
export function Isi({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-4 py-4', className)}>{children}</div>;
}
