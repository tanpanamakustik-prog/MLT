import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Galat, Medan, Tombol } from '../components/ui/Dasar';
import { api, GalatApi, GalatJaringan } from '../lib/api';
import { LogoMLT } from '../components/common/LogoMLT';

/**
 * Pendaftaran mandiri untuk pembeli.
 *
 * Hanya menghasilkan akun buyer. Karyawan tidak mendaftar sendiri — akun gudang,
 * sales, dan driver dibuat owner, karena peran-peran itu memegang stok dan uang.
 */
export default function Daftar() {
  const navigasi = useNavigate();
  const [f, setF] = useState({ nama_toko: '', nama: '', no_hp: '', alamat: '', username: '', kata_sandi: '' });
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [selesai, setSelesai] = useState<string | null>(null);

  const isi = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setSibuk(true);
    try {
      const r = await api.post<{ pesan: string }>('/auth/daftar', f);
      setSelesai(r.pesan);
    } catch (err) {
      setGalat(
        err instanceof GalatJaringan || err instanceof GalatApi ? err.message : 'Pendaftaran gagal dikirim.'
      );
    } finally {
      setSibuk(false);
    }
  }

  if (selesai) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page px-5 py-10">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-good-teks" />
          <h1 className="text-judul font-semibold tracking-[-0.02em] text-ink">Pendaftaran diterima</h1>
          <p className="mt-2 text-kecil leading-relaxed text-ink-2">{selesai}</p>
          <Tombol varian="utama" onClick={() => navigasi('/')} className="mt-6 h-10 w-full">
            Masuk sekarang
          </Tombol>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="flex items-center gap-3 bg-krom px-5 py-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <LogoMLT ukuran={36} className="shrink-0" />
        <span>
          <span className="block text-sedang font-semibold leading-tight text-white">Daftar sebagai pembeli</span>
          <span className="block text-mini leading-tight text-krom-ink-2">MLT — Mas Lukman Telur</span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-sm px-5 pb-12 pt-6">
        <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-kecil text-ink-2 hover:text-ink">
          <ArrowLeft size={14} /> Kembali ke halaman masuk
        </Link>

        <form onSubmit={kirim} className="flex flex-col gap-3.5">
          <Medan label="Nama toko" value={f.nama_toko} onChange={isi('nama_toko')} required />
          <Medan label="Nama Anda" value={f.nama} onChange={isi('nama')} petunjuk="Kosongkan bila sama dengan nama toko." />
          <Medan
            label="Nomor HP"
            value={f.no_hp}
            onChange={isi('no_hp')}
            inputMode="tel"
            required
            petunjuk="Nomor ini yang akan dihubungi untuk memverifikasi toko Anda."
          />
          <Medan label="Alamat pengiriman" value={f.alamat} onChange={isi('alamat')} required />
          <Medan
            label="Username"
            value={f.username}
            onChange={isi('username')}
            autoCapitalize="none"
            autoCorrect="off"
            required
            petunjuk="Huruf kecil, angka, titik, garis bawah, atau strip."
          />
          <Medan label="Kata sandi" type="password" value={f.kata_sandi} onChange={isi('kata_sandi')} required petunjuk="Minimal 8 karakter." />

          {galat && <Galat pesan={galat} />}

          <Tombol varian="utama" type="submit" sibuk={sibuk} className="mt-1 h-10 w-full">
            Daftar
          </Tombol>

          <p className="text-mini leading-relaxed text-ink-3">
            Setelah mendaftar Anda sudah bisa masuk dan melihat katalog. Pemesanan aktif setelah admin
            memverifikasi toko Anda.
          </p>
        </form>
      </main>
    </div>
  );
}
