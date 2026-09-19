import { useState } from 'react';
import { Clock, LogIn, LogOut, MapPin } from 'lucide-react';
import { JudulHalaman } from '../../components/layout/AppShell';
import { AmbilFoto } from '../../components/common/AmbilFoto';
import { Galat, Kartu, KepalaKartu, Memuat, Tombol } from '../../components/ui/Dasar';
import { useApi } from '../../lib/useApi';
import { api, GalatApi } from '../../lib/api';
import { jam } from '../../lib/format';
import { ambilLokasi, type Foto } from '../../lib/perangkat';

export default function Absen() {
  const { data, memuat, galat, muatUlang } = useApi<any>('/operasional/absensi/hari-ini');
  const [foto, setFoto] = useState<Foto | null>(null);
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ teks: string; diLuarArea: boolean } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const absensi = data?.absensi;
  const sudahMasuk = !!absensi?.jam_masuk;
  const sudahPulang = !!absensi?.jam_pulang;

  async function kirim(sesi: 'masuk' | 'pulang') {
    setGalatAksi(null);
    setPesan(null);
    if (!foto) return setGalatAksi('Ambil foto selfie terlebih dahulu.');

    setSibuk(true);
    try {
      /* Berbeda dari langkah pengiriman, absensi tidak boleh dikirim tanpa
         koordinat: seluruh gunanya adalah membuktikan karyawan berada di
         tempat kerja. Galat GPS di sini menghentikan proses. */
      const posisi = await ambilLokasi();
      const hasil = await api.post<any>(`/operasional/absensi/${sesi}`, { ...posisi, foto });
      setFoto(null);
      setPesan({ teks: hasil.pesan, diLuarArea: hasil.di_luar_area });
      muatUlang();
    } catch (e) {
      setGalatAksi(e instanceof GalatApi || e instanceof Error ? e.message : 'Absensi gagal disimpan.');
    } finally {
      setSibuk(false);
    }
  }

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  return (
    <div className="mx-auto max-w-md">
      <JudulHalaman judul="Absensi" deskripsi="Foto selfie dan lokasi diambil bersama waktu absen" />

      <Kartu className="mb-4">
        <KepalaKartu judul="Hari ini" />
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          <div>
            <p className="text-mikro text-ink-3">Jam masuk</p>
            <p className="angka text-judul font-semibold text-ink">{jam(absensi?.jam_masuk)}</p>
          </div>
          <div>
            <p className="text-mikro text-ink-3">Jam pulang</p>
            <p className="angka text-judul font-semibold text-ink">{jam(absensi?.jam_pulang)}</p>
          </div>
        </div>
        {absensi?.jarak_masuk_m != null && (
          <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-mini text-ink-2">
            <MapPin size={13} /> Tercatat {absensi.jarak_masuk_m} m dari titik absensi (batas {data.kantor.radius} m)
          </p>
        )}
      </Kartu>

      {pesan && (
        <div
          className={`mb-4 rounded-lg px-3 py-2.5 text-kecil ${
            pesan.diLuarArea ? 'border border-warn/40 bg-warn/12 text-ink' : 'border border-good/30 bg-good/8 text-ink'
          }`}
        >
          {pesan.teks}
        </div>
      )}

      {sudahPulang ? (
        <Kartu className="px-4 py-8 text-center">
          <Clock size={22} className="mx-auto mb-2 text-ink-3" />
          <p className="text-kecil text-ink-2">Absensi hari ini sudah lengkap. Sampai jumpa besok.</p>
        </Kartu>
      ) : (
        <Kartu>
          <KepalaKartu judul={sudahMasuk ? 'Absen pulang' : 'Absen masuk'} />
          <div className="flex flex-col gap-4 px-4 py-4">
            <AmbilFoto label="Foto selfie" kameraDepan nilai={foto} ubah={setFoto} />
            {galatAksi && <Galat pesan={galatAksi} />}
            <Tombol varian="utama" onClick={() => kirim(sudahMasuk ? 'pulang' : 'masuk')} sibuk={sibuk} className="w-full py-3">
              {sudahMasuk ? <LogOut size={15} /> : <LogIn size={15} />}
              {sudahMasuk ? 'Absen pulang' : 'Absen masuk'}
            </Tombol>
            <p className="text-center text-mikro text-ink-3">
              Lokasi diambil saat tombol ditekan. Pastikan izin lokasi aktif.
            </p>
          </div>
        </Kartu>
      )}
    </div>
  );
}
