import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Moon, Sun } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

const KUNCI_TEMA = 'distribusihub.tema';

function TombolTema() {
  const [tema, setTema] = useState<'terang' | 'gelap' | 'sistem'>(
    () => (localStorage.getItem(KUNCI_TEMA) as any) ?? 'sistem'
  );

  useEffect(() => {
    const akar = document.documentElement;
    /* Tanpa pilihan eksplisit, atribut dilepas sepenuhnya sehingga halaman
       kembali mengikuti prefers-color-scheme sistem, bukan terkunci di terang. */
    if (tema === 'sistem') akar.removeAttribute('data-theme');
    else akar.setAttribute('data-theme', tema === 'gelap' ? 'dark' : 'light');
    localStorage.setItem(KUNCI_TEMA, tema);
  }, [tema]);

  return (
    <button
      onClick={() => setTema((t) => (t === 'gelap' ? 'terang' : 'gelap'))}
      aria-label="Ganti tema terang atau gelap"
      className="rounded-lg border border-line p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      {tema === 'gelap' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuTerbuka, setMenuTerbuka] = useState(false);
  const { pengguna } = useAuth();
  const lokasi = useLocation();

  /* Gulir dikembalikan ke atas tiap ganti halaman. Tanpa ini, berpindah dari
     tabel panjang ke halaman baru mendarat di tengah halaman. */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lokasi.pathname]);

  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar terbuka={menuTerbuka} tutup={() => setMenuTerbuka(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-3"
          style={{ top: 'env(safe-area-inset-top, 0px)' }}
        >
          <button
            onClick={() => setMenuTerbuka(true)}
            aria-label="Buka menu"
            className="rounded-lg border border-line p-2 text-ink-2 hover:bg-surface-2 lg:hidden"
          >
            <Menu size={15} />
          </button>
          <div className="min-w-0 flex-1" />
          <TombolTema />
          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-medium leading-tight text-ink">{pengguna?.nama}</p>
            <p className="text-[11px] capitalize text-ink-3">{pengguna?.peran}</p>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function JudulHalaman({ judul, deskripsi, aksi }: { judul: string; deskripsi?: string; aksi?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">{judul}</h1>
        {deskripsi && <p className="mt-1 text-[13px] text-ink-2">{deskripsi}</p>}
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
    </div>
  );
}
