import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';

export function AppShell({ children }: { children: ReactNode }) {
  const lokasi = useLocation();

  /* Gulir dikembalikan ke atas tiap ganti halaman; tanpa ini, berpindah dari
     tabel panjang ke halaman baru mendarat di tengah halaman. */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lokasi.pathname]);

  return (
    <div className="min-h-screen bg-page">
      <Topbar />
      {/* Lebar isi dibatasi: tanpa batas ini, tabel laporan melebar sampai
          2000px di monitor lebar dan mata harus menyeberangi layar penuh untuk
          mencocokkan nama produk dengan angkanya. */}
      <main
        className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6"
        style={{ paddingBottom: 'calc(3rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * Kepala halaman.
 *
 * Judul memakai satu tingkat di atas apa pun di bawahnya dan tidak pernah
 * didahului label kecil — judulnya sendiri yang menanggung bobotnya.
 */
export function JudulHalaman({
  judul,
  deskripsi,
  aksi,
}: {
  judul: string;
  deskripsi?: string;
  aksi?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-judul font-semibold tracking-[-0.02em] text-ink">{judul}</h1>
        {deskripsi && <p className="mt-1 text-kecil text-ink-2">{deskripsi}</p>}
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2 cetak-sembunyi">{aksi}</div>}
    </div>
  );
}
