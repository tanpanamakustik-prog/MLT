import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, KepalaKartu, Kosong, Lencana, Medan, Memuat, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { AmbilFoto } from '../components/common/AmbilFoto';
import { useApi } from '../lib/useApi';
import { api, GalatApi } from '../lib/api';
import { angka, rupiah, waktu } from '../lib/format';
import { ambilLokasi } from '../lib/perangkat';
import { useAuth } from '../context/AuthContext';
import { LANGKAH, nadaKirim } from './Pengiriman';

const JUDUL_LANGKAH: Record<string, string> = {
  ditugaskan: 'Ditugaskan',
  berangkat: 'Berangkat dari gudang',
  sampai: 'Sampai di lokasi',
  bongkar: 'Bongkar barang',
  diterima: 'Barang diterima',
  selesai: 'Selesai',
};

export default function PengirimanDetail() {
  const { id } = useParams();
  const { pengguna } = useAuth();
  const { data, memuat, galat, muatUlang } = useApi<any>(`/operasional/pengiriman/${id}`);

  const [foto, setFoto] = useState<string | null>(null);
  const [penerima, setPenerima] = useState('');
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  /* Driver yang memegang tugas ini, atau petugas kantor yang menutup pengiriman
     atas nama driver ketika laporannya masuk lewat telepon. */
  const bisaAksi =
    !!data &&
    !['selesai', 'gagal'].includes(data.status) &&
    (pengguna?.peran !== 'driver' || data.driver_id === pengguna.karyawan_id);

  const indeksSekarang = data ? LANGKAH.indexOf(data.status) : -1;
  const berikutnya = indeksSekarang >= 0 && indeksSekarang < LANGKAH.length - 1 ? LANGKAH[indeksSekarang + 1] : null;

  async function majukan(status: string) {
    setGalatAksi(null);
    setSibuk(true);
    try {
      /* Koordinat diambil tiap langkah. Bila GPS menolak, langkahnya tetap bisa
         dicatat: menghentikan pengiriman karena sinyal buruk di gudang beton
         lebih merugikan daripada satu titik yang kosong. */
      let posisi: { lat: number; lng: number } | null = null;
      try {
        posisi = await ambilLokasi();
      } catch {
        posisi = null;
      }

      await api.patch(`/operasional/pengiriman/${id}/status`, {
        status,
        lat: posisi?.lat,
        lng: posisi?.lng,
        foto,
        penerima: status === 'diterima' ? penerima : undefined,
      });
      setFoto(null);
      setPenerima('');
      muatUlang();
    } catch (e) {
      setGalatAksi(e instanceof GalatApi ? e.message : 'Gagal memperbarui status.');
    } finally {
      setSibuk(false);
    }
  }

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  return (
    <>
      <Link to="/pengiriman" className="mb-3 inline-flex items-center gap-1.5 text-kecil text-ink-2 hover:text-ink">
        <ArrowLeft size={14} /> Kembali ke daftar pengiriman
      </Link>

      <JudulHalaman
        judul={data.nomor}
        deskripsi={`${data.customer} · ${data.nomor_pesanan}`}
        aksi={<Lencana nada={nadaKirim(data.status)}>{data.status}</Lencana>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu className="lg:col-span-2">
          <KepalaKartu judul="Barang yang dikirim" />
          <Tabel>
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th kanan>Qty</Th>
                <Th kanan>Subtotal</Th>
              </tr>
            </thead>
            <tbody>
              {data.item.map((i: any, n: number) => (
                <tr key={n}>
                  <Td>{i.nama}</Td>
                  <Td kanan>{angka(i.qty)} {i.satuan}</Td>
                  <Td kanan>{rupiah(i.subtotal)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
          <div className="flex justify-between border-t border-line px-4 py-3 text-sedang font-semibold">
            <span>Total</span>
            <span className="angka">{rupiah(data.total)}</span>
          </div>
        </Kartu>

        <div className="flex flex-col gap-4">
          <Kartu>
            <KepalaKartu judul="Tujuan" />
            <dl className="flex flex-col gap-2 px-4 py-4 text-kecil">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Customer</dt><dd className="text-right text-ink">{data.customer}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Alamat</dt><dd className="text-right text-ink">{data.alamat ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Nomor HP</dt><dd className="text-right text-ink">{data.no_hp ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Driver</dt><dd className="text-right text-ink">{data.driver ?? 'belum ditentukan'}</dd></div>
              {data.penerima && (
                <div className="flex justify-between gap-3"><dt className="text-ink-3">Diterima oleh</dt><dd className="text-right text-ink">{data.penerima}</dd></div>
              )}
            </dl>
            {data.foto_url && (
              <div className="px-4 pb-4">
                <p className="mb-1.5 text-mini font-medium text-ink-2">Bukti penerimaan</p>
                <img src={data.foto_url} alt="Bukti penerimaan" className="w-full rounded-lg border border-line" />
              </div>
            )}
          </Kartu>

          {bisaAksi && berikutnya && (
            <Kartu>
              <KepalaKartu judul="Langkah berikutnya" deskripsi={JUDUL_LANGKAH[berikutnya]} />
              <div className="flex flex-col gap-3 px-4 py-4">
                {berikutnya === 'diterima' && (
                  <>
                    <Medan label="Nama penerima" value={penerima} onChange={(e) => setPenerima(e.target.value)} />
                    <AmbilFoto label="Foto bukti penerimaan" nilai={foto} ubah={setFoto} />
                  </>
                )}
                {galatAksi && <Galat pesan={galatAksi} />}
                <Tombol varian="utama" onClick={() => majukan(berikutnya)} sibuk={sibuk} className="w-full py-2.5">
                  <MapPin size={14} /> {JUDUL_LANGKAH[berikutnya]}
                </Tombol>
                <Tombol
                  varian="bahaya"
                  onClick={() => confirm('Tandai pengiriman ini gagal? Tugas akan ditutup.') && majukan('gagal')}
                  sibuk={sibuk}
                >
                  Tandai gagal
                </Tombol>
              </div>
            </Kartu>
          )}

          <Kartu>
            <KepalaKartu judul="Timeline" />
            {data.timeline.length === 0 ? (
              <Kosong pesan="Belum ada jejak perjalanan." />
            ) : (
              <ol className="flex flex-col gap-3 px-4 py-4">
                {data.timeline.map((t: any) => (
                  <li key={t.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                    <span className="min-w-0">
                      <span className="block text-kecil text-ink">{JUDUL_LANGKAH[t.jenis.replace('pengiriman:', '')] ?? t.jenis}</span>
                      <span className="block text-mikro text-ink-3">
                        {waktu(t.waktu)}
                        {t.lat != null && ` · ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Kartu>
        </div>
      </div>
    </>
  );
}
