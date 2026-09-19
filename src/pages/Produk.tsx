import { useMemo, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Dialog, Galat, Kartu, Kosong, Lencana, Medan, Memuat, Pilihan, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi, kueri } from '../lib/api';
import { angka, rupiah } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const NADA_STATUS = { critical: 'kritis', low: 'awas', normal: 'baik', overstock: 'info' } as const;
const LABEL_STATUS = { critical: 'Kritis', low: 'Menipis', normal: 'Normal', overstock: 'Menumpuk' } as const;

const KOSONG = {
  id: 0, sku: '', nama: '', kategori_id: '', supplier_id: '', satuan: 'pcs',
  harga_beli: 0, harga_jual: 0, stok_minimum: 0, safety_stock: 0, kelipatan_beli: 1,
};

export default function Produk() {
  const { boleh } = useAuth();
  const [cari, setCari] = useState('');
  const [kategoriId, setKategoriId] = useState('');
  const [form, setForm] = useState<any | null>(null);
  const [galatForm, setGalatForm] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const { data: kategori } = useApi<any[]>('/master/kategori');
  /* Daftar supplier hanya dipakai form produk, yang sendirinya terbatas pada
     owner dan admin — peran lain tidak perlu meminta dan tidak berhak. */
  const { data: supplier } = useApi<any[]>(boleh('owner', 'admin') ? '/master/supplier' : null);
  const { data, memuat, galat, muatUlang } = useApi<any[]>(`/master/produk${kueri({ cari, kategori_id: kategoriId })}`);

  /* Margin dihitung di layar dari harga yang sedang tampil, bukan disimpan,
     agar tidak pernah tertinggal dari perubahan harga. */
  const baris = useMemo(
    () =>
      (data ?? []).map((p) => ({
        ...p,
        margin: p.harga_jual > 0 ? ((p.harga_jual - p.harga_beli) / p.harga_jual) * 100 : 0,
      })),
    [data]
  );

  async function simpan() {
    if (!form) return;
    setSibuk(true);
    setGalatForm(null);
    try {
      if (form.id) await api.put(`/master/produk/${form.id}`, form);
      else await api.post('/master/produk', form);
      setForm(null);
      muatUlang();
    } catch (e) {
      setGalatForm(e instanceof GalatApi ? e.message : 'Gagal menyimpan produk.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <JudulHalaman
        judul="Produk"
        deskripsi="Master produk, harga, dan ambang stok"
        aksi={
          boleh('owner', 'admin') && (
            <Tombol varian="utama" onClick={() => { setForm({ ...KOSONG }); setGalatForm(null); }}>
              <Plus size={14} /> Produk baru
            </Tombol>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama atau SKU…"
            aria-label="Cari produk"
            className="w-[240px] rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
        </label>
        <Pilihan aria-label="Saring kategori" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)} className="w-[170px]">
          <option value="">Semua kategori</option>
          {(kategori ?? []).map((k) => (
            <option key={k.id} value={k.id}>{k.nama}</option>
          ))}
        </Pilihan>
      </div>

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <Memuat />
        ) : baris.length === 0 ? (
          <Kosong pesan="Tidak ada produk yang cocok dengan penyaring ini." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th>Kategori</Th>
                <Th kanan>Harga beli</Th>
                <Th kanan>Harga jual</Th>
                <Th kanan>Margin</Th>
                <Th kanan>Stok</Th>
                <Th>Status</Th>
                {boleh('owner', 'admin') && <Th />}
              </tr>
            </thead>
            <tbody>
              {baris.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2">
                  <Td>
                    <span className="font-medium text-ink">{p.nama}</span>
                    <span className="block text-[11.5px] text-ink-3">{p.sku} · {p.satuan}</span>
                  </Td>
                  <Td>{p.kategori ?? '—'}</Td>
                  <Td kanan>{rupiah(p.harga_beli)}</Td>
                  <Td kanan>{rupiah(p.harga_jual)}</Td>
                  <Td kanan>{p.margin.toFixed(1).replace('.', ',')}%</Td>
                  <Td kanan>{angka(p.stok)}</Td>
                  <Td>
                    <Lencana nada={NADA_STATUS[p.status_stok as keyof typeof NADA_STATUS]}>
                      {LABEL_STATUS[p.status_stok as keyof typeof LABEL_STATUS]}
                    </Lencana>
                  </Td>
                  {boleh('owner', 'admin') && (
                    <Td>
                      <button
                        onClick={() => { setForm({ ...p, kategori_id: p.kategori_id ?? '', supplier_id: p.supplier_id ?? '' }); setGalatForm(null); }}
                        className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                        aria-label={`Ubah ${p.nama}`}
                      >
                        <Pencil size={14} />
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>

      {form && (
        <Dialog
          judul={form.id ? `Ubah ${form.nama}` : 'Produk baru'}
          tutup={() => setForm(null)}
          kaki={
            <>
              <Tombol onClick={() => setForm(null)}>Batal</Tombol>
              <Tombol varian="utama" onClick={simpan} sibuk={sibuk}>Simpan</Tombol>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Medan label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Medan label="Satuan" value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })} petunjuk="sak, dus, pcs, kg…" />
            <Medan label="Nama produk" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="sm:col-span-2" />
            <Pilihan label="Kategori" value={form.kategori_id} onChange={(e) => setForm({ ...form, kategori_id: e.target.value })}>
              <option value="">— Tanpa kategori —</option>
              {(kategori ?? []).map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </Pilihan>
            <Pilihan label="Supplier utama" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">— Belum ditentukan —</option>
              {(supplier ?? []).map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </Pilihan>
            <Medan label="Harga beli" type="number" value={form.harga_beli} onChange={(e) => setForm({ ...form, harga_beli: Number(e.target.value) })} />
            <Medan label="Harga jual" type="number" value={form.harga_jual} onChange={(e) => setForm({ ...form, harga_jual: Number(e.target.value) })} />
            <Medan label="Stok minimum" type="number" value={form.stok_minimum} onChange={(e) => setForm({ ...form, stok_minimum: Number(e.target.value) })} petunjuk="Ambang peringatan stok menipis." />
            <Medan label="Safety stock" type="number" value={form.safety_stock} onChange={(e) => setForm({ ...form, safety_stock: Number(e.target.value) })} petunjuk="Cadangan dalam hitungan titik pesan." />
            <Medan label="Kelipatan pembelian" type="number" value={form.kelipatan_beli} onChange={(e) => setForm({ ...form, kelipatan_beli: Number(e.target.value) })} petunjuk="Saran kulakan dibulatkan ke kelipatan ini." />
            {!form.id && (
              <p className="text-[12px] text-ink-3 sm:col-span-2">
                Stok awal tidak diisi di sini. Barang masuk lewat penerimaan kulakan atau stock opname, supaya setiap penambahan stok punya asal-usul.
              </p>
            )}
            {galatForm && <div className="sm:col-span-2"><Galat pesan={galatForm} /></div>}
          </div>
        </Dialog>
      )}
    </>
  );
}
