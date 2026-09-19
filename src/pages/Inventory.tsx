import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, Kosong, Lencana, Memuat, Pilihan, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { BatangStatus, KartuKpi } from '../components/ui/Kpi';
import { useApi } from '../lib/useApi';
import { angka, rupiah, rupiahRingkas } from '../lib/format';
import { eksporExcel } from '../components/common/ekspor';

const NADA = { critical: 'kritis', low: 'awas', normal: 'baik', overstock: 'info' } as const;
const LABEL = { critical: 'Kritis', low: 'Menipis', normal: 'Normal', overstock: 'Menumpuk' } as const;

export default function Inventory() {
  const [status, setStatus] = useState('');
  const { data, memuat, galat } = useApi<any[]>('/inventory/stok');

  const baris = useMemo(() => (status ? (data ?? []).filter((d) => d.status_stok === status) : data ?? []), [data, status]);
  const ringkas = useMemo(() => {
    const r: Record<string, number> = { critical: 0, low: 0, normal: 0, overstock: 0 };
    for (const d of data ?? []) r[d.status_stok]++;
    return r;
  }, [data]);
  const nilaiStok = (data ?? []).reduce((a, d) => a + d.nilai_stok, 0);

  if (galat) return <Galat pesan={galat} />;
  if (memuat || !data) return <Memuat tinggi="h-64" />;

  return (
    <>
      <JudulHalaman
        judul="Stok"
        deskripsi="Posisi persediaan seluruh produk aktif"
        aksi={
          <Tombol
            onClick={() =>
              eksporExcel(
                'stok-mlt',
                baris.map((b) => ({
                  SKU: b.sku, Produk: b.nama, Kategori: b.kategori, Satuan: b.satuan,
                  Stok: b.stok, 'Stok minimum': b.stok_minimum, 'Harga beli': b.harga_beli,
                  'Nilai stok': b.nilai_stok, Status: LABEL[b.status_stok as keyof typeof LABEL],
                })),
                'Stok'
              )
            }
          >
            <Download size={14} /> Excel
          </Tombol>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <KartuKpi label="Nilai persediaan" nilai={rupiahRingkas(nilaiStok)} nilaiPenuh={rupiah(nilaiStok)} catatan="Pada harga beli terakhir" />
        <KartuKpi label="Produk aktif" nilai={angka(data.length)} />
        <Kartu className="px-4 py-3.5">
          <p className="mb-2.5 text-mini font-medium text-ink-2">Sebaran status</p>
          <BatangStatus ringkas={ringkas} />
        </Kartu>
      </div>

      <div className="mt-4 mb-3 flex flex-wrap items-end gap-2">
        <Pilihan aria-label="Saring status stok" value={status} onChange={(e) => setStatus(e.target.value)} className="w-[180px]">
          <option value="">Semua status</option>
          {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Pilihan>
      </div>

      <Kartu>
        {baris.length === 0 ? (
          <Kosong pesan="Tidak ada produk dengan status ini." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th>Kategori</Th>
                <Th>Supplier</Th>
                <Th kanan>Stok</Th>
                <Th kanan>Minimum</Th>
                <Th kanan>Nilai stok</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {baris.map((p) => (
                <tr key={p.id} className="transition-colors duration-150 hover:bg-surface-2">
                  <Td>
                    <span className="font-medium text-ink">{p.nama}</span>
                    <span className="block text-mikro text-ink-3">{p.sku}</span>
                  </Td>
                  <Td>{p.kategori ?? '—'}</Td>
                  <Td>{p.supplier ?? '—'}</Td>
                  <Td kanan>{angka(p.stok)} {p.satuan}</Td>
                  <Td kanan>{angka(p.stok_minimum)}</Td>
                  <Td kanan>{rupiah(p.nilai_stok)}</Td>
                  <Td><Lencana nada={NADA[p.status_stok as keyof typeof NADA]}>{LABEL[p.status_stok as keyof typeof LABEL]}</Lencana></Td>
                  <Td>
                    <Link to={`/inventory/mutasi?produk=${p.id}`} className="text-mini font-medium text-brand-teks hover:underline">
                      Kartu stok
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>
    </>
  );
}
