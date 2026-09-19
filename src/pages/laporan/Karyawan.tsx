import { useState } from 'react';
import { Download } from 'lucide-react';
import { JudulHalaman } from '../../components/layout/AppShell';
import { PilihPeriode, PERIODE_AWAL, type NilaiPeriode } from '../../components/common/PilihPeriode';
import { Galat, Kartu, Kosong, Memuat, Tabel, Td, Th, Tombol } from '../../components/ui/Dasar';
import { useApi } from '../../lib/useApi';
import { kueri } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { eksporExcel } from '../../components/common/ekspor';

export default function LaporanKaryawan() {
  const [periode, setPeriode] = useState<NilaiPeriode>(PERIODE_AWAL);
  const { data, memuat, galat } = useApi<any>(`/laporan/karyawan${kueri(periode)}`);
  const baris = data?.baris ?? [];

  return (
    <>
      <JudulHalaman
        judul="Laporan karyawan"
        deskripsi={data ? data.periode.label : 'Kehadiran, aktivitas, pengiriman, dan kontribusi penjualan'}
        aksi={
          <>
            <PilihPeriode nilai={periode} ubah={setPeriode} />
            <Tombol
              disabled={baris.length === 0}
              onClick={() =>
                eksporExcel(
                  `laporan-karyawan-${data.periode.mulai}-sd-${data.periode.selesai}`,
                  baris.map((b: any) => ({
                    Nama: b.nama, Jabatan: b.jabatan, Hadir: b.hadir, Terlambat: b.terlambat,
                    Aktivitas: b.aktivitas, Delivery: b.delivery, 'Delivery selesai': b.delivery_selesai,
                    'Delivery gagal': b.delivery_gagal, 'Rata-rata menit delivery': b.rata_menit_delivery,
                    'Order dibawa': b.order_dibawa, Omzet: b.omzet,
                  })),
                  'Karyawan'
                )
              }
            >
              <Download size={14} /> Excel
            </Tombol>
          </>
        }
      />

      {galat ? (
        <Galat pesan={galat} />
      ) : memuat || !data ? (
        <Memuat tinggi="h-64" />
      ) : baris.length === 0 ? (
        <Kartu><Kosong pesan="Belum ada karyawan aktif." /></Kartu>
      ) : (
        <Kartu>
          <Tabel className="min-w-[900px]">
            <thead>
              <tr>
                <Th>Karyawan</Th>
                <Th kanan>Hadir</Th>
                <Th kanan>Terlambat</Th>
                <Th kanan>Aktivitas</Th>
                <Th kanan>Delivery</Th>
                <Th kanan>Selesai</Th>
                <Th kanan>Gagal</Th>
                <Th kanan>Rata-rata</Th>
                <Th kanan>Order</Th>
                <Th kanan>Omzet</Th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b: any) => (
                <tr key={b.id} className="hover:bg-surface-2">
                  <Td>
                    <span className="font-medium text-ink">{b.nama}</span>
                    <span className="block text-[11.5px] text-ink-3">{b.jabatan}</span>
                  </Td>
                  <Td kanan>{angka(b.hadir)}</Td>
                  <Td kanan className={b.terlambat > 0 ? 'text-critical' : undefined}>{angka(b.terlambat)}</Td>
                  <Td kanan>{angka(b.aktivitas)}</Td>
                  <Td kanan>{angka(b.delivery)}</Td>
                  <Td kanan>{angka(b.delivery_selesai)}</Td>
                  <Td kanan>{angka(b.delivery_gagal)}</Td>
                  <Td kanan>{b.rata_menit_delivery > 0 ? `${angka(b.rata_menit_delivery)} mnt` : '—'}</Td>
                  <Td kanan>{angka(b.order_dibawa)}</Td>
                  <Td kanan>{b.omzet > 0 ? rupiah(b.omzet) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
          <p className="border-t border-line px-4 py-2.5 text-[12px] text-ink-3">
            Kolom delivery hanya terisi untuk driver, kolom order dan omzet hanya untuk sales yang menjadi penanggung
            jawab customer.
          </p>
        </Kartu>
      )}
    </>
  );
}
