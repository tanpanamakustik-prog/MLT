import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, CircleDollarSign, Receipt, ShoppingCart, TrendingUp, Truck } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { PilihPeriode, PERIODE_AWAL, type NilaiPeriode } from '../components/common/PilihPeriode';
import { Kartu, KepalaKartu, Kosong, Lencana, Memuat, Galat } from '../components/ui/Dasar';
import { GrafikArea } from '../components/ui/Grafik';
import { BatangStatus, KartuKpi, PeringkatBatang } from '../components/ui/Kpi';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { angka, persen, rupiah, rupiahRingkas, tanggal, waktu } from '../lib/format';

const LABEL_AKTIVITAS: Record<string, string> = {
  'mulai-kerja': 'Mulai kerja',
  berangkat: 'Berangkat',
  'sampai-lokasi': 'Sampai lokasi',
  'bongkar-barang': 'Bongkar barang',
  'selesai-pengiriman': 'Selesai pengiriman',
  'kembali-gudang': 'Kembali ke gudang',
};

export default function Dashboard() {
  const [periode, setPeriode] = useState<NilaiPeriode>(PERIODE_AWAL);
  const { data, memuat, galat } = useApi<any>(`/laporan/dashboard${kueri(periode)}`);

  const tren = useMemo(
    () => (data?.tren ?? []).map((t: any) => ({ ...t, label: tanggal(t.tanggal) })),
    [data]
  );

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  const k = data.kpi;

  return (
    <>
      <JudulHalaman
        judul="Dashboard"
        deskripsi={`Ringkasan ${data.periode.label}`}
        aksi={<PilihPeriode nilai={periode} ubah={setPeriode} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi
          label="Pendapatan"
          nilai={rupiahRingkas(k.omzet)}
          nilaiPenuh={rupiah(k.omzet)}
          catatan={`${angka(k.jumlah_order)} order`}
          ikon={<CircleDollarSign size={15} />}
        />
        <KartuKpi
          label="Laba Kotor"
          nilai={rupiahRingkas(k.laba_kotor)}
          nilaiPenuh={rupiah(k.laba_kotor)}
          catatan={`Margin ${persen(k.margin)}`}
          ikon={<TrendingUp size={15} />}
        />
        <KartuKpi
          label="Pembelian"
          nilai={rupiahRingkas(k.nilai_pembelian)}
          nilaiPenuh={rupiah(k.nilai_pembelian)}
          catatan={`${angka(k.jumlah_po)} purchase order`}
          ikon={<ShoppingCart size={15} />}
        />
        <KartuKpi
          label="Nilai Stok"
          nilai={rupiahRingkas(k.nilai_stok)}
          nilaiPenuh={rupiah(k.nilai_stok)}
          catatan="Pada harga beli terakhir"
          ikon={<Boxes size={15} />}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi label="Rata-rata Order" nilai={rupiahRingkas(k.rata_order)} nilaiPenuh={rupiah(k.rata_order)} ikon={<Receipt size={15} />} />
        <KartuKpi label="Customer Aktif" nilai={angka(k.customer_aktif)} catatan="Bertransaksi pada periode ini" />
        <KartuKpi
          label="Kehadiran Hari Ini"
          nilai={`${data.absensi.hadir}/${data.absensi.total_karyawan}`}
          catatan={`${data.absensi.terlambat} terlambat`}
        />
        <KartuKpi label="Pengiriman Berjalan" nilai={angka(k.pengiriman_berjalan)} catatan="Belum ditutup" ikon={<Truck size={15} />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Kartu className="lg:col-span-2">
          <KepalaKartu judul="Tren 14 hari terakhir" deskripsi="Pendapatan dan laba kotor harian" />
          <div className="px-4 py-4">
            {tren.length === 0 ? (
              <Kosong pesan="Belum ada transaksi pada rentang ini." />
            ) : (
              <GrafikArea
                data={tren}
                sumbuX="label"
                deret={[
                  { kunci: 'omzet', label: 'Pendapatan' },
                  { kunci: 'laba', label: 'Laba kotor' },
                ]}
              />
            )}
          </div>
        </Kartu>

        <Kartu>
          <KepalaKartu judul="Produk terlaris" deskripsi={`Berdasarkan kuantitas, ${data.periode.label}`} />
          <div className="px-4 py-4">
            {data.top_produk.length === 0 ? (
              <Kosong pesan="Belum ada penjualan pada periode ini." />
            ) : (
              <PeringkatBatang
                baris={data.top_produk.map((p: any) => ({
                  label: p.nama,
                  nilai: p.qty,
                  teksNilai: `${angka(p.qty)} ${p.satuan}`,
                  keterangan: rupiahRingkas(p.revenue),
                }))}
              />
            )}
          </div>
        </Kartu>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Kartu>
          <KepalaKartu
            judul="Status stok"
            deskripsi="Seluruh produk aktif"
            aksi={
              <Link to="/inventory" className="text-[12px] font-medium text-brand hover:underline">
                Lihat stok
              </Link>
            }
          />
          <div className="px-4 py-4">
            <BatangStatus ringkas={data.ringkas_stok} />

            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-[12px] font-medium text-ink-2">Perlu perhatian</p>
              {data.peringatan_stok.length === 0 ? (
                <p className="text-[12.5px] text-ink-3">Tidak ada produk di bawah stok minimum.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {data.peringatan_stok.map((s: any) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="truncate text-ink">{s.nama}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="angka text-ink-2">
                          {angka(s.stok)} / {angka(s.stok_minimum)} {s.satuan}
                        </span>
                        <Lencana nada={s.status_stok === 'critical' ? 'kritis' : 'awas'}>
                          <AlertTriangle size={10} />
                          {s.status_stok === 'critical' ? 'Kritis' : 'Menipis'}
                        </Lencana>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Kartu>

        <Kartu>
          <KepalaKartu
            judul="Disarankan kulakan"
            deskripsi="Stok sudah menyentuh titik pesan"
            aksi={
              <Link to="/kulakan" className="text-[12px] font-medium text-brand hover:underline">
                Buka
              </Link>
            }
          />
          <div className="px-4 py-4">
            {data.saran_kulakan.length === 0 ? (
              <Kosong pesan="Tidak ada produk yang perlu dikulak hari ini." />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.saran_kulakan.map((s: any) => (
                  <li key={s.produk_id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] text-ink">{s.nama}</span>
                      <span className="shrink-0 angka text-[13px] font-medium text-ink">
                        {angka(s.saran_qty)} {s.satuan}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-ink-3">
                      Stok {angka(s.stok)} · titik pesan {angka(s.reorder_point)} ·{' '}
                      {s.hari_tersisa == null ? 'tidak bergerak' : `cukup ${s.hari_tersisa} hari`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Kartu>

        <Kartu>
          <KepalaKartu judul="Aktivitas karyawan" deskripsi="Hari ini" />
          <div className="px-4 py-4">
            {data.aktivitas.length === 0 ? (
              <Kosong pesan="Belum ada aktivitas tercatat hari ini." />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.aktivitas.map((a: any) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0">
                      <span className="text-[13px] text-ink">{a.nama}</span>
                      <span className="block truncate text-[11.5px] text-ink-3">
                        {LABEL_AKTIVITAS[a.jenis] ?? a.jenis}
                      </span>
                    </span>
                    <span className="shrink-0 angka text-[11.5px] text-ink-3">{waktu(a.waktu).split(', ')[1] ?? waktu(a.waktu)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Kartu>
      </div>
    </>
  );
}
