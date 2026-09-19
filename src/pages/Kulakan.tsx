import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ShoppingCart } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, KepalaKartu, Kosong, Lencana, Memuat, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { KartuKpi } from '../components/ui/Kpi';
import { useApi } from '../lib/useApi';
import { api, GalatApi } from '../lib/api';
import { angka, rupiah, rupiahRingkas } from '../lib/format';
import { eksporExcel } from '../components/common/ekspor';
import { useAuth } from '../context/AuthContext';

export default function Kulakan() {
  const { boleh } = useAuth();
  const navigasi = useNavigate();
  const { data, memuat, galat } = useApi<any[]>('/kulakan/saran');
  const [hanyaPerlu, setHanyaPerlu] = useState(true);
  const [dipilih, setDipilih] = useState<Set<number>>(new Set());
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const baris = useMemo(
    () => (hanyaPerlu ? (data ?? []).filter((d) => d.perlu_kulakan) : data ?? []),
    [data, hanyaPerlu]
  );
  const perluSemua = (data ?? []).filter((d) => d.perlu_kulakan);
  const biayaPerlu = perluSemua.reduce((a, d) => a + d.perkiraan_biaya, 0);
  const biayaDipilih = (data ?? []).filter((d) => dipilih.has(d.produk_id)).reduce((a, d) => a + d.perkiraan_biaya, 0);

  /**
   * Membuat purchase order dari baris terpilih.
   *
   * Produk dikelompokkan per supplier, satu PO per supplier: pesanan ke dua
   * pemasok berbeda tidak bisa dijadikan satu dokumen. Produk yang belum punya
   * supplier dilewati dan disebut namanya, bukan diam-diam dibuang.
   */
  async function buatPO() {
    setGalatAksi(null);
    const terpilih = (data ?? []).filter((d) => dipilih.has(d.produk_id) && d.saran_qty > 0);
    if (terpilih.length === 0) return setGalatAksi('Pilih minimal satu produk dengan saran pembelian di atas nol.');

    const tanpaSupplier = terpilih.filter((t) => !t.supplier_id);
    if (tanpaSupplier.length) {
      return setGalatAksi(
        `Tentukan supplier lebih dulu untuk: ${tanpaSupplier.map((t) => t.nama).join(', ')}.`
      );
    }

    const perSupplier = new Map<number, any[]>();
    for (const t of terpilih) {
      const daftar = perSupplier.get(t.supplier_id) ?? [];
      daftar.push(t);
      perSupplier.set(t.supplier_id, daftar);
    }

    setSibuk(true);
    try {
      for (const [supplierId, item] of perSupplier) {
        await api.post('/kulakan', {
          supplier_id: supplierId,
          catatan: 'Dibuat dari saran kulakan',
          item: item.map((i) => ({ produk_id: i.produk_id, qty: i.saran_qty })),
        });
      }
      navigasi('/kulakan/po');
    } catch (e) {
      setGalatAksi(e instanceof GalatApi ? e.message : 'Gagal membuat purchase order.');
    } finally {
      setSibuk(false);
    }
  }

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  return (
    <>
      <JudulHalaman
        judul="Saran kulakan"
        deskripsi="Kebutuhan pembelian dihitung dari rata-rata penjualan, lead time supplier, dan safety stock"
        aksi={
          <>
            <Tombol
              onClick={() =>
                eksporExcel(
                  'saran-kulakan',
                  baris.map((b) => ({
                    SKU: b.sku, Produk: b.nama, Stok: b.stok, 'Rata-rata harian': b.avg_harian,
                    'Lead time (hari)': b.lead_time_hari, 'Safety stock': b.safety_stock,
                    'Titik pesan': b.reorder_point, 'Saran beli': b.saran_qty,
                    'Perkiraan biaya': b.perkiraan_biaya, Supplier: b.supplier,
                  })),
                  'Saran Kulakan'
                )
              }
            >
              <Download size={14} /> Excel
            </Tombol>
            {boleh('owner', 'admin', 'gudang') && (
              <Tombol varian="utama" onClick={buatPO} sibuk={sibuk} disabled={dipilih.size === 0}>
                <ShoppingCart size={14} /> Buat PO ({dipilih.size})
              </Tombol>
            )}
          </>
        }
      />

      {galatAksi && <div className="mb-3"><Galat pesan={galatAksi} /></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi label="Perlu dikulak" nilai={angka(perluSemua.length)} catatan="Stok di bawah titik pesan" nada={perluSemua.length > 0 ? 'kritis' : undefined} />
        <KartuKpi label="Perkiraan biaya" nilai={rupiahRingkas(biayaPerlu)} nilaiPenuh={rupiah(biayaPerlu)} catatan="Bila seluruhnya dibeli" />
        <KartuKpi label="Dipilih" nilai={angka(dipilih.size)} />
        <KartuKpi label="Biaya pilihan" nilai={rupiahRingkas(biayaDipilih)} nilaiPenuh={rupiah(biayaDipilih)} />
      </div>

      <Kartu className="mt-4">
        <KepalaKartu
          judul={hanyaPerlu ? 'Produk yang perlu dikulak' : 'Seluruh produk'}
          aksi={
            <Tombol onClick={() => setHanyaPerlu((v) => !v)}>
              {hanyaPerlu ? 'Tampilkan semua' : 'Hanya yang perlu'}
            </Tombol>
          }
        />
        {baris.length === 0 ? (
          <Kosong pesan="Tidak ada produk yang menyentuh titik pesan. Stok masih aman." />
        ) : (
          <Tabel className="min-w-[860px]">
            <thead>
              <tr>
                <Th className="w-[36px]" />
                <Th>Produk</Th>
                <Th kanan>Stok</Th>
                <Th kanan>Jual/hari</Th>
                <Th kanan>Lead time</Th>
                <Th kanan>Safety</Th>
                <Th kanan>Titik pesan</Th>
                <Th kanan>Saran beli</Th>
                <Th kanan>Perkiraan biaya</Th>
                <Th>Supplier</Th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.produk_id} className="transition-colors duration-150 hover:bg-surface-2">
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${b.nama}`}
                      checked={dipilih.has(b.produk_id)}
                      onChange={(e) =>
                        setDipilih((s) => {
                          const baru = new Set(s);
                          e.target.checked ? baru.add(b.produk_id) : baru.delete(b.produk_id);
                          return baru;
                        })
                      }
                      className="h-4 w-4 accent-[var(--dh-brand)]"
                    />
                  </Td>
                  <Td>
                    <span className="font-medium text-ink">{b.nama}</span>
                    <span className="block text-mikro text-ink-3">
                      {b.sku} ·{' '}
                      {b.hari_tersisa == null ? 'tidak bergerak 30 hari' : `stok cukup ${b.hari_tersisa} hari lagi`}
                    </span>
                  </Td>
                  <Td kanan>{angka(b.stok)}</Td>
                  <Td kanan>{b.avg_harian.toLocaleString('id-ID')}</Td>
                  <Td kanan>{b.lead_time_hari} hari</Td>
                  <Td kanan>{angka(b.safety_stock)}</Td>
                  <Td kanan>{angka(b.reorder_point)}</Td>
                  <Td kanan className="font-semibold">{angka(b.saran_qty)} {b.satuan}</Td>
                  <Td kanan>{rupiah(b.perkiraan_biaya)}</Td>
                  <Td>
                    {b.supplier ?? <Lencana nada="awas">belum ada</Lencana>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>

      <p className="mt-3 max-w-3xl text-mini leading-relaxed text-ink-3">
        Titik pesan = rata-rata penjualan harian × lead time supplier + safety stock. Saran pembelian mengarahkan stok ke
        titik pesan ditambah cakupan penjualan beberapa hari, lalu dibulatkan ke kelipatan pembelian produk — sehingga
        setelah barang datang, stok benar-benar berada di atas ambang, bukan persis menyentuhnya.
      </p>
    </>
  );
}
