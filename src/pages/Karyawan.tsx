import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Dialog, Galat, Kartu, Kosong, Lencana, Medan, Memuat, Pilihan, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi } from '../lib/api';
import { tanggal } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const KOSONG = { id: 0, nama: '', jabatan: '', no_hp: '', status: 'aktif', tanggal_bergabung: '', area_kerja: '' };

export default function Karyawan() {
  const { boleh } = useAuth();
  const { data, memuat, galat, muatUlang } = useApi<any[]>('/master/karyawan');
  const [form, setForm] = useState<any | null>(null);
  const [galatForm, setGalatForm] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    setSibuk(true);
    setGalatForm(null);
    try {
      if (form.id) await api.put(`/master/karyawan/${form.id}`, form);
      else await api.post('/master/karyawan', form);
      setForm(null);
      muatUlang();
    } catch (e) {
      setGalatForm(e instanceof GalatApi ? e.message : 'Gagal menyimpan data karyawan.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <JudulHalaman
        judul="Data karyawan"
        aksi={
          boleh('owner', 'admin') && (
            <Tombol varian="utama" onClick={() => { setForm({ ...KOSONG }); setGalatForm(null); }}>
              <Plus size={14} /> Karyawan baru
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
          <Kosong pesan="Belum ada data karyawan." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Jabatan</Th>
                <Th>Area kerja</Th>
                <Th>Nomor HP</Th>
                <Th>Bergabung</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data!.map((k) => (
                <tr key={k.id} className="hover:bg-surface-2">
                  <Td><span className="font-medium text-ink">{k.nama}</span></Td>
                  <Td>{k.jabatan}</Td>
                  <Td>{k.area_kerja ?? '—'}</Td>
                  <Td>{k.no_hp ?? '—'}</Td>
                  <Td>{tanggal(k.tanggal_bergabung)}</Td>
                  <Td><Lencana nada={k.status === 'aktif' ? 'baik' : 'netral'}>{k.status}</Lencana></Td>
                  <Td>
                    {boleh('owner', 'admin') && (
                      <button
                        onClick={() => { setForm({ ...k }); setGalatForm(null); }}
                        aria-label={`Ubah ${k.nama}`}
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
          judul={form.id ? `Ubah ${form.nama}` : 'Karyawan baru'}
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
            <Medan label="Jabatan" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} petunjuk="Jabatan dengan kata Driver muncul di pilihan driver." />
            <Medan label="Nomor HP" value={form.no_hp ?? ''} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
            <Medan label="Area kerja" value={form.area_kerja ?? ''} onChange={(e) => setForm({ ...form, area_kerja: e.target.value })} />
            <Medan label="Tanggal bergabung" type="date" value={form.tanggal_bergabung ?? ''} onChange={(e) => setForm({ ...form, tanggal_bergabung: e.target.value })} />
            <Pilihan label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['aktif', 'cuti', 'nonaktif'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Pilihan>
            {galatForm && <div className="sm:col-span-2"><Galat pesan={galatForm} /></div>}
          </div>
        </Dialog>
      )}
    </>
  );
}
