import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { JudulHalaman } from '../../components/layout/AppShell';
import { PilihPeriode, PERIODE_AWAL, type NilaiPeriode } from '../../components/common/PilihPeriode';
import { Galat, Kartu, KepalaKartu, Memuat, Tombol } from '../../components/ui/Dasar';
import { KartuKpi } from '../../components/ui/Kpi';
import { useApi } from '../../lib/useApi';
import { kueri } from '../../lib/api';
import { angka, persen, rupiah, rupiahRingkas } from '../../lib/format';
import { cetak, eksporExcel } from '../../components/common/ekspor';

function Blok({ judul, baris }: { judul: string; baris: Array<[string, string]> }) {
  return (
    <Kartu>
      <KepalaKartu judul={judul} />
      <dl className="flex flex-col gap-2.5 px-4 py-4 text-[13px]">
        {baris.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-ink-2">{k}</dt>
            <dd className="angka text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Kartu>
  );
}

export default function LaporanRingkas() {
  const [periode, setPeriode] = useState<NilaiPeriode>(PERIODE_AWAL);
  const { data, memuat, galat } = useApi<any>(`/laporan/ringkas${kueri(periode)}`);

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  const { penjualan: j, pembelian: b, stok: s, karyawan: k, pengiriman: g } = data;

  return (
    <>
      <JudulHalaman
        judul="Rekap periode"
        deskripsi={data.periode.label}
        aksi={
          <>
            <PilihPeriode nilai={periode} ubah={setPeriode} />
            <Tombol onClick={cetak} className="print:hidden"><Printer size={14} /> Cetak</Tombol>
            <Tombol
              className="print:hidden"
              onClick={() =>
                eksporExcel(
                  `rekap-${data.periode.mulai}-sd-${data.periode.selesai}`,
                  [
                    { Bagian: 'Penjualan', Keterangan: 'Jumlah order', Nilai: j.jumlah_order },
                    { Bagian: 'Penjualan', Keterangan: 'Total item', Nilai: j.total_item },
                    { Bagian: 'Penjualan', Keterangan: 'Omzet', Nilai: j.omzet },
                    { Bagian: 'Penjualan', Keterangan: 'Penjualan bersih', Nilai: j.penjualan_bersih },
                    { Bagian: 'Penjualan', Keterangan: 'Diskon', Nilai: j.total_diskon },
                    { Bagian: 'Penjualan', Keterangan: 'Ongkir', Nilai: j.total_ongkir },
                    { Bagian: 'Penjualan', Keterangan: 'HPP', Nilai: j.hpp },
                    { Bagian: 'Penjualan', Keterangan: 'Laba kotor', Nilai: j.laba_kotor },
                    { Bagian: 'Penjualan', Keterangan: 'Margin (%)', Nilai: j.margin },
                    { Bagian: 'Pembelian', Keterangan: 'Jumlah PO', Nilai: b.jumlah_po },
                    { Bagian: 'Pembelian', Keterangan: 'Nilai pembelian', Nilai: b.nilai_pembelian },
                    { Bagian: 'Stok', Keterangan: 'Masuk', Nilai: s.masuk },
                    { Bagian: 'Stok', Keterangan: 'Keluar', Nilai: s.keluar },
                    { Bagian: 'Stok', Keterangan: 'Penyesuaian', Nilai: s.adjustment },
                    { Bagian: 'Karyawan', Keterangan: 'Hari hadir', Nilai: k.hari_hadir },
                    { Bagian: 'Karyawan', Keterangan: 'Terlambat', Nilai: k.terlambat },
                    { Bagian: 'Karyawan', Keterangan: 'Aktivitas', Nilai: k.jumlah_aktivitas },
                    { Bagian: 'Pengiriman', Keterangan: 'Total', Nilai: g.total },
                    { Bagian: 'Pengiriman', Keterangan: 'Selesai', Nilai: g.selesai },
                  ],
                  'Rekap'
                )
              }
            >
              <Download size={14} /> Excel
            </Tombol>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi label="Omzet" nilai={rupiahRingkas(j.omzet)} nilaiPenuh={rupiah(j.omzet)} catatan={`${angka(j.jumlah_order)} order`} />
        <KartuKpi label="Pembelian" nilai={rupiahRingkas(b.nilai_pembelian)} nilaiPenuh={rupiah(b.nilai_pembelian)} catatan={`${angka(b.jumlah_po)} PO`} />
        <KartuKpi label="Laba kotor" nilai={rupiahRingkas(j.laba_kotor)} nilaiPenuh={rupiah(j.laba_kotor)} catatan={`Margin ${persen(j.margin)}`} />
        <KartuKpi label="Customer aktif" nilai={angka(j.customer_aktif)} catatan={`Rata-rata order ${rupiahRingkas(j.rata_order)}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Blok
          judul="Penjualan"
          baris={[
            ['Jumlah transaksi', angka(j.jumlah_order)],
            ['Total item terjual', angka(j.total_item)],
            ['Omzet (termasuk ongkir)', rupiah(j.omzet)],
            ['Penjualan bersih barang', rupiah(j.penjualan_bersih)],
            ['Total diskon', rupiah(j.total_diskon)],
            ['Total ongkir', rupiah(j.total_ongkir)],
            ['HPP barang terjual', rupiah(j.hpp)],
            ['Laba kotor', rupiah(j.laba_kotor)],
            ['Margin', persen(j.margin)],
          ]}
        />
        <Blok
          judul="Pembelian / kulakan"
          baris={[
            ['Jumlah purchase order', angka(b.jumlah_po)],
            ['Supplier terlibat', angka(b.jumlah_supplier)],
            ['Nilai pembelian', rupiah(b.nilai_pembelian)],
          ]}
        />
        <Blok
          judul="Pergerakan stok"
          baris={[
            ['Stok masuk', `+${angka(s.masuk)}`],
            ['Stok keluar', `−${angka(s.keluar)}`],
            ['Penyesuaian', `${s.adjustment >= 0 ? '+' : ''}${angka(s.adjustment)}`],
            ['Perubahan bersih', `${s.masuk - s.keluar + s.adjustment >= 0 ? '+' : ''}${angka(s.masuk - s.keluar + s.adjustment)}`],
          ]}
        />
        <Blok
          judul="Karyawan"
          baris={[
            ['Karyawan aktif', angka(k.total)],
            ['Pernah hadir pada periode ini', angka(k.pernah_hadir)],
            ['Total hari kehadiran', angka(k.hari_hadir)],
            ['Keterlambatan', angka(k.terlambat)],
            ['Aktivitas tercatat', angka(k.jumlah_aktivitas)],
          ]}
        />
        <Blok
          judul="Pengiriman"
          baris={[
            ['Tugas dibuat', angka(g.total)],
            ['Selesai', angka(g.selesai ?? 0)],
            ['Gagal', angka(g.gagal ?? 0)],
          ]}
        />
      </div>

      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-ink-3">
        Laba kotor dihitung dari penjualan bersih barang dikurangi HPP, tanpa memasukkan ongkir. Ongkir adalah
        penggantian biaya angkut, bukan hasil dagang; memasukkannya akan menaikkan margin setiap kali ada pengiriman
        jauh meskipun barangnya dijual dengan margin yang sama.
      </p>
    </>
  );
}
