import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MENU, type ButirMenu } from './navigasi';
import { LogoMLT } from '../common/LogoMLT';
import { cn } from '../../lib/cn';

const KUNCI_TEMA = 'mlt.tema';

/* Satu jalur kebenaran untuk "kelompok mana yang sedang dibuka": dipakai
   penanda aktif di bilah atas maupun di lembar menu ponsel. */
function kelompokAktif(butir: ButirMenu, jalur: string): boolean {
  if (butir.ke === '/') return jalur === '/';
  if (jalur.startsWith(butir.ke)) return true;
  return (butir.anak ?? []).some((a) => jalur === a.ke || jalur.startsWith(a.ke + '/'));
}

/* ------------------------------------------------------------------- Tema */

function TombolTema() {
  const [tema, setTema] = useState<'terang' | 'gelap' | 'sistem'>(
    () => (localStorage.getItem(KUNCI_TEMA) as any) ?? 'sistem'
  );

  useEffect(() => {
    const akar = document.documentElement;
    /* Tanpa pilihan eksplisit atributnya dilepas sepenuhnya, sehingga halaman
       kembali mengikuti prefers-color-scheme dan tidak terkunci di terang. */
    if (tema === 'sistem') akar.removeAttribute('data-theme');
    else akar.setAttribute('data-theme', tema === 'gelap' ? 'dark' : 'light');
    localStorage.setItem(KUNCI_TEMA, tema);
  }, [tema]);

  const gelap = tema === 'gelap';
  return (
    <button
      onClick={() => setTema(gelap ? 'terang' : 'gelap')}
      aria-label={gelap ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
      className="grid h-9 w-9 place-items-center rounded-lg text-krom-ink-2 transition-colors duration-150 hover:bg-krom-2 hover:text-white"
    >
      {gelap ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* --------------------------------------------------------------- Dropdown */

/**
 * Panel anak menu.
 *
 * Diposisikan fixed terhadap tombolnya, bukan absolute di dalamnya: bilah atas
 * boleh menggulir mendatar pada layar sempit, dan panel yang absolute di dalam
 * wadah yang meng-overflow akan terpotong tepat saat paling dibutuhkan.
 */
function PanelAnak({
  butir,
  jalurSekarang,
  tutup,
  jangkar,
}: {
  butir: ButirMenu;
  jalurSekarang: string;
  tutup: () => void;
  jangkar: HTMLElement;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [posisi, setPosisi] = useState<{ atas: number; kiri: number } | null>(null);

  useLayoutEffect(() => {
    const r = jangkar.getBoundingClientRect();
    const lebarPanel = panel.current?.offsetWidth ?? 220;
    /* Dijaga agar tidak melewati tepi kanan layar; 12px sisa napas. */
    const kiri = Math.min(r.left, window.innerWidth - lebarPanel - 12);
    setPosisi({ atas: r.bottom + 6, kiri: Math.max(12, kiri) });
  }, [jangkar]);

  useEffect(() => {
    const saatTekan = (e: KeyboardEvent) => e.key === 'Escape' && tutup();
    const saatKlik = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !jangkar.contains(t)) tutup();
    };
    document.addEventListener('keydown', saatTekan);
    document.addEventListener('mousedown', saatKlik);
    /* Menggulir halaman memindahkan jangkar tetapi tidak panelnya; menutup
       lebih jujur daripada membiarkan panel menggantung lepas dari tombolnya. */
    window.addEventListener('scroll', tutup, true);
    window.addEventListener('resize', tutup);
    return () => {
      document.removeEventListener('keydown', saatTekan);
      document.removeEventListener('mousedown', saatKlik);
      window.removeEventListener('scroll', tutup, true);
      window.removeEventListener('resize', tutup);
    };
  }, [tutup, jangkar]);

  return (
    <div
      ref={panel}
      role="menu"
      aria-label={butir.label}
      style={{ top: posisi?.atas ?? -9999, left: posisi?.kiri ?? -9999 }}
      className={cn(
        'fixed z-50 min-w-[224px] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-naik',
        'transition-opacity duration-150',
        posisi ? 'opacity-100' : 'opacity-0'
      )}
    >
      {butir.anak!.map((a) => {
        const aktif = jalurSekarang === a.ke;
        return (
          <NavLink
            key={a.ke}
            to={a.ke}
            role="menuitem"
            onClick={tutup}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-kecil transition-colors duration-150',
              aktif ? 'bg-brand-soft font-medium text-brand-teks' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
            )}
          >
            {a.label}
          </NavLink>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- Bilah atas */

export function Topbar() {
  const { pengguna, modul, keluar } = useAuth();
  const lokasi = useLocation();
  const navigasi = useNavigate();
  const menu = MENU.filter((m) => modul.includes(m.modul));

  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [jangkar, setJangkar] = useState<HTMLElement | null>(null);
  const [lembarPonsel, setLembarPonsel] = useState(false);
  const [menuAkun, setMenuAkun] = useState(false);

  const tutup = useCallback(() => {
    setTerbuka(null);
    setJangkar(null);
  }, []);

  /* Pindah halaman selalu menutup segalanya, termasuk ketika perpindahan
     datang dari tempat lain seperti tautan di dalam isi halaman. */
  useEffect(() => {
    tutup();
    setLembarPonsel(false);
    setMenuAkun(false);
  }, [lokasi.pathname, tutup]);

  const butirTerbuka = menu.find((m) => m.ke === terbuka);
  const inisial = (pengguna?.nama ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((k) => k[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <header
        className="sticky top-0 z-40 bg-krom"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-14 items-center gap-1 px-3 sm:px-4">
          <button
            onClick={() => setLembarPonsel(true)}
            aria-label="Buka menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-krom-ink transition-colors duration-150 hover:bg-krom-2 hover:text-white lg:hidden"
          >
            <Menu size={17} />
          </button>

          <button
            onClick={() => navigasi('/')}
            className="mr-1 flex shrink-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors duration-150 hover:bg-krom-2"
          >
            <LogoMLT ukuran={32} className="shrink-0" />
            <span className="hidden text-sedang font-semibold tracking-tight text-white sm:block">MLT</span>
          </button>

          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex" aria-label="Navigasi utama">
            {menu.map((m) => {
              const aktif = kelompokAktif(m, lokasi.pathname);
              const punyaAnak = !!m.anak?.length;

              const kelas = cn(
                'relative flex items-center gap-1 rounded-lg px-2.5 py-2 text-kecil font-medium transition-colors duration-150',
                aktif ? 'text-white' : 'text-krom-ink hover:bg-krom-2 hover:text-white'
              );
              /* Penanda aktif berupa garis di tepi bawah bilah, bukan latar
                 penuh: pada bilah gelap, blok berwarna bersaing dengan tombol
                 aksi di halaman, sedangkan garis tipis cukup dan tetap jelas. */
              const garis = aktif && (
                <span className="absolute inset-x-2.5 -bottom-[7px] h-[2px] rounded-full bg-krom-aksen" />
              );

              return punyaAnak ? (
                <button
                  key={m.ke}
                  aria-haspopup="menu"
                  aria-expanded={terbuka === m.ke}
                  onClick={(e) => {
                    if (terbuka === m.ke) return tutup();
                    setTerbuka(m.ke);
                    setJangkar(e.currentTarget);
                  }}
                  className={kelas}
                >
                  {m.label}
                  <ChevronDown
                    size={13}
                    className={cn('transition-transform duration-150', terbuka === m.ke && 'rotate-180')}
                  />
                  {garis}
                </button>
              ) : (
                <NavLink key={m.ke} to={m.ke} className={kelas}>
                  {m.label}
                  {garis}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <TombolTema />
            <div className="relative">
              <button
                onClick={() => setMenuAkun((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuAkun}
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors duration-150 hover:bg-krom-2"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-krom-2 text-mini font-semibold text-krom-ink">
                  {inisial}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-mini font-medium leading-tight text-white">{pengguna?.nama}</span>
                  <span className="block text-mikro capitalize leading-tight text-krom-ink-2">{pengguna?.peran}</span>
                </span>
              </button>

              {menuAkun && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuAkun(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 min-w-[190px] rounded-xl border border-line bg-surface p-1 shadow-naik"
                  >
                    <div className="border-b border-line px-3 py-2">
                      <p className="text-kecil font-medium text-ink">{pengguna?.nama}</p>
                      <p className="text-mikro capitalize text-ink-3">{pengguna?.peran}</p>
                    </div>
                    <button
                      onClick={keluar}
                      role="menuitem"
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-kecil text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                    >
                      <LogOut size={14} /> Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {butirTerbuka && jangkar && (
        <PanelAnak butir={butirTerbuka} jalurSekarang={lokasi.pathname} tutup={tutup} jangkar={jangkar} />
      )}

      {lembarPonsel && <LembarPonsel menu={menu} tutup={() => setLembarPonsel(false)} />}
    </>
  );
}

/* ------------------------------------------------------------ Menu ponsel */

function LembarPonsel({ menu, tutup }: { menu: ButirMenu[]; tutup: () => void }) {
  const lokasi = useLocation();
  const { pengguna, keluar } = useAuth();

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
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/55" onClick={tutup} />
      <div
        className="absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col bg-surface"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sedang font-semibold tracking-tight text-ink">Menu</span>
          <button
            onClick={tutup}
            aria-label="Tutup menu"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {menu.map((m) => {
            const Ikon = m.ikon!;
            const aktif = kelompokAktif(m, lokasi.pathname);
            return (
              <div key={m.ke} className="mb-1">
                <NavLink
                  to={m.ke}
                  onClick={tutup}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-dasar font-medium transition-colors duration-150',
                    aktif ? 'bg-brand-soft text-brand-teks' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                  )}
                >
                  <Ikon size={17} className="shrink-0" />
                  {m.label}
                </NavLink>
                {aktif && m.anak && (
                  <div className="ml-[34px] mt-0.5 flex flex-col border-l border-line pl-3">
                    {m.anak.map((a) => (
                      <NavLink
                        key={a.ke}
                        to={a.ke}
                        end
                        onClick={tutup}
                        className={({ isActive }) =>
                          cn(
                            'rounded-md px-2 py-2 text-kecil transition-colors duration-150',
                            isActive ? 'font-medium text-brand-teks' : 'text-ink-3 hover:text-ink'
                          )
                        }
                      >
                        {a.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-line px-4 py-3">
          <p className="text-kecil font-medium text-ink">{pengguna?.nama}</p>
          <p className="mb-2 text-mikro capitalize text-ink-3">{pengguna?.peran}</p>
          <button
            onClick={keluar}
            className="flex w-full items-center gap-2 rounded-lg py-2 text-kecil text-ink-2 transition-colors duration-150 hover:text-ink"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </div>
    </div>
  );
}
