import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Dialog, Galat, Kartu, Kosong, Lencana, Medan, Memuat, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi } from '../lib/api';
import { angka } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const KOSONG = { id: 0, nama: '', alamat: '', kontak: '', no_hp: '', lead_time_hari: 3, aktif: true };

export default function Supplier() {
  const { boleh } = useAuth();
  const { data, memuat, galat, muatUlang } = useApi<any[]>('/master/supplier');
  const [form, setForm] = useState<any | null>(null);
  const [galatForm, setGalatForm] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    setSibuk(true);
    setGalatForm(null);
    try {
      if (form.id) await api.put(`/master/supplier/${form.id}`, form);
      else await api.post('/master/supplier', form);
      setForm(null);
      muatUlang();
    } catch (e) {
      setGalatForm(e instanceof GalatApi ? e.message : 'Gagal menyimpan supplier.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <JudulHalaman
        judul="Supplier"
        deskripsi="Lead time supplier dipakai langsung oleh perhitungan saran kulakan"
        aksi={
          boleh('owner', 'admin', 'gudang') && (
            <Tombol varian="utama" onClick={() => { setForm({ ...KOSONG }); setGalatForm(null); }}>
              <Plus size={14} /> Supplier baru
            </Tombol>
          )
        }
      />

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <Memuat />
        ) : (data ?? []).length === 0 ? (
          <Kosong pesan="Belum ada supplier." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Supplier</Th>
                <Th>Kontak</Th>
                <Th>Alamat</Th>
                <Th kanan>Lead time</Th>
                <Th kanan>Produk</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data!.map((s) => (
                <tr key={s.id} className="hover:bg-surface-2">
                  <Td><span className="font-medium text-ink">{s.nama}</span></Td>
                  <Td>{s.kontak ?? '—'}<span className="block text-[11.5px] text-ink-3">{s.no_hp ?? ''}</span></Td>
                  <Td>{s.alamat ?? '—'}</Td>
                  <Td kanan>{s.lead_time_hari} hari</Td>
                  <Td kanan>{angka(s.jumlah_produk)}</Td>
                  <Td><Lencana nada={s.aktif ? 'baik' : 'netral'}>{s.aktif ? 'aktif' : 'nonaktif'}</Lencana></Td>
                  <Td>
                    {boleh('owner', 'admin', 'gudang') && (
                      <button
                        onClick={() => { setForm({ ...s, aktif: !!s.aktif }); setGalatForm(null); }}
                        aria-label={`Ubah ${s.nama}`}
                        className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
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
          judul={form.id ? `Ubah ${form.nama}` : 'Supplier baru'}
          tutup={() => setForm(null)}
          kaki={
            <>
              <Tombol onClick={() => setForm(null)}>Batal</Tombol>
              <Tombol varian="utama" onClick={simpan} sibuk={sibuk}>Simpan</Tombol>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Medan label="Nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="sm:col-span-2" />
            <Medan label="Nama kontak" value={form.kontak ?? ''} onChange={(e) => setForm({ ...form, kontak: e.target.value })} />
            <Medan label="Nomor HP" value={form.no_hp ?? ''} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
            <Medan label="Alamat" value={form.alamat ?? ''} onChange={(e) => setForm({ ...form, alamat: e.target.value })} className="sm:col-span-2" />
            <Medan
              label="Lead time (hari)"
              type="number"
              min={0}
              value={form.lead_time_hari}
              onChange={(e) => setForm({ ...form, lead_time_hari: Number(e.target.value) })}
              petunjuk="Jarak pesan sampai barang datang."
            />
            {galatForm && <div className="sm:col-span-2"><Galat pesan={galatForm} /></div>}
          </div>
        </Dialog>
      )}
    </>
  );
}
