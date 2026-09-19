import { useState } from 'react';
import { Link } from 'react-router-dom';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, Kosong, Lencana, Memuat, Pilihan, Tabel, Td, Th, RangkaTabel } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { rupiah, waktu } from '../lib/format';

export const LANGKAH = ['ditugaskan', 'berangkat', 'sampai', 'bongkar', 'diterima', 'selesai'] as const;

export function nadaKirim(s: string) {
  if (s === 'gagal') return 'kritis' as const;
  if (s === 'selesai') return 'baik' as const;
  if (s === 'ditugaskan') return 'netral' as const;
  return 'info' as const;
}

export default function Pengiriman() {
  const [status, setStatus] = useState('');
  const { data, memuat, galat } = useApi<any[]>(`/operasional/pengiriman${kueri({ status })}`);

  return (
    <>
      <JudulHalaman judul="Pengiriman" deskripsi="Tugas kirim beserta jejak perjalanannya" />

      <Pilihan aria-label="Saring status" value={status} onChange={(e) => setStatus(e.target.value)} className="mb-3 w-[180px]">
        <option value="">Semua status</option>
        {[...LANGKAH, 'gagal'].map((s) => <option key={s} value={s}>{s}</option>)}
      </Pilihan>

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <RangkaTabel />
        ) : (data ?? []).length === 0 ? (
          <Kosong pesan="Tidak ada tugas pengiriman dengan status ini." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Nomor</Th>
                <Th>Customer</Th>
                <Th>Driver</Th>
                <Th kanan>Nilai</Th>
                <Th>Mulai</Th>
                <Th>Selesai</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data!.map((g) => (
                <tr key={g.id} className="transition-colors duration-150 hover:bg-surface-2">
                  <Td>
                    <Link to={`/pengiriman/${g.id}`} className="font-medium text-ink hover:text-brand-teks hover:underline">{g.nomor}</Link>
                    <span className="block text-mikro text-ink-3">{g.nomor_pesanan}</span>
                  </Td>
                  <Td>
                    <span className="text-ink">{g.customer}</span>
                    <span className="block max-w-[260px] truncate text-mikro text-ink-3">{g.alamat ?? '—'}</span>
                  </Td>
                  <Td>{g.driver ?? '—'}</Td>
                  <Td kanan>{rupiah(g.total)}</Td>
                  <Td>{waktu(g.dimulai_pada)}</Td>
                  <Td>{waktu(g.selesai_pada)}</Td>
                  <Td><Lencana nada={nadaKirim(g.status)}>{g.status}</Lencana></Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
