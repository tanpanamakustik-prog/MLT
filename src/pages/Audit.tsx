import { useState } from 'react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, Kosong, Lencana, Medan, Memuat, Pilihan, Tabel, Td, Th } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { hariIniISO, waktu } from '../lib/format';

const NADA_AKSI: Record<string, 'baik' | 'awas' | 'kritis' | 'netral' | 'info'> = {
  tambah: 'baik',
  ubah: 'netral',
  'ubah-harga': 'awas',
  'ubah-status': 'netral',
  adjustment: 'awas',
  opname: 'awas',
  batal: 'kritis',
  nonaktifkan: 'kritis',
  'terima-barang': 'info',
};

function tujuhHariLalu(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('sv-SE');
}

export default function Audit() {
  const [entitas, setEntitas] = useState('');
  const [dari, setDari] = useState(tujuhHariLalu());
  const [sampai, setSampai] = useState(hariIniISO());
  const { data, memuat, galat } = useApi<any[]>(`/laporan/audit${kueri({ entitas, dari, sampai })}`);

  return (
    <>
      <JudulHalaman judul="Audit log" deskripsi="Perubahan harga, stok, status, dan data penting lainnya" />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Medan type="date" aria-label="Dari tanggal" value={dari} onChange={(e) => setDari(e.target.value)} className="w-[150px]" />
        <Medan type="date" aria-label="Sampai tanggal" value={sampai} onChange={(e) => setSampai(e.target.value)} className="w-[150px]" />
        <Pilihan aria-label="Entitas" value={entitas} onChange={(e) => setEntitas(e.target.value)} className="w-[170px]">
          <option value="">Semua entitas</option>
          {['produk', 'customer', 'karyawan', 'supplier', 'pesanan', 'pembelian', 'pengiriman', 'inventory', 'pengaturan'].map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </Pilihan>
      </div>

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <Memuat />
        ) : (data ?? []).length === 0 ? (
          <Kosong pesan="Tidak ada catatan audit pada rentang ini." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Waktu</Th>
                <Th>Pengguna</Th>
                <Th>Aksi</Th>
                <Th>Entitas</Th>
                <Th>Keterangan</Th>
              </tr>
            </thead>
            <tbody>
              {data!.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <Td>{waktu(a.waktu)}</Td>
                  <Td>{a.nama_user ?? 'sistem'}</Td>
                  <Td><Lencana nada={NADA_AKSI[a.aksi] ?? 'netral'}>{a.aksi}</Lencana></Td>
                  <Td>{a.entitas}{a.entitas_id ? ` #${a.entitas_id}` : ''}</Td>
                  <Td className="max-w-[420px]">{a.ringkasan ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
