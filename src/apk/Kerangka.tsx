import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TAB } from './navigasi';
import { cn } from '../lib/cn';

/**
 * Kerangka aplikasi ponsel.
 *
 * Navigasi di bawah, bukan di atas: ibu jari menjangkau sepertiga bawah layar,
 * sementara bilah atas pada ponsel enam inci berada di luar jangkauan tanpa
 * memindahkan genggaman. Ini pula yang dipakai hampir semua aplikasi yang sudah
 * dikenal penggunanya, dan di aplikasi kerja kemiripan itu keuntungan, bukan
 * kekurangan.
 */
export function KerangkaApk({ children }: { children: ReactNode }) {
  const { pengguna } = useAuth();
  const lokasi = useLocation();
  const tab = TAB[pengguna!.peran] ?? [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lokasi.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <main
        className="flex-1"
        /* Ruang bawah menyisakan tinggi bilah plus area gestur, supaya isi
           terakhir tidak tertutup navigasi maupun garis geser. */
        style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navigasi utama"
      >
        <div className="mx-auto flex max-w-lg">
          {tab.map((t) => {
            const Ikon = t.ikon;
            const aktif = t.ke === '/a' ? lokasi.pathname === '/a' : lokasi.pathname.startsWith(t.ke);
            return (
              <NavLink
                key={t.ke}
                to={t.ke}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors duration-150',
                  aktif ? 'text-brand-teks' : 'text-ink-3'
                )}
              >
                {/* Ikon terisi saat aktif; keadaan terpilih tidak boleh hanya
                    dibedakan warna, karena empat label berdempetan dan warnanya
                    kecil sekali di ukuran ini. */}
                <span className={cn('rounded-full px-3 py-0.5 transition-colors duration-150', aktif && 'bg-brand-soft')}>
                  <Ikon size={20} strokeWidth={aktif ? 2.4 : 1.8} />
                </span>
                <span className={cn('text-mikro', aktif && 'font-semibold')}>{t.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Kepala layar dalam: judul, tombol kembali, dan aksi di kanan. */
export function KepalaLayar({
  judul,
  sub,
  aksi,
  kembali = true,
}: {
  judul: string;
  sub?: string;
  aksi?: ReactNode;
  kembali?: boolean;
}) {
  const navigasi = useNavigate();
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-3 py-3"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      {kembali && (
        <button
          onClick={() => navigasi(-1)}
          aria-label="Kembali"
          className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 transition-colors duration-150 active:bg-surface-2"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sedang font-semibold tracking-[-0.01em] text-ink">{judul}</h1>
        {sub && <p className="truncate text-mini text-ink-3">{sub}</p>}
      </div>
      {aksi && <div className="flex shrink-0 items-center gap-1">{aksi}</div>}
    </header>
  );
}

/**
 * Kepala beranda: pita krom yang isinya menumpang di atasnya.
 *
 * Kartu pertama sengaja naik menembus batas pita, supaya layar terbaca sebagai
 * satu lembar yang bersambung alih-alih dua blok yang ditumpuk.
 */
export function KepalaBeranda({ sapaan, nama, kanan, children }: { sapaan: string; nama: string; kanan?: ReactNode; children?: ReactNode }) {
  return (
    <div className="bg-krom pb-12" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-mini text-krom-ink-2">{sapaan}</p>
          <p className="truncate text-besar font-semibold tracking-tight text-white">{nama}</p>
        </div>
        {kanan}
      </div>
      {children}
    </div>
  );
}

/** Kartu yang menumpang di atas pita kepala. */
export function KartuNaik({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-4 -mt-8 rounded-2xl border border-line bg-surface shadow-kartu', className)}>{children}</div>
  );
}
