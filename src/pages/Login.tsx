import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Galat, Medan, Tombol } from '../components/ui/Dasar';
import { GalatApi } from '../lib/api';
import { LogoMLT, Mahkota } from '../components/common/LogoMLT';


const CAKUPAN = [
  'Penjualan dan stok yang selalu sejalan',
  'Saran kulakan dari rata-rata penjualan',
  'Pengiriman berjejak GPS dan bukti foto',
  'Laporan harian sampai tahunan',
];

export default function Login() {
  const { masuk } = useAuth();
  const [username, setUsername] = useState('');
  const [kataSandi, setKataSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setSibuk(true);
    try {
      await masuk(username.trim(), kataSandi);
    } catch (err) {
      setGalat(err instanceof GalatApi ? err.message : 'Tidak dapat menghubungi server.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    /* Dua kolom di layar lebar, menumpuk di ponsel. Panel kiri memakai lapisan
       krom yang sama dengan bilah navigasi aplikasi, sehingga layar pertama
       sudah memperkenalkan bahasa visual yang akan dipakai seterusnya. */
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex flex-col justify-between bg-krom px-6 py-8 sm:px-10 lg:w-[46%] lg:px-14 lg:py-12">
        <div className="flex items-center gap-3">
          <LogoMLT ukuran={44} className="shrink-0" />
          <span>
            <span className="block text-besar font-semibold leading-tight tracking-tight text-white">MLT</span>
            <span className="block text-mini leading-tight text-krom-ink-2">Mas Lukman Telur</span>
          </span>
        </div>

        <div className="hidden lg:block">
          <p className="max-w-md text-[2rem] font-semibold leading-tight tracking-[-0.025em] text-white">
            Barang masuk, stok, penjualan, pengiriman, dan untungnya — dalam satu catatan.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {CAKUPAN.map((c) => (
              <li key={c} className="flex items-baseline gap-3 text-dasar text-krom-ink">
                <Mahkota ukuran={13} className="shrink-0 translate-y-[2px] text-krom-aksen" />
                {c}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-mini text-krom-ink-2 lg:mt-0">
          Fresh &middot; Berkualitas &middot; Terpercaya
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-page px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-judul font-semibold tracking-[-0.02em] text-ink">Masuk</h1>
          <p className="mt-1 text-kecil text-ink-2">Gunakan akun yang diberikan admin.</p>

          <form onSubmit={kirim} className="mt-6 flex flex-col gap-4">
            <Medan
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
            <Medan
              label="Kata sandi"
              type="password"
              value={kataSandi}
              onChange={(e) => setKataSandi(e.target.value)}
              autoComplete="current-password"
              required
            />
            {galat && <Galat pesan={galat} />}
            <Tombol varian="utama" type="submit" sibuk={sibuk} className="h-10 w-full">
              Masuk
            </Tombol>
          </form>

        </div>
      </main>
    </div>
  );
}
