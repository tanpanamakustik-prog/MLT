import { type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { persen } from '../../lib/format';

/* Warna dibaca dari token tema, bukan ditulis sebagai hex, supaya ikut berganti
   saat tema gelap aktif tanpa render ulang.

   Berkas ini terpisah dari Grafik.tsx: komponen di sini dipakai halaman stok,
   customer, dan absensi yang tidak menggambar grafik apa pun. Disatukan,
   pustaka grafik ikut terbawa ke bundel awal dan setiap driver yang membuka
   APK mengunduhnya tanpa pernah memakainya. */
const WARNA = ['var(--dh-series-1)', 'var(--dh-series-2)', 'var(--dh-series-3)'];

/**
 * Selisih terhadap periode pembanding.
 *
 * Panah dan kata menyertai angkanya. Naik-turun tidak boleh disampaikan lewat
 * warna saja: merah dan hijau adalah dua warna yang paling sering tertukar pada
 * defisiensi penglihatan warna yang paling umum.
 */
export function Selisih({ nilai, kecil }: { nilai: number | null | undefined; kecil?: boolean }) {
  if (nilai == null) return <span className={cn('text-ink-3', kecil ? 'text-mikro' : 'text-mini')}>tanpa pembanding</span>;

  const datar = Math.abs(nilai) < 0.05;
  const naik = nilai > 0;
  const Ikon = datar ? Minus : naik ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium',
        kecil ? 'text-mikro' : 'text-mini',
        datar ? 'text-ink-2' : naik ? 'text-good-teks' : 'text-critical-teks'
      )}
    >
      <Ikon size={kecil ? 11 : 13} className="shrink-0" />
      {datar ? 'tetap' : `${naik ? '+' : ''}${persen(nilai)}`}
    </span>
  );
}

/**
 * Angka pemimpin halaman.
 *
 * Satu nilai memegang seluruh bobot dan sisanya menjadi konteks di bawahnya,
 * alih-alih empat kartu sederajat yang saling berebut perhatian. Owner membuka
 * dashboard untuk satu pertanyaan lebih dulu — berapa masuknya hari ini — dan
 * susunan ini menjawabnya sebelum mata sempat memindai.
 */
export function AngkaUtama({
  label,
  nilai,
  nilaiPenuh,
  selisih,
  bandingDengan,
  pendukung,
  samping,
}: {
  label: string;
  nilai: string;
  nilaiPenuh?: string;
  selisih?: number | null;
  bandingDengan?: string;
  pendukung: Array<{ label: string; nilai: string; judulPenuh?: string }>;
  samping?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="text-mini font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
          <p
            title={nilaiPenuh}
            className="angka-utama mt-1.5 text-angka leading-none text-ink sm:text-utama"
          >
            {nilai}
          </p>
          {/* Baris pembanding hanya muncul bila ada yang dibandingkan. Periode
              pertama sebuah sistem tidak punya pendahulu, dan menulis "tanpa
              pembanding dibanding Agustus" adalah kalimat yang tidak berarti. */}
          {selisih != null && (
            <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-mini text-ink-2">
              <Selisih nilai={selisih} />
              {bandingDengan && <span>dibanding {bandingDengan}</span>}
            </p>
          )}
        </div>
        {samping && <div className="min-w-0 shrink-0">{samping}</div>}
      </div>

      {pendukung.length > 0 && (
        <dl className="mt-5 flex flex-wrap items-baseline gap-x-7 gap-y-3 border-t border-line pt-4">
          {pendukung.map((p) => (
            <div key={p.label} className="min-w-0">
              <dt className="text-mikro uppercase tracking-[0.06em] text-ink-3">{p.label}</dt>
              <dd title={p.judulPenuh} className="angka mt-0.5 text-sedang font-semibold text-ink">
                {p.nilai}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Kartu angka tunggal untuk nilai pendukung. Tanpa plot, jadi tanpa lapisan hover. */
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
        <span className="truncate text-mini font-medium text-ink-2">{label}</span>
        {ikon && <span className="shrink-0 text-ink-3">{ikon}</span>}
      </div>
      <p
        title={nilaiPenuh}
        className={cn(
          'angka mt-2 text-besar font-semibold leading-none tracking-[-0.02em]',
          nada === 'baik' ? 'text-good-teks' : nada === 'kritis' ? 'text-critical-teks' : 'text-ink'
        )}
      >
        {nilai}
      </p>
      {catatan && <p className="mt-1.5 text-mini text-ink-3">{catatan}</p>}
    </div>
  );
}

/**
 * Peringkat mendatar dengan label nilai langsung di tiap baris.
 *
 * Nilai ditulis di sampingnya, bukan hanya diwakili panjang batang, karena
 * selisih antar produk teratas kerap tipis dan yang ingin diketahui adalah
 * angkanya.
 */
export function PeringkatBatang({
  baris,
}: {
  baris: Array<{ label: string; nilai: number; keterangan?: string; teksNilai: string }>;
}) {
  const maks = Math.max(...baris.map((b) => b.nilai), 1);
  return (
    <ol className="flex flex-col gap-3.5">
      {baris.map((b, i) => (
        <li key={b.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="angka w-4 shrink-0 text-mikro tabular-nums text-ink-3">{i + 1}</span>
              <span className="truncate text-kecil text-ink">{b.label}</span>
            </span>
            <span className="angka shrink-0 text-kecil font-semibold text-ink">{b.teksNilai}</span>
          </div>
          <div className="ml-6 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{ width: `${Math.max(2, (b.nilai / maks) * 100)}%`, background: WARNA[0] }}
              />
            </div>
            {b.keterangan && <span className="angka shrink-0 text-mikro text-ink-3">{b.keterangan}</span>}
          </div>
        </li>
      ))}
    </ol>
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
      {/* Celah 2px antar ruas memisahkan warna bersebelahan tanpa garis. */}
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-surface-2">
        {RUAS.map((r) => {
          const n = ringkas[r.kunci] ?? 0;
          return n > 0 ? <div key={r.kunci} style={{ width: `${(n / total) * 100}%`, background: r.warna }} /> : null;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {RUAS.map((r) => (
          <span key={r.kunci} className="inline-flex items-center gap-1.5 text-mini text-ink-2">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: r.warna }} />
            {r.label}
            <span className="angka font-semibold text-ink">{ringkas[r.kunci] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
