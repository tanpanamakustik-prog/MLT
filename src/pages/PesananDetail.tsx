import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Truck } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Dialog, Galat, Kartu, KepalaKartu, Lencana, Memuat, Pilihan, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi } from '../lib/api';
import { angka, rupiah, tanggal, waktu } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { nadaKirim } from './Pesanan';
import { cetak } from '../components/common/ekspor';

export default function PesananDetail() {
  const { id } = useParams();
  const { boleh } = useAuth();
  const { data, memuat, galat, muatUlang } = useApi<any>(`/penjualan/${id}`);
  const { data: driver } = useApi<any[]>(boleh('owner', 'admin', 'gudang') ? '/master/karyawan' : null);

  const [dialogKirim, setDialogKirim] = useState(false);
  const [driverId, setDriverId] = useState('');
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function ubahStatus(patch: Record<string, string>) {
    setGalatAksi(null);
    setSibuk(true);
    try {
      await api.patch(`/penjualan/${id}/status`, patch);
      muatUlang();
    } catch (e) {
      setGalatAksi(e instanceof GalatApi ? e.message : 'Gagal mengubah status.');
    } finally {
      setSibuk(false);
    }
  }

  async function buatPengiriman() {
    setSibuk(true);
    setGalatAksi(null);
    try {
      await api.post('/operasional/pengiriman', { pesanan_id: Number(id), driver_id: driverId ? Number(driverId) : null });
      setDialogKirim(false);
      muatUlang();
    } catch (e) {
      setGalatAksi(e instanceof GalatApi ? e.message : 'Gagal membuat tugas pengiriman.');
    } finally {
      setSibuk(false);
    }
  }

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  const dibatalkan = data.status_kirim === 'batal';

  return (
    <>
      <Link to="/penjualan" className="mb-3 inline-flex items-center gap-1.5 text-kecil text-ink-2 hover:text-ink print:hidden">
        <ArrowLeft size={14} /> Kembali ke daftar pesanan
      </Link>

      <JudulHalaman
        judul={data.nomor}
        deskripsi={`${data.customer} · ${tanggal(data.tanggal, 'panjang')}`}
        aksi={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Tombol onClick={cetak}><Printer size={14} /> Cetak</Tombol>
            {boleh('owner', 'admin', 'gudang') && !dibatalkan && (
              <Tombol onClick={() => setDialogKirim(true)}><Truck size={14} /> Buat pengiriman</Tombol>
            )}
          </div>
        }
      />

      {galatAksi && <div className="mb-3"><Galat pesan={galatAksi} /></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu className="lg:col-span-2">
          <KepalaKartu judul="Item" />
          <Tabel>
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th kanan>Qty</Th>
                <Th kanan>Harga</Th>
                <Th kanan>Subtotal</Th>
              </tr>
            </thead>
            <tbody>
              {data.item.map((i: any) => (
                <tr key={i.id}>
                  <Td>
                    <span className="text-ink">{i.nama}</span>
                    <span className="block text-mikro text-ink-3">{i.sku}</span>
                  </Td>
                  <Td kanan>{angka(i.qty)} {i.satuan}</Td>
                  <Td kanan>{rupiah(i.harga)}</Td>
                  <Td kanan>{rupiah(i.subtotal)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabel>

          <dl className="flex flex-col gap-1.5 px-4 py-3 text-kecil">
            <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd className="angka">{rupiah(data.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">Diskon</dt><dd className="angka">{data.diskon > 0 ? `−${rupiah(data.diskon)}` : rupiah(0)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">Ongkir</dt><dd className="angka">{rupiah(data.ongkir)}</dd></div>
            <div className="flex justify-between border-t border-line pt-1.5 text-sedang font-semibold"><dt>Total</dt><dd className="angka">{rupiah(data.total)}</dd></div>
          </dl>
        </Kartu>

        <div className="flex flex-col gap-4">
          <Kartu>
            <KepalaKartu judul="Status" />
            <div className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-center justify-between gap-2 text-kecil">
                <span className="text-ink-2">Pembayaran</span>
                <Lencana nada={data.status_bayar === 'lunas' ? 'baik' : 'awas'}>{data.status_bayar}</Lencana>
              </div>
              <div className="flex items-center justify-between gap-2 text-kecil">
                <span className="text-ink-2">Pengiriman</span>
                <Lencana nada={nadaKirim(data.status_kirim)}>{data.status_kirim}</Lencana>
              </div>

              {boleh('owner', 'admin', 'sales', 'gudang') && !dibatalkan && (
                <div className="flex flex-col gap-2 border-t border-line pt-3 print:hidden">
                  <Pilihan
                    label="Ubah status pembayaran"
                    value={data.status_bayar}
                    onChange={(e) => ubahStatus({ status_bayar: e.target.value })}
                    disabled={sibuk}
                  >
                    {['belum', 'sebagian', 'lunas'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </Pilihan>
                  <Tombol
                    varian="bahaya"
                    sibuk={sibuk}
                    onClick={() => {
                      /* Pembatalan mengembalikan stok, jadi dikonfirmasi dulu —
                         langkah ini tidak bisa dibatalkan dari layar mana pun. */
                      if (confirm(`Batalkan ${data.nomor}? Stok seluruh item akan dikembalikan ke gudang.`)) {
                        ubahStatus({ status_kirim: 'batal' });
                      }
                    }}
                  >
                    Batalkan pesanan
                  </Tombol>
                </div>
              )}
            </div>
          </Kartu>

          <Kartu>
            <KepalaKartu judul="Customer" />
            <dl className="flex flex-col gap-2 px-4 py-4 text-kecil">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Nama</dt><dd className="text-right text-ink">{data.customer}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Alamat</dt><dd className="text-right text-ink">{data.alamat ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Nomor HP</dt><dd className="text-right text-ink">{data.no_hp ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Sales</dt><dd className="text-right text-ink">{data.sales ?? '—'}</dd></div>
            </dl>
          </Kartu>

          {data.pengiriman.length > 0 && (
            <Kartu>
              <KepalaKartu judul="Pengiriman" />
              <ul className="flex flex-col gap-2 px-4 py-4 text-kecil">
                {data.pengiriman.map((g: any) => (
                  <li key={g.id} className="flex items-center justify-between gap-2">
                    <Link to={`/pengiriman/${g.id}`} className="text-ink hover:text-brand-teks hover:underline">{g.nomor}</Link>
                    <span className="flex items-center gap-2">
                      <span className="text-mikro text-ink-3">{g.driver ?? 'belum ada driver'}</span>
                      <Lencana nada={g.status === 'selesai' ? 'baik' : g.status === 'gagal' ? 'kritis' : 'netral'}>{g.status}</Lencana>
                    </span>
                  </li>
                ))}
              </ul>
            </Kartu>
          )}
        </div>
      </div>

      {dialogKirim && (
        <Dialog
          judul="Buat tugas pengiriman"
          tutup={() => setDialogKirim(false)}
          kaki={
            <>
              <Tombol onClick={() => setDialogKirim(false)}>Batal</Tombol>
              <Tombol varian="utama" onClick={buatPengiriman} sibuk={sibuk}>Buat</Tombol>
            </>
          }
        >
          <Pilihan label="Driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">— Tentukan nanti —</option>
            {(driver ?? []).filter((k) => k.jabatan.toLowerCase().includes('driver')).map((k) => (
              <option key={k.id} value={k.id}>{k.nama} — {k.area_kerja ?? 'tanpa rute'}</option>
            ))}
          </Pilihan>
          <p className="mt-3 text-mini text-ink-3">
            Pesanan berpindah ke status diproses. Driver akan melihat tugas ini di aplikasi lapangan beserta rincian barangnya.
          </p>
        </Dialog>
      )}
    </>
  );
}
