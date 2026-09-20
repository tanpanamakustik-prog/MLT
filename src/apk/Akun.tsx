import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LogOut, Moon, Server, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ambilAkarApi, diAplikasi, simpanAkarApi } from '../lib/api';
import { Dialog, Medan, Tombol } from '../components/ui/Dasar';
import { KepalaBeranda } from './Kerangka';
import { Isi } from './komponen';
import { LogoMLT } from '../components/common/LogoMLT';

const KUNCI_TEMA = 'mlt.tema';

const LABEL_PERAN: Record<string, string> = {
  owner: 'Pemilik',
  admin: 'Admin',
  gudang: 'Gudang',
  sales: 'Sales',
  driver: 'Driver',
  buyer: 'Pembeli',
};

/** Menu lengkap per peran, untuk layar yang tidak muat di bilah bawah. */
const MENU: Record<string, Array<{ label: string; ke: string }>> = {
  owner:  [{ label: 'Kulakan', ke: '/a/kulakan' }, { label: 'Customer', ke: '/a/customer' }, { label: 'Pengiriman', ke: '/a/kiriman' }, { label: 'Aktivitas karyawan', ke: '/a/aktivitas' }],
  admin:  [{ label: 'Kulakan', ke: '/a/kulakan' }, { label: 'Customer', ke: '/a/customer' }, { label: 'Pengiriman', ke: '/a/kiriman' }, { label: 'Aktivitas karyawan', ke: '/a/aktivitas' }],
  gudang: [{ label: 'Stock opname', ke: '/a/opname' }, { label: 'Pengiriman', ke: '/a/kiriman' }, { label: 'Absen', ke: '/a/absen' }, { label: 'Aktivitas saya', ke: '/a/aktivitas' }],
  sales:  [{ label: 'Pesanan baru', ke: '/a/pesanan/baru' }, { label: 'Absen', ke: '/a/absen' }, { label: 'Aktivitas saya', ke: '/a/aktivitas' }],
  driver: [{ label: 'Absen', ke: '/a/absen' }, { label: 'Aktivitas saya', ke: '/a/aktivitas' }],
  buyer:  [],
};

export default function Akun() {
  const { pengguna, keluar } = useAuth();
  const [aturServer, setAturServer] = useState(false);
  const [alamat, setAlamat] = useState(ambilAkarApi());
  const [tema, setTema] = useState<'terang' | 'gelap' | 'sistem'>(
    () => (localStorage.getItem(KUNCI_TEMA) as any) ?? 'sistem'
  );

  const gantiTema = () => {
    const baru = tema === 'gelap' ? 'terang' : 'gelap';
    setTema(baru);
    document.documentElement.setAttribute('data-theme', baru === 'gelap' ? 'dark' : 'light');
    localStorage.setItem(KUNCI_TEMA, baru);
  };

  const menu = MENU[pengguna!.peran] ?? [];

  return (
    <>
      <KepalaBeranda sapaan={LABEL_PERAN[pengguna!.peran] ?? pengguna!.peran} nama={pengguna!.nama} />

      <Isi className="-mt-8">
        <div className="rounded-2xl border border-line bg-surface px-4 py-4">
          <div className="flex items-center gap-3">
            <LogoMLT ukuran={40} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-dasar font-medium text-ink">MLT</p>
              <p className="text-mini text-ink-3">Mas Lukman Telur</p>
            </div>
          </div>
          <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-3 text-kecil">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Username</dt>
              <dd className="text-ink">{pengguna!.username}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">Peran</dt>
              <dd className="text-ink">{LABEL_PERAN[pengguna!.peran] ?? pengguna!.peran}</dd>
            </div>
            {pengguna!.status_customer && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Status toko</dt>
                <dd className={pengguna!.status_customer === 'aktif' ? 'text-good-teks' : 'text-warn-teks'}>
                  {pengguna!.status_customer === 'menunggu' ? 'Menunggu verifikasi' : pengguna!.status_customer}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {menu.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
            {menu.map((m, i) => (
              <Link
                key={m.ke}
                to={m.ke}
                className={`flex items-center justify-between px-4 py-3.5 text-kecil text-ink transition-colors duration-150 active:bg-surface-2 ${i > 0 ? 'border-t border-line' : ''}`}
              >
                {m.label}
                <ChevronRight size={16} className="text-ink-3" />
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <button
            onClick={gantiTema}
            className="flex w-full items-center justify-between px-4 py-3.5 text-kecil text-ink transition-colors duration-150 active:bg-surface-2"
          >
            <span className="flex items-center gap-2.5">
              {tema === 'gelap' ? <Sun size={17} className="text-ink-3" /> : <Moon size={17} className="text-ink-3" />}
              Tema {tema === 'gelap' ? 'gelap' : 'terang'}
            </span>
            <ChevronRight size={16} className="text-ink-3" />
          </button>

          {diAplikasi() && (
            <button
              onClick={() => setAturServer(true)}
              className="flex w-full items-center justify-between border-t border-line px-4 py-3.5 text-kecil text-ink transition-colors duration-150 active:bg-surface-2"
            >
              <span className="flex items-center gap-2.5">
                <Server size={17} className="text-ink-3" />
                <span className="min-w-0 text-left">
                  <span className="block">Alamat server</span>
                  <span className="block truncate text-mini text-ink-3">
                    {alamat.replace(/^https?:\/\//, '') || 'belum diatur'}
                  </span>
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-3" />
            </button>
          )}
        </div>

        <Tombol varian="bahaya" onClick={keluar} className="mt-4 h-11 w-full">
          <LogOut size={15} /> Keluar
        </Tombol>
      </Isi>

      {aturServer && (
        <Dialog
          judul="Alamat server"
          tutup={() => setAturServer(false)}
          kaki={
            <>
              <Tombol onClick={() => setAturServer(false)}>Batal</Tombol>
              <Tombol
                varian="utama"
                onClick={() => {
                  simpanAkarApi(alamat);
                  setAturServer(false);
                  /* Muat ulang supaya seluruh layar mengambil data dari alamat
                     baru, bukan sebagian masih dari yang lama. */
                  window.location.reload();
                }}
              >
                Simpan
              </Tombol>
            </>
          }
        >
          <Medan
            label="Alamat"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            placeholder="http://192.168.1.15:3335"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="url"
            petunjuk="Tersimpan di ponsel ini. Ubah bila alamat server berganti."
          />
        </Dialog>
      )}
    </>
  );
}
