import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, Minus } from 'lucide-react';
import { JudulHalaman } from '../../components/layout/AppShell';
import { Galat, Kartu, KepalaKartu, Memuat, Pilihan, Tabel, Td, Th, Tombol } from '../../components/ui/Dasar';
import { GrafikBatang } from '../../components/ui/Grafik';
import { KartuKpi } from '../../components/ui/Kpi';
import { useApi } from '../../lib/useApi';
import { angka, persen, rupiah, rupiahRingkas, tanggal } from '../../lib/format';
import { eksporExcel } from '../../components/common/ekspor';

/** Panah arah menyertai angka pertumbuhan agar tandanya tidak hanya lewat warna. */
function Pertumbuhan({ nilai }: { nilai: number | null }) {
  if (nilai == null) return <span className="text-[12px] text-ink-3">tidak ada pembanding</span>;
  const naik = nilai > 0;
  const datar = nilai === 0;
  const Ikon = datar ? Minus : naik ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${datar ? 'text-ink-2' : naik ? 'text-good' : 'text-critical'}`}>
      <Ikon size={13} />
      {nilai > 0 ? '+' : ''}
      {persen(nilai)}
    </span>
  );
}

const BARIS_YOY: Array<{ kunci: string; label: string; uang?: boolean }> = [
  { kunci: 'omzet', label: 'Omzet', uang: true },
  { kunci: 'laba_kotor', label: 'Laba kotor', uang: true },
  { kunci: 'nilai_pembelian', label: 'Pembelian', uang: true },
  { kunci: 'jumlah_order', label: 'Jumlah order' },
  { kunci: 'customer_aktif', label: 'Customer aktif' },
  { kunci: 'qty_terjual', label: 'Kuantitas terjual' },
  { kunci: 'rata_order', label: 'Rata-rata nilai order', uang: true },
];

export default function LaporanTahunan() {
  const tahunIni = new Date().getFullYear();
  const [tahun, setTahun] = useState(String(tahunIni));

  const { data: tren, memuat: memuatTren, galat: galatTren } = useApi<any>(`/laporan/tren-bulanan?tahun=${tahun}`);
  const { data: yoy, memuat: memuatYoy } = useApi<any>(`/laporan/yoy?tahun=${tahun}`);

  if (galatTren) return <Galat pesan={galatTren} />;
  if (memuatTren || memuatYoy || !tren || !yoy) return <Memuat tinggi="h-64" />;

  return (
    <>
      <JudulHalaman
        judul="Laporan tahunan"
        deskripsi={`Tahun ${tahun} dan perbandingannya dengan ${Number(tahun) - 1}`}
        aksi={
          <>
            <Pilihan aria-label="Tahun" value={tahun} onChange={(e) => setTahun(e.target.value)} className="w-[120px]">
              {[tahunIni, tahunIni - 1, tahunIni - 2, tahunIni - 3].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Pilihan>
            <Tombol
              onClick={() =>
                eksporExcel(
                  `laporan-tahunan-${tahun}`,
                  tren.baris.map((b: any) => ({
                    Bulan: b.bulan, Omzet: b.omzet, 'Laba kotor': b.laba_kotor,
                    Pembelian: b.pembelian, 'Jumlah order': b.jumlah_order,
                  })),
                  `Tahunan ${tahun}`
                )
              }
            >
              <Download size={14} /> Excel
            </Tombol>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi label="Total omzet" nilai={rupiahRingkas(yoy.ini.omzet)} nilaiPenuh={rupiah(yoy.ini.omzet)} catatan={<Pertumbuhan nilai={yoy.pertumbuhan.omzet} />} />
        <KartuKpi label="Total pembelian" nilai={rupiahRingkas(yoy.ini.nilai_pembelian)} nilaiPenuh={rupiah(yoy.ini.nilai_pembelian)} catatan={<Pertumbuhan nilai={yoy.pertumbuhan.nilai_pembelian} />} />
        <KartuKpi label="Laba kotor" nilai={rupiahRingkas(yoy.ini.laba_kotor)} nilaiPenuh={rupiah(yoy.ini.laba_kotor)} catatan={<Pertumbuhan nilai={yoy.pertumbuhan.laba_kotor} />} />
        <KartuKpi label="Margin" nilai={persen(yoy.ini.margin)} catatan={`${angka(yoy.ini.jumlah_order)} order`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Kartu className="xl:col-span-2">
          <KepalaKartu judul={`Omzet dan pembelian per bulan — ${tahun}`} deskripsi="Keduanya dalam rupiah, pada satu sumbu" />
          <div className="px-4 py-4">
            <GrafikBatang
              data={tren.baris}
              sumbuX="bulan"
              deret={[
                { kunci: 'omzet', label: 'Omzet' },
                { kunci: 'pembelian', label: 'Pembelian' },
              ]}
            />
          </div>
        </Kartu>

        <Kartu>
          <KepalaKartu
            judul={`${tahun} dibanding ${Number(tahun) - 1}`}
            deskripsi={
              yoy.sebagian_tahun
                ? `Dipotong pada tanggal yang sama: 1 Januari – ${tanggal(yoy.ini.selesai)} di kedua tahun`
                : 'Satu tahun penuh di kedua sisi'
            }
          />
          <Tabel className="min-w-0">
            <thead>
              <tr>
                <Th>Ukuran</Th>
                <Th kanan>{Number(tahun) - 1}</Th>
                <Th kanan>{tahun}</Th>
                <Th kanan>Tumbuh</Th>
              </tr>
            </thead>
            <tbody>
              {BARIS_YOY.map((b) => (
                <tr key={b.kunci}>
                  <Td>{b.label}</Td>
                  <Td kanan>{b.uang ? rupiahRingkas(yoy.lalu[b.kunci]) : angka(yoy.lalu[b.kunci])}</Td>
                  <Td kanan>{b.uang ? rupiahRingkas(yoy.ini[b.kunci]) : angka(yoy.ini[b.kunci])}</Td>
                  <Td kanan><Pertumbuhan nilai={yoy.pertumbuhan[b.kunci]} /></Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        </Kartu>
      </div>

      <Kartu className="mt-4">
        <KepalaKartu judul="Rincian bulanan" />
        <Tabel>
          <thead>
            <tr>
              <Th>Bulan</Th>
              <Th kanan>Order</Th>
              <Th kanan>Omzet</Th>
              <Th kanan>Pembelian</Th>
              <Th kanan>Laba kotor</Th>
              <Th kanan>Margin</Th>
            </tr>
          </thead>
          <tbody>
            {tren.baris.map((b: any) => {
              /* Omzet termasuk ongkir, sedangkan laba kotor dihitung tanpa ongkir,
                 sehingga margin di sini adalah margin terhadap omzet — dipakai
                 hanya sebagai pembanding antar bulan. */
              const margin = b.omzet > 0 ? (b.laba_kotor / b.omzet) * 100 : 0;
              return (
                <tr key={b.bulan} className="hover:bg-surface-2">
                  <Td>{b.bulan}</Td>
                  <Td kanan>{angka(b.jumlah_order)}</Td>
                  <Td kanan>{rupiah(b.omzet)}</Td>
                  <Td kanan>{rupiah(b.pembelian)}</Td>
                  <Td kanan>{rupiah(b.laba_kotor)}</Td>
                  <Td kanan>{persen(margin)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Tabel>
      </Kartu>
    </>
  );
}
