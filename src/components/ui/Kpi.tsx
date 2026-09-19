import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/* Warna dibaca dari token tema, bukan ditulis sebagai hex, supaya ikut berganti
   saat tema gelap aktif tanpa render ulang.

   Berkas ini sengaja dipisahkan dari Grafik.tsx: komponen di sini dipakai
   halaman stok, customer, dan absensi yang tidak menggambar grafik apa pun.
   Disatukan, pustaka grafik ikut terbawa ke bundel awal dan setiap driver yang
   membuka APK mengunduhnya tanpa pernah memakainya. */
const WARNA = ['var(--dh-series-1)', 'var(--dh-series-2)', 'var(--dh-series-3)'];

/**
 * Peringkat mendatar dengan label nilai langsung di tiap baris.
 *
 * Dipakai untuk daftar pendek seperti produk terlaris. Nilai ditulis di
 * sampingnya, bukan hanya diwakili panjang batang, karena selisih antar produk
 * teratas kerap tipis dan yang ingin diketahui adalah angkanya.
 */
export function PeringkatBatang({
  baris,
}: {
  baris: Array<{ label: string; nilai: number; keterangan?: string; teksNilai: string }>;
}) {
  const maks = Math.max(...baris.map((b) => b.nilai), 1);
  return (
    <ol className="flex flex-col gap-3">
      {baris.map((b, i) => (
        <li key={b.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] text-ink">
              <span className="mr-1.5 text-ink-3 angka">{i + 1}.</span>
              {b.label}
            </span>
            <span className="shrink-0 angka text-[13px] font-medium text-ink">{b.teksNilai}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (b.nilai / maks) * 100)}%`, background: WARNA[0] }}
              />
            </div>
            {b.keterangan && <span className="shrink-0 text-[11px] text-ink-3">{b.keterangan}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Kartu angka tunggal. Tanpa plot, jadi tanpa lapisan hover. */
export function KartuKpi({
  label,
  nilai,
  nilaiPenuh,
  catatan,
  ikon,
  nada,
}: {
  label: string;
  nilai: string;
  nilaiPenuh?: string;
  catatan?: ReactNode;
  ikon?: ReactNode;
  nada?: 'baik' | 'kritis';
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-ink-2">{label}</span>
        {ikon && <span className="text-ink-3">{ikon}</span>}
      </div>
      <p
        title={nilaiPenuh}
        className={cn(
          'mt-1.5 text-[22px] font-semibold leading-tight tracking-tight',
          nada === 'baik' ? 'text-good' : nada === 'kritis' ? 'text-critical' : 'text-ink'
        )}
      >
        {nilai}
      </p>
      {catatan && <p className="mt-1 text-[12px] text-ink-3">{catatan}</p>}
    </div>
  );
}

/** Batang tumpuk status stok. Tiap ruas diberi label; warna tidak berdiri sendiri. */
export function BatangStatus({ ringkas }: { ringkas: Record<string, number> }) {
  const RUAS = [
    { kunci: 'critical', label: 'Kritis', warna: 'var(--dh-critical)' },
    { kunci: 'low', label: 'Menipis', warna: 'var(--dh-warn)' },
    { kunci: 'normal', label: 'Normal', warna: 'var(--dh-good)' },
    { kunci: 'overstock', label: 'Menumpuk', warna: 'var(--dh-series-1)' },
  ];
  const total = RUAS.reduce((a, r) => a + (ringkas[r.kunci] ?? 0), 0) || 1;

  return (
    <div>
      {/* Celah 2px antar ruas memisahkan warna yang bersebelahan tanpa garis. */}
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
        {RUAS.map((r) => {
          const n = ringkas[r.kunci] ?? 0;
          return n > 0 ? <div key={r.kunci} style={{ width: `${(n / total) * 100}%`, background: r.warna }} /> : null;
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {RUAS.map((r) => (
          <span key={r.kunci} className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: r.warna }} />
            {r.label}
            <span className="angka font-medium text-ink">{ringkas[r.kunci] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
