import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, KepalaKartu, Kosong, Lencana, Memuat, Tabel, Td, Th } from '../components/ui/Dasar';
import { KartuKpi } from '../components/ui/Kpi';
import { useApi } from '../lib/useApi';
import { angka, rupiah, rupiahRingkas, tanggal } from '../lib/format';

export default function CustomerDetail() {
  const { id } = useParams();
  const { data, memuat, galat } = useApi<any>(`/master/customer/${id}`);

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  return (
    <>
      <Link to="/customer" className="mb-3 inline-flex items-center gap-1.5 text-kecil text-ink-2 hover:text-ink">
        <ArrowLeft size={14} /> Kembali ke daftar customer
      </Link>

      <JudulHalaman judul={data.nama} deskripsi={`${data.kode ?? '—'} · ${data.tipe} · sales ${data.sales ?? 'belum ditentukan'}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi label="Total transaksi" nilai={rupiahRingkas(data.ringkas.total_belanja)} nilaiPenuh={rupiah(data.ringkas.total_belanja)} />
        <KartuKpi label="Jumlah order" nilai={angka(data.ringkas.jumlah_order)} />
        <KartuKpi label="Rata-rata order" nilai={rupiahRingkas(data.ringkas.rata_order)} nilaiPenuh={rupiah(data.ringkas.rata_order)} />
        <KartuKpi label="Order terakhir" nilai={tanggal(data.ringkas.order_terakhir)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Kartu>
          <KepalaKartu judul="Data customer" />
          <dl className="flex flex-col gap-2.5 px-4 py-4 text-kecil">
            {[
              ['Alamat', data.alamat ?? '—'],
              ['Nomor HP', data.no_hp ?? '—'],
              ['Limit kredit', data.limit_kredit > 0 ? rupiah(data.limit_kredit) : 'Tanpa batas'],
              ['Status', data.status],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-right text-ink">{v as string}</dd>
              </div>
            ))}
          </dl>
        </Kartu>

        <Kartu className="lg:col-span-2">
          <KepalaKartu judul="Riwayat pesanan" deskripsi="20 pesanan terakhir" />
          {data.riwayat.length === 0 ? (
            <Kosong pesan="Customer ini belum pernah memesan." />
          ) : (
            <Tabel>
              <thead>
                <tr>
                  <Th>Nomor</Th>
                  <Th>Tanggal</Th>
                  <Th kanan>Total</Th>
                  <Th>Pembayaran</Th>
                  <Th>Pengiriman</Th>
                </tr>
              </thead>
              <tbody>
                {data.riwayat.map((o: any) => (
                  <tr key={o.id} className="transition-colors duration-150 hover:bg-surface-2">
                    <Td>
                      <Link to={`/penjualan/${o.id}`} className="font-medium text-ink hover:text-brand-teks hover:underline">{o.nomor}</Link>
                    </Td>
                    <Td>{tanggal(o.tanggal)}</Td>
                    <Td kanan>{rupiah(o.total)}</Td>
                    <Td><Lencana nada={o.status_bayar === 'lunas' ? 'baik' : 'awas'}>{o.status_bayar}</Lencana></Td>
                    <Td><Lencana nada={o.status_kirim === 'batal' ? 'kritis' : o.status_kirim === 'selesai' ? 'baik' : 'netral'}>{o.status_kirim}</Lencana></Td>
                  </tr>
                ))}
              </tbody>
            </Tabel>
          )}
        </Kartu>
      </div>
    </>
  );
}
