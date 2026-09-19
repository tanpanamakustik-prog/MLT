import { useEffect, useState } from 'react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, KepalaKartu, Medan, Memuat, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi } from '../lib/api';
import { ambilLokasi } from '../lib/perangkat';

export default function Pengaturan() {
  const { data, memuat, galat } = useApi<Record<string, string>>('/master/pengaturan');
  const [form, setForm] = useState<Record<string, string>>({});
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function simpan() {
    setGalatAksi(null);
    setSibuk(true);
    try {
      await api.put('/master/pengaturan', form);
      setTersimpan(true);
    } catch (e) {
      setGalatAksi(e instanceof GalatApi ? e.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSibuk(false);
    }
  }

  /* Titik absensi paling mudah diisi dengan berdiri di kantor lalu menekan
     tombol ini, alih-alih menyalin koordinat dari peta. */
  async function pakaiLokasiSaatIni() {
    setGalatAksi(null);
    try {
      const p = await ambilLokasi();
      setForm((f) => ({ ...f, absensi_lat: String(p.lat), absensi_lng: String(p.lng) }));
    } catch (e) {
      setGalatAksi(e instanceof Error ? e.message : 'Lokasi tidak terbaca.');
    }
  }

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  const ubah = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setTersimpan(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  return (
    <div className="max-w-2xl">
      <JudulHalaman judul="Pengaturan" deskripsi="Berlaku untuk seluruh pengguna sistem" />

      <div className="flex flex-col gap-4">
        <Kartu>
          <KepalaKartu judul="Identitas" />
          <div className="px-4 py-4">
            <Medan label="Nama usaha" value={form.nama_usaha ?? ''} onChange={ubah('nama_usaha')} />
          </div>
        </Kartu>

        <Kartu>
          <KepalaKartu judul="Absensi" deskripsi="Titik dan radius yang dipakai memvalidasi absen masuk dan pulang" />
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
            <Medan label="Latitude kantor" value={form.absensi_lat ?? ''} onChange={ubah('absensi_lat')} />
            <Medan label="Longitude kantor" value={form.absensi_lng ?? ''} onChange={ubah('absensi_lng')} />
            <div className="sm:col-span-2">
              <Tombol onClick={pakaiLokasiSaatIni}>Pakai lokasi saya sekarang</Tombol>
            </div>
            <Medan
              label="Radius absensi (meter)"
              type="number"
              value={form.absensi_radius_m ?? ''}
              onChange={ubah('absensi_radius_m')}
              petunjuk="Absen di luar radius tetap tersimpan, tetapi ditandai untuk ditinjau."
            />
            <Medan
              label="Batas jam masuk"
              value={form.absensi_jam_masuk ?? ''}
              onChange={ubah('absensi_jam_masuk')}
              petunjuk="Format HH:MM:SS. Absen setelah jam ini berstatus terlambat."
            />
          </div>
        </Kartu>

        <Kartu>
          <KepalaKartu judul="Saran kulakan" deskripsi="Dua angka yang menentukan titik pesan dan besar saran pembelian" />
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
            <Medan
              label="Hari riwayat penjualan"
              type="number"
              value={form.kulakan_hari_riwayat ?? ''}
              onChange={ubah('kulakan_hari_riwayat')}
              petunjuk="Panjang riwayat untuk menghitung rata-rata penjualan harian."
            />
            <Medan
              label="Hari cakupan"
              type="number"
              value={form.kulakan_hari_cakupan ?? ''}
              onChange={ubah('kulakan_hari_cakupan')}
              petunjuk="Berapa hari penjualan yang harus tertutup di atas titik pesan setelah barang datang."
            />
          </div>
        </Kartu>

        {galatAksi && <Galat pesan={galatAksi} />}
        {tersimpan && (
          <div className="rounded-lg border border-good/30 bg-good/8 px-3 py-2 text-kecil text-good-teks">Pengaturan tersimpan.</div>
        )}

        <div>
          <Tombol varian="utama" onClick={simpan} sibuk={sibuk}>Simpan pengaturan</Tombol>
        </div>
      </div>
    </div>
  );
}
