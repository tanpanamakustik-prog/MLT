import { useState } from 'react';
import { Download } from 'lucide-react';
import { JudulHalaman } from '../../components/layout/AppShell';
import { PilihPeriode, PERIODE_AWAL, type NilaiPeriode } from '../../components/common/PilihPeriode';
import { Galat, Kartu, Kosong, Lencana, Memuat, Tabel, Td, Th, Tombol } from '../../components/ui/Dasar';
import { useApi } from '../../lib/useApi';
import { kueri } from '../../lib/api';
import { angka, rupiah } from '../../lib/format';
import { eksporExcel } from '../../components/common/ekspor';

/**
 * Menilai keseimbangan beli dan jual per produk pada periode yang sama.
 *
 * Dihitung dari selisihnya, bukan dari rasio, agar produk bergerak lambat
 * dengan angka kecil tidak tampil sebagai penyimpangan besar hanya karena
 * pembaginya kecil.
 */
function nilaiKeseimbangan(diterima: number, terjual: number) {
  const selisih = diterima - terjual;
  const ambang = Math.max(10, terjual * 0.25);
  if (selisih > ambang) return { label: 'Beli berlebih', nada: 'awas' as const };
  if (selisih < -ambang) return { label: 'Jual melampaui beli', nada: 'info' as const };
  return { label: 'Seimbang', nada: 'baik' as const };
}

export default function LaporanKulakan() {
  const [periode, setPeriode] = useState<NilaiPeriode>(PERIODE_AWAL);
  const { data, memuat, galat } = useApi<any>(`/laporan/kulakan${kueri(periode)}`);
  const baris = data?.baris ?? [];
  const total = baris.reduce((a: number, b: any) => a + b.nilai_pembelian, 0);

  return (
    <>
      <JudulHalaman
        judul="Laporan kulakan"
        deskripsi={data ? data.periode.label : 'Pembelian per produk dan perbandingannya dengan penjualan'}
        aksi={
          <>
            <PilihPeriode nilai={periode} ubah={setPeriode} />
            <Tombol
              disabled={baris.length === 0}
              onClick={() =>
                eksporExcel(
                  `laporan-kulakan-${data.periode.mulai}-sd-${data.periode.selesai}`,
                  baris.map((b: any) => ({
                    SKU: b.sku, Produk: b.nama, 'Qty dipesan': b.qty_dipesan, 'Qty diterima': b.qty_diterima,
                    'Nilai pembelian': b.nilai_pembelian, 'Harga rata-rata': b.harga_rata,
                    Supplier: b.jumlah_supplier, 'Qty terjual': b.qty_terjual, 'Stok akhir': b.stok_sekarang,
                  })),
                  'Kulakan'
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
        <Kartu><Kosong pesan="Belum ada pembelian pada periode ini." /></Kartu>
      ) : (
        <Kartu>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5 text-[12.5px]">
            <span className="text-ink-2">{angka(baris.length)} produk dibeli</span>
            <span className="text-ink-2">Total pembelian <span className="angka font-semibold text-ink">{rupiah(total)}</span></span>
          </div>
          <Tabel className="min-w-[840px]">
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th kanan>Dipesan</Th>
                <Th kanan>Diterima</Th>
                <Th kanan>Harga rata-rata</Th>
                <Th kanan>Nilai pembelian</Th>
                <Th kanan>Supplier</Th>
                <Th kanan>Terjual</Th>
                <Th kanan>Stok akhir</Th>
                <Th>Catatan</Th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b: any) => {
                const nilai = nilaiKeseimbangan(b.qty_diterima, b.qty_terjual);
                return (
                  <tr key={b.id} className="hover:bg-surface-2">
                    <Td>
                      <span className="font-medium text-ink">{b.nama}</span>
                      <span className="block text-[11.5px] text-ink-3">{b.sku}</span>
                    </Td>
                    <Td kanan>{angka(b.qty_dipesan)}</Td>
                    <Td kanan>{angka(b.qty_diterima)}</Td>
                    <Td kanan>{rupiah(b.harga_rata)}</Td>
                    <Td kanan>{rupiah(b.nilai_pembelian)}</Td>
                    <Td kanan>{angka(b.jumlah_supplier)}</Td>
                    <Td kanan>{angka(b.qty_terjual)}</Td>
                    <Td kanan>{angka(b.stok_sekarang)}</Td>
                    <Td><Lencana nada={nilai.nada}>{nilai.label}</Lencana></Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabel>
        </Kartu>
      )}
    </>
  );
}
