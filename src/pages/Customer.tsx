import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Dialog, Galat, Kartu, Kosong, Lencana, Medan, Memuat, Pilihan, Tabel, Td, Th, Tombol, RangkaTabel } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi, kueri } from '../lib/api';
import { angka, rupiah, tanggal } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const KOSONG = { id: 0, kode: '', nama: '', alamat: '', no_hp: '', tipe: 'toko', sales_id: '', limit_kredit: 0, status: 'aktif' };

export default function Customer() {
  const { boleh } = useAuth();
  const [cari, setCari] = useState('');
  const [form, setForm] = useState<any | null>(null);
  const [galatForm, setGalatForm] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const { data: karyawan } = useApi<any[]>('/master/karyawan');
  const { data, memuat, galat, muatUlang } = useApi<any[]>(`/master/customer${kueri({ cari })}`);

  async function simpan() {
    if (!form) return;
    setSibuk(true);
    setGalatForm(null);
    try {
      if (form.id) await api.put(`/master/customer/${form.id}`, form);
      else await api.post('/master/customer', form);
      setForm(null);
      muatUlang();
    } catch (e) {
      setGalatForm(e instanceof GalatApi ? e.message : 'Gagal menyimpan customer.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <JudulHalaman
        judul="Customer"
        deskripsi="Toko, grosir, dan pelanggan horeka"
        aksi={
          boleh('owner', 'admin', 'sales') && (
            <Tombol varian="utama" onClick={() => { setForm({ ...KOSONG }); setGalatForm(null); }}>
              <Plus size={14} /> Customer baru
            </Tombol>
          )
        }
      />

      <label className="relative mb-3 block w-[260px]">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama atau kode…"
          aria-label="Cari customer"
          className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-kecil text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
        />
      </label>

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <RangkaTabel />
        ) : (data ?? []).length === 0 ? (
          <Kosong pesan="Belum ada customer yang cocok." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Tipe</Th>
                <Th>Sales</Th>
                <Th kanan>Order</Th>
                <Th kanan>Total belanja</Th>
                <Th kanan>Limit kredit</Th>
                <Th>Order terakhir</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id} className="transition-colors duration-150 hover:bg-surface-2">
                  <Td>
                    <Link to={`/customer/${c.id}`} className="font-medium text-ink hover:text-brand-teks hover:underline">
                      {c.nama}
                    </Link>
                    <span className="block text-mikro text-ink-3">{c.kode ?? '—'} · {c.no_hp ?? 'tanpa nomor'}</span>
                  </Td>
                  <Td><Lencana nada={c.status === 'aktif' ? 'netral' : 'kritis'}>{c.tipe}</Lencana></Td>
                  <Td>{c.sales ?? '—'}</Td>
                  <Td kanan>{angka(c.jumlah_order)}</Td>
                  <Td kanan>{rupiah(c.total_belanja)}</Td>
                  <Td kanan>{c.limit_kredit > 0 ? rupiah(c.limit_kredit) : '—'}</Td>
                  <Td>{tanggal(c.order_terakhir)}</Td>
                  <Td>
                    {boleh('owner', 'admin', 'sales') && (
                      <button
                        onClick={() => { setForm({ ...c, sales_id: c.sales_id ?? '' }); setGalatForm(null); }}
                        className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                        aria-label={`Ubah ${c.nama}`}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>

      {form && (
        <Dialog
          judul={form.id ? `Ubah ${form.nama}` : 'Customer baru'}
          tutup={() => setForm(null)}
          kaki={
            <>
              <Tombol onClick={() => setForm(null)}>Batal</Tombol>
              <Tombol varian="utama" onClick={simpan} sibuk={sibuk}>Simpan</Tombol>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Medan label="Kode" value={form.kode ?? ''} onChange={(e) => setForm({ ...form, kode: e.target.value })} />
            <Medan label="Nomor HP" value={form.no_hp ?? ''} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
            <Medan label="Nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="sm:col-span-2" />
            <Medan label="Alamat" value={form.alamat ?? ''} onChange={(e) => setForm({ ...form, alamat: e.target.value })} className="sm:col-span-2" />
            <Pilihan label="Tipe" value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value })}>
              {['toko', 'grosir', 'retail', 'horeka'].map((t) => <option key={t} value={t}>{t}</option>)}
            </Pilihan>
            <Pilihan label="Sales penanggung jawab" value={form.sales_id} onChange={(e) => setForm({ ...form, sales_id: e.target.value })}>
              <option value="">— Belum ditentukan —</option>
              {(karyawan ?? []).map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </Pilihan>
            <Medan
              label="Limit kredit"
              type="number"
              value={form.limit_kredit}
              onChange={(e) => setForm({ ...form, limit_kredit: Number(e.target.value) })}
              petunjuk="0 berarti tanpa batas. Pesanan yang melampaui limit ditolak."
            />
            <Pilihan label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['aktif', 'nonaktif', 'blokir'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Pilihan>
            {galatForm && <div className="sm:col-span-2"><Galat pesan={galatForm} /></div>}
          </div>
        </Dialog>
      )}
    </>
  );
}
