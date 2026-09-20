import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Galat, Medan, Tombol } from '../components/ui/Dasar';
import { Server } from 'lucide-react';
import { ambilAkarApi, diAplikasi, GalatApi, GalatJaringan, simpanAkarApi } from '../lib/api';
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
  /* Kolom alamat server hanya muncul di APK. Di peramban, halaman dan API
     selalu berasal dari satu tempat, jadi menanyakannya justru membingungkan. */
  const [aturServer, setAturServer] = useState(false);
  const [alamatServer, setAlamatServer] = useState(ambilAkarApi());

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setSibuk(true);
    try {
      await masuk(username.trim(), kataSandi);
    } catch (err) {
      if (err instanceof GalatJaringan) {
        setGalat(err.message);
        /* Kegagalan jaringan hampir selalu soal alamat, jadi kolomnya dibuka
           sendiri alih-alih menunggu orang menemukannya. */
        setAturServer(true);
      } else {
        setGalat(err instanceof GalatApi ? err.message : 'Tidak dapat menghubungi server.');
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    /* Dua kolom di layar lebar, menumpuk di ponsel. Panel kiri memakai lapisan
       krom yang sama dengan bilah navigasi aplikasi, sehingga layar pertama
       sudah memperkenalkan bahasa visual yang akan dipakai seterusnya. */
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex flex-col justify-between gap-6 bg-krom px-5 py-6 sm:px-10 lg:w-[46%] lg:px-14 lg:py-12">
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

        <p className="text-mini text-krom-ink-2">Fresh &middot; Berkualitas &middot; Terpercaya</p>
      </aside>

      <main className="flex flex-1 items-start justify-center bg-page px-5 pb-10 pt-8 sm:px-8 lg:items-center lg:pt-10">
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

          <p className="mt-5 text-center text-kecil text-ink-2">
            Pembeli baru?{' '}
            <Link to="/daftar" className="font-medium text-brand-teks hover:underline">
              Daftar di sini
            </Link>
          </p>
          <p className="mt-1 text-center text-mini text-ink-3">
            Akun karyawan dibuatkan oleh admin, tidak lewat pendaftaran.
          </p>

          {diAplikasi() && (
            <div className="mt-5 border-t border-line pt-4">
              {aturServer ? (
                <div className="flex flex-col gap-2">
                  <Medan
                    label="Alamat server"
                    value={alamatServer}
                    onChange={(e) => setAlamatServer(e.target.value)}
                    placeholder="http://192.168.1.15:3335"
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="url"
                    petunjuk="Alamat ini tersimpan di ponsel dan tidak perlu diisi lagi tiap kali masuk."
                  />
                  <div className="flex gap-2">
                    <Tombol
                      onClick={() => {
                        simpanAkarApi(alamatServer);
                        setGalat(null);
                        setAturServer(false);
                      }}
                      className="flex-1"
                    >
                      Simpan alamat
                    </Tombol>
                    <Tombol onClick={() => setAturServer(false)}>Batal</Tombol>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAturServer(true)}
                  className="flex w-full items-center justify-center gap-1.5 text-mini text-ink-3 transition-colors duration-150 hover:text-ink-2"
                >
                  <Server size={13} />
                  {alamatServer ? `Server: ${alamatServer.replace(/^https?:\/\//, '')}` : 'Atur alamat server'}
                </button>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
