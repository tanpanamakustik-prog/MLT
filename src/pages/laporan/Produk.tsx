import { useState } from 'react';
import { Download } from 'lucide-react';
import { JudulHalaman } from '../../components/layout/AppShell';
import { PilihPeriode, PERIODE_AWAL, type NilaiPeriode } from '../../components/common/PilihPeriode';
import { Galat, Kartu, Kosong, Memuat, Tabel, Td, Th, Tombol } from '../../components/ui/Dasar';
import { PeringkatBatang } from '../../components/ui/Kpi';
import { useApi } from '../../lib/useApi';
import { kueri } from '../../lib/api';
import { angka, persen, rupiah, rupiahRingkas } from '../../lib/format';
import { eksporExcel } from '../../components/common/ekspor';

export default function LaporanProduk() {
  const [periode, setPeriode] = useState<NilaiPeriode>(PERIODE_AWAL);
  const { data, memuat, galat } = useApi<any>(`/laporan/produk${kueri(periode)}`);

  const baris = data?.baris ?? [];

  return (
    <>
      <JudulHalaman
        judul="Laporan produk"
        deskripsi={data ? data.periode.label : 'Penjualan, laba kotor, dan margin per produk'}
        aksi={
          <>
            <PilihPeriode nilai={periode} ubah={setPeriode} />
            <Tombol
              disabled={baris.length === 0}
              onClick={() =>
                eksporExcel(
                  `laporan-produk-${data.periode.mulai}-sd-${data.periode.selesai}`,
                  baris.map((b: any) => ({
                    SKU: b.sku, Produk: b.nama, Kategori: b.kategori, Qty: b.qty,
                    Revenue: b.revenue, HPP: b.hpp, 'Laba kotor': b.laba_kotor,
                    'Margin (%)': b.margin, 'Stok sekarang': b.stok_sekarang,
                  })),
                  'Produk'
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
        <Kartu><Kosong pesan="Belum ada penjualan pada periode ini." /></Kartu>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Kartu className="h-fit px-4 py-4">
            <p className="mb-3 text-[13px] font-semibold text-ink">Sepuluh penyumbang omzet terbesar</p>
            <PeringkatBatang
              baris={baris.slice(0, 10).map((b: any) => ({
                label: b.nama,
                nilai: b.revenue,
                teksNilai: rupiahRingkas(b.revenue),
                keterangan: `${angka(b.qty)} ${b.satuan}`,
              }))}
            />
          </Kartu>

          <Kartu className="lg:col-span-2">
            <Tabel className="min-w-[720px]">
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th>Kategori</Th>
                  <Th kanan>Qty</Th>
                  <Th kanan>Revenue</Th>
                  <Th kanan>HPP</Th>
                  <Th kanan>Laba kotor</Th>
                  <Th kanan>Margin</Th>
                  <Th kanan>Stok</Th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b: any) => (
                  <tr key={b.id} className="hover:bg-surface-2">
                    <Td>
                      <span className="font-medium text-ink">{b.nama}</span>
                      <span className="block text-[11.5px] text-ink-3">{b.sku}</span>
                    </Td>
                    <Td>{b.kategori ?? '—'}</Td>
                    <Td kanan>{angka(b.qty)}</Td>
                    <Td kanan>{rupiah(b.revenue)}</Td>
                    <Td kanan>{rupiah(b.hpp)}</Td>
                    <Td kanan>{rupiah(b.laba_kotor)}</Td>
                    <Td kanan>{persen(b.margin)}</Td>
                    <Td kanan>{angka(b.stok_sekarang)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabel>
          </Kartu>
        </div>
      )}
    </>
  );
}
