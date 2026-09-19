import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, Kosong, Lencana, Medan, Memuat, Pilihan, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { angka, hariIniISO, rupiah, tanggal } from '../lib/format';
import { useAuth } from '../context/AuthContext';

export function nadaKirim(s: string) {
  if (s === 'batal') return 'kritis' as const;
  if (s === 'selesai') return 'baik' as const;
  if (s === 'dikirim') return 'info' as const;
  return 'netral' as const;
}

/** Awal bulan berjalan; menjadi penyaring bawaan daftar pesanan. */
function awalBulan(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function Pesanan() {
  const { boleh } = useAuth();
  const [dari, setDari] = useState(awalBulan());
  const [sampai, setSampai] = useState(hariIniISO());
  const [statusKirim, setStatusKirim] = useState('');
  const [statusBayar, setStatusBayar] = useState('');

  const { data, memuat, galat } = useApi<any[]>(
    `/penjualan${kueri({ dari, sampai, status_kirim: statusKirim, status_bayar: statusBayar })}`
  );

  const total = (data ?? []).reduce((a, o) => a + (o.status_kirim === 'batal' ? 0 : o.total), 0);

  return (
    <>
      <JudulHalaman
        judul="Pesanan"
        deskripsi="Seluruh order penjualan"
        aksi={
          boleh('owner', 'admin', 'sales') && (
            <Link to="/penjualan/baru">
              <Tombol varian="utama"><Plus size={14} /> Pesanan baru</Tombol>
            </Link>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Medan type="date" aria-label="Dari tanggal" value={dari} onChange={(e) => setDari(e.target.value)} className="w-[150px]" />
        <Medan type="date" aria-label="Sampai tanggal" value={sampai} onChange={(e) => setSampai(e.target.value)} className="w-[150px]" />
        <Pilihan aria-label="Status pengiriman" value={statusKirim} onChange={(e) => setStatusKirim(e.target.value)} className="w-[160px]">
          <option value="">Semua pengiriman</option>
          {['baru', 'diproses', 'dikirim', 'selesai', 'batal'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Pilihan>
        <Pilihan aria-label="Status pembayaran" value={statusBayar} onChange={(e) => setStatusBayar(e.target.value)} className="w-[160px]">
          <option value="">Semua pembayaran</option>
          {['belum', 'sebagian', 'lunas'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Pilihan>
      </div>

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <Memuat />
        ) : (data ?? []).length === 0 ? (
          <Kosong pesan="Tidak ada pesanan pada rentang ini." />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5 text-[12.5px]">
              <span className="text-ink-2">{angka(data!.length)} pesanan</span>
              <span className="text-ink-2">
                Nilai pesanan aktif <span className="angka font-semibold text-ink">{rupiah(total)}</span>
              </span>
            </div>
            <Tabel>
              <thead>
                <tr>
                  <Th>Nomor</Th>
                  <Th>Tanggal</Th>
                  <Th>Customer</Th>
                  <Th>Sales</Th>
                  <Th kanan>Item</Th>
                  <Th kanan>Total</Th>
                  <Th>Pembayaran</Th>
                  <Th>Pengiriman</Th>
                </tr>
              </thead>
              <tbody>
                {data!.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-2">
                    <Td>
                      <Link to={`/penjualan/${o.id}`} className="font-medium text-ink hover:text-brand hover:underline">{o.nomor}</Link>
                    </Td>
                    <Td>{tanggal(o.tanggal)}</Td>
                    <Td>{o.customer}</Td>
                    <Td>{o.sales ?? '—'}</Td>
                    <Td kanan>{angka(o.jumlah_item)}</Td>
                    <Td kanan>{rupiah(o.total)}</Td>
                    <Td><Lencana nada={o.status_bayar === 'lunas' ? 'baik' : 'awas'}>{o.status_bayar}</Lencana></Td>
                    <Td><Lencana nada={nadaKirim(o.status_kirim)}>{o.status_kirim}</Lencana></Td>
                  </tr>
                ))}
              </tbody>
            </Tabel>
          </>
        )}
      </Kartu>
    </>
  );
}
