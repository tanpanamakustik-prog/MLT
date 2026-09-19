import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, Kosong, Lencana, Memuat, Tabel, Td, Th, RangkaTabel } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { angka, rupiah, tanggal } from '../lib/format';
import { nadaKirim } from './Pesanan';

export default function PesananSaya() {
  const { data, memuat, galat } = useApi<any[]>('/penjualan');

  return (
    <>
      <JudulHalaman judul="Pesanan saya" deskripsi="Riwayat pemesanan akun ini" />

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <RangkaTabel />
        ) : (data ?? []).length === 0 ? (
          <Kosong pesan="Anda belum pernah memesan. Buka katalog untuk mulai berbelanja." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Nomor</Th>
                <Th>Tanggal</Th>
                <Th kanan>Item</Th>
                <Th kanan>Total</Th>
                <Th>Pembayaran</Th>
                <Th>Pengiriman</Th>
              </tr>
            </thead>
            <tbody>
              {data!.map((o) => (
                <tr key={o.id} className="transition-colors duration-150 hover:bg-surface-2">
                  <Td><span className="font-medium text-ink">{o.nomor}</span></Td>
                  <Td>{tanggal(o.tanggal)}</Td>
                  <Td kanan>{angka(o.jumlah_item)}</Td>
                  <Td kanan>{rupiah(o.total)}</Td>
                  <Td><Lencana nada={o.status_bayar === 'lunas' ? 'baik' : 'awas'}>{o.status_bayar}</Lencana></Td>
                  <Td><Lencana nada={nadaKirim(o.status_kirim)}>{o.status_kirim}</Lencana></Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
