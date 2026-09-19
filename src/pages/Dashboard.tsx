import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, ShoppingCart, Truck, Users } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { PilihPeriode, PERIODE_AWAL, type NilaiPeriode } from '../components/common/PilihPeriode';
import { Galat, Kartu, KepalaKartu, Kosong, Lencana, Rangka, RangkaKartu } from '../components/ui/Dasar';
import { GrafikArea } from '../components/ui/Grafik';
import { AngkaUtama, BatangStatus, KartuKpi, PeringkatBatang } from '../components/ui/Kpi';
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

const namaAktivitas = (jenis: string) =>
  LABEL_AKTIVITAS[jenis] ?? (jenis.startsWith('pengiriman:') ? `Pengiriman — ${jenis.split(':')[1]}` : jenis);

function RangkaDashboard() {
  return (
    <>
      <Kartu className="px-5 py-6">
        <Rangka className="h-3 w-24" />
        <Rangka className="mt-3 h-10 w-64" />
        <Rangka className="mt-4 h-3 w-40" />
        <div className="mt-6 flex gap-8 border-t border-line pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex-1">
              <Rangka className="h-2.5 w-16" />
              <Rangka className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
      </Kartu>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Kartu key={i} className="px-4 py-3.5">
            <Rangka className="h-2.5 w-20" />
            <Rangka className="mt-3 h-5 w-24" />
          </Kartu>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Kartu className="lg:col-span-2"><RangkaKartu tinggi="h-72" /></Kartu>
        <Kartu><RangkaKartu tinggi="h-72" /></Kartu>
      </div>
    </>
  );
}

export default function Dashboard() {
  const [periode, setPeriode] = useState<NilaiPeriode>(PERIODE_AWAL);
  const { data, memuat, galat } = useApi<any>(`/laporan/dashboard${kueri(periode)}`);

  const tren = useMemo(
    () => (data?.tren ?? []).map((t: any) => ({ ...t, label: tanggal(t.tanggal) })),
    [data]
  );

  if (galat) return <Galat pesan={galat} />;

  const k = data?.kpi;
  const banding = data?.pembanding;
  /* Sistem tanpa produk sama sekali berbeda dari sistem yang produknya semua
     aman. Keduanya menghasilkan angka nol yang sama, tapi yang pertama butuh
     diarahkan untuk mengisi, bukan diberi tahu bahwa stoknya baik-baik saja. */
  const adaProduk = data ? Object.values(data.ringkas_stok as Record<string, number>).some((n) => n > 0) : false;

  return (
    <>
      <JudulHalaman
        judul="Dashboard"
        deskripsi={data ? `Ringkasan ${data.periode.label}` : 'Memuat ringkasan…'}
        aksi={<PilihPeriode nilai={periode} ubah={setPeriode} />}
      />

      {memuat || !data ? (
        <RangkaDashboard />
      ) : (
        <>
          <AngkaUtama
            label="Pendapatan"
            nilai={rupiahRingkas(k.omzet)}
            nilaiPenuh={rupiah(k.omzet)}
            selisih={data.pertumbuhan.omzet}
            bandingDengan={
              banding.sebagian
                ? `${banding.label} pada rentang hari yang sama`
                : banding.label
            }
            pendukung={[
              { label: 'Laba kotor', nilai: rupiahRingkas(k.laba_kotor), judulPenuh: rupiah(k.laba_kotor) },
              { label: 'Margin', nilai: persen(k.margin) },
              { label: 'Order', nilai: angka(k.jumlah_order) },
              { label: 'Rata-rata order', nilai: rupiahRingkas(k.rata_order), judulPenuh: rupiah(k.rata_order) },
              { label: 'Customer aktif', nilai: angka(k.customer_aktif) },
            ]}
          />

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KartuKpi
              label="Pembelian"
              nilai={rupiahRingkas(k.nilai_pembelian)}
              nilaiPenuh={rupiah(k.nilai_pembelian)}
              catatan={`${angka(k.jumlah_po)} purchase order`}
              ikon={<ShoppingCart size={15} />}
            />
            <KartuKpi
              label="Nilai stok"
              nilai={rupiahRingkas(k.nilai_stok)}
              nilaiPenuh={rupiah(k.nilai_stok)}
              catatan="Pada harga beli terakhir"
              ikon={<Boxes size={15} />}
            />
            <KartuKpi
              label="Kehadiran hari ini"
              nilai={`${data.absensi.hadir}/${data.absensi.total_karyawan}`}
              catatan={data.absensi.terlambat > 0 ? `${data.absensi.terlambat} terlambat` : 'Tidak ada keterlambatan'}
              ikon={<Users size={15} />}
            />
            <KartuKpi
              label="Pengiriman berjalan"
              nilai={angka(k.pengiriman_berjalan)}
              catatan="Belum ditutup"
              ikon={<Truck size={15} />}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Kartu className="lg:col-span-2">
              <KepalaKartu judul="Tren 14 hari terakhir" deskripsi="Pendapatan dan laba kotor harian" />
              <div className="px-4 pb-4">
                {tren.length === 0 ? (
                  <Kosong
                    judul="Belum ada transaksi"
                    pesan="Grafik ini terisi begitu ada pesanan tercatat pada dua minggu terakhir."
                  />
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
              <div className="px-4 pb-4">
                {data.top_produk.length === 0 ? (
                  <Kosong
                    judul="Belum ada penjualan"
                    pesan="Peringkat produk muncul setelah ada pesanan pada periode ini."
                  />
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
                  <Link to="/inventory" className="text-mini font-medium text-brand-teks hover:underline">
                    Lihat stok
                  </Link>
                }
              />
              <div className="px-4 pb-4">
                <BatangStatus ringkas={data.ringkas_stok} />

                <div className="mt-5 border-t border-line pt-3.5">
                  <p className="mb-2.5 text-mini font-medium text-ink-2">Perlu perhatian</p>
                  {data.peringatan_stok.length === 0 ? (
                    <p className="text-kecil leading-relaxed text-ink-3">
                      {adaProduk
                        ? 'Tidak ada produk di bawah stok minimum.'
                        : 'Belum ada produk terdaftar.'}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {data.peringatan_stok.map((s: any) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-kecil">
                          <span className="truncate text-ink">{s.nama}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="angka text-mini text-ink-2">
                              {angka(s.stok)} / {angka(s.stok_minimum)}
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
                  <Link to="/kulakan" className="text-mini font-medium text-brand-teks hover:underline">
                    Buka
                  </Link>
                }
              />
              <div className="px-4 pb-4">
                {data.saran_kulakan.length === 0 ? (
                  adaProduk ? (
                    <Kosong
                      judul="Stok masih aman"
                      pesan="Tidak ada produk yang menyentuh titik pesan hari ini. Halaman kulakan tetap bisa dibuka untuk melihat seluruh produk."
                    />
                  ) : (
                    <Kosong
                      judul="Belum ada produk"
                      pesan="Saran pembelian dihitung dari riwayat penjualan tiap produk. Tambahkan produk lebih dulu, lalu catat kulakan dan penjualannya."
                      aksi={
                        <Link to="/produk" className="text-mini font-medium text-brand-teks hover:underline">
                          Buka halaman produk
                        </Link>
                      }
                    />
                  )
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.saran_kulakan.map((s: any) => (
                      <li key={s.produk_id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-kecil text-ink">{s.nama}</span>
                          <span className="angka shrink-0 text-kecil font-semibold text-ink">
                            {angka(s.saran_qty)} {s.satuan}
                          </span>
                        </div>
                        <p className="mt-0.5 text-mikro text-ink-3">
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
              <KepalaKartu
                judul="Aktivitas karyawan"
                deskripsi="Hari ini"
                aksi={
                  <Link to="/karyawan/aktivitas" className="text-mini font-medium text-brand-teks hover:underline">
                    Semua
                  </Link>
                }
              />
              <div className="px-4 pb-4">
                {data.aktivitas.length === 0 ? (
                  <Kosong
                    judul="Belum ada aktivitas"
                    pesan="Jejak kerja lapangan muncul di sini begitu karyawan mencatat aktivitas dari aplikasi."
                  />
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {data.aktivitas.map((a: any) => (
                      <li key={a.id} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-kecil text-ink">{a.nama}</span>
                          <span className="block truncate text-mikro text-ink-3">{namaAktivitas(a.jenis)}</span>
                        </span>
                        <span className="angka shrink-0 text-mikro text-ink-3">
                          {waktu(a.waktu).split(', ')[1] ?? waktu(a.waktu)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Kartu>
          </div>
        </>
      )}
    </>
  );
}
