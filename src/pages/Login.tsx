import { useState, type FormEvent } from 'react';
import { Boxes } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Galat, Medan, Tombol } from '../components/ui/Dasar';
import { GalatApi } from '../lib/api';

const AKUN_DEMO = [
  { username: 'owner', peran: 'Owner — seluruh modul & laporan' },
  { username: 'admin', peran: 'Admin — order, produk, customer' },
  { username: 'gudang', peran: 'Gudang — stok, kulakan, pengiriman' },
  { username: 'sales', peran: 'Sales — customer & pesanan' },
  { username: 'driver', peran: 'Driver — pengiriman & absensi' },
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
    <div className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-ink">
            <Boxes size={20} />
          </span>
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">DistribusiHub</h1>
            <p className="text-[12px] text-ink-2">Sistem manajemen distributor bahan pokok</p>
          </div>
        </div>

        <form onSubmit={kirim} className="rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-col gap-3">
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
            <Tombol varian="utama" type="submit" sibuk={sibuk} className="mt-1 w-full py-2.5">
              Masuk
            </Tombol>
          </div>
        </form>

        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-[12px] font-medium text-ink-2">Akun data contoh — kata sandi demo1234</p>
          <ul className="flex flex-col gap-1">
            {AKUN_DEMO.map((a) => (
              <li key={a.username}>
                <button
                  type="button"
                  onClick={() => {
                    setUsername(a.username);
                    setKataSandi('demo1234');
                  }}
                  className="w-full rounded-md px-2 py-1 text-left text-[12px] text-ink-2 hover:bg-surface-2"
                >
                  <span className="font-medium text-ink">{a.username}</span> — {a.peran}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
