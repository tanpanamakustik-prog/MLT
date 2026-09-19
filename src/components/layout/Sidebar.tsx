import { NavLink, useLocation } from 'react-router-dom';
import { Boxes, LogOut, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MENU } from './navigasi';
import { cn } from '../../lib/cn';

export function Sidebar({ terbuka, tutup }: { terbuka: boolean; tutup: () => void }) {
  const { pengguna, modul, keluar } = useAuth();
  const lokasi = useLocation();
  const menu = MENU.filter((m) => modul.includes(m.modul));

  return (
    <>
      {terbuka && <div className="fixed inset-0 z-30 bg-black/45 lg:hidden" onClick={tutup} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-rail transition-transform lg:static lg:translate-x-0',
          terbuka ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-ink">
            <Boxes size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-white">DistribusiHub</p>
            <p className="truncate text-[11px] text-rail-ink-2">Distributor Bahan Pokok</p>
          </div>
          <button onClick={tutup} aria-label="Tutup menu" className="rounded-md p-1 text-rail-ink-2 hover:text-white lg:hidden">
            <X size={16} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {menu.map((m) => {
            const Ikon = m.ikon!;
            /* Induk ditandai aktif berdasarkan awalan jalur, supaya halaman anak
               seperti /laporan/produk tetap menyorot kelompoknya. */
            const aktif = m.ke === '/' ? lokasi.pathname === '/' : lokasi.pathname.startsWith(m.ke);
            return (
              <div key={m.ke} className="mb-0.5">
                <NavLink
                  to={m.ke}
                  onClick={tutup}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition',
                    aktif ? 'bg-rail-active text-white' : 'text-rail-ink hover:bg-rail-active/60 hover:text-white'
                  )}
                >
                  <Ikon size={16} className="shrink-0" />
                  {m.label}
                </NavLink>
                {aktif && m.anak && (
                  <div className="mt-0.5 ml-[30px] flex flex-col border-l border-white/10 pl-3">
                    {m.anak.map((a) => (
                      <NavLink
                        key={a.ke}
                        to={a.ke}
                        end
                        onClick={tutup}
                        className={({ isActive }) =>
                          cn('rounded-md px-2 py-1.5 text-[12.5px] transition', isActive ? 'text-white' : 'text-rail-ink-2 hover:text-rail-ink')
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

        <div className="border-t border-white/10 px-3 py-3">
          <p className="truncate text-[13px] font-medium text-white">{pengguna?.nama}</p>
          <p className="mb-2 text-[11px] capitalize text-rail-ink-2">{pengguna?.peran}</p>
          <button
            onClick={keluar}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-rail-ink hover:bg-rail-active hover:text-white"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
