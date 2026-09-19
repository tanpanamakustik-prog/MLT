import { useState } from 'react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, Kosong, Medan, Memuat, Pilihan, Tabel, Td, Th, RangkaTabel } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { kueri, urlBerkas } from '../lib/api';
import { hariIniISO, waktu, fotoKecil } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const LABEL: Record<string, string> = {
  'mulai-kerja': 'Mulai kerja',
  berangkat: 'Berangkat',
  'sampai-lokasi': 'Sampai lokasi',
  'bongkar-barang': 'Bongkar barang',
  'selesai-pengiriman': 'Selesai pengiriman',
  'kembali-gudang': 'Kembali ke gudang',
};

const namaAktivitas = (jenis: string) =>
  LABEL[jenis] ?? (jenis.startsWith('pengiriman:') ? `Pengiriman — ${jenis.split(':')[1]}` : jenis);

export default function Aktivitas() {
  const { boleh } = useAuth();
  const bolehSemua = boleh('owner', 'admin');
  const [dari, setDari] = useState(hariIniISO());
  const [sampai, setSampai] = useState(hariIniISO());
  const [karyawanId, setKaryawanId] = useState('');

  const { data: karyawan } = useApi<any[]>(bolehSemua ? '/master/karyawan' : null);
  const { data, memuat, galat } = useApi<any[]>(
    `/operasional/aktivitas${kueri({ dari, sampai, karyawan_id: karyawanId })}`
  );

  return (
    <>
      <JudulHalaman
        judul="Aktivitas karyawan"
        deskripsi={bolehSemua ? 'Jejak kerja lapangan seluruh karyawan' : 'Jejak kerja Anda'}
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Medan type="date" aria-label="Dari tanggal" value={dari} onChange={(e) => setDari(e.target.value)} className="w-[150px]" />
        <Medan type="date" aria-label="Sampai tanggal" value={sampai} onChange={(e) => setSampai(e.target.value)} className="w-[150px]" />
        {bolehSemua && (
          <Pilihan aria-label="Karyawan" value={karyawanId} onChange={(e) => setKaryawanId(e.target.value)} className="w-[200px]">
            <option value="">Semua karyawan</option>
            {(karyawan ?? []).map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </Pilihan>
        )}
      </div>

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <RangkaTabel />
        ) : (data ?? []).length === 0 ? (
          <Kosong pesan="Belum ada aktivitas pada rentang ini." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Waktu</Th>
                <Th>Karyawan</Th>
                <Th>Aktivitas</Th>
                <Th>Pesanan</Th>
                <Th>Koordinat</Th>
                <Th>Foto</Th>
              </tr>
            </thead>
            <tbody>
              {data!.map((a) => (
                <tr key={a.id} className="transition-colors duration-150 hover:bg-surface-2">
                  <Td>{waktu(a.waktu)}</Td>
                  <Td>
                    <span className="text-ink">{a.nama}</span>
                    <span className="block text-mikro text-ink-3">{a.jabatan}</span>
                  </Td>
                  <Td>{namaAktivitas(a.jenis)}</Td>
                  <Td>{a.nomor_pesanan ?? '—'}</Td>
                  <Td className="angka text-mini text-ink-2">
                    {a.lat != null ? `${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}` : '—'}
                  </Td>
                  <Td>
                    {a.foto_url ? (
                      <a href={urlBerkas(a.foto_url)} target="_blank" rel="noreferrer">
                        <img
                          src={fotoKecil(a.foto_url)}
                          alt="Foto aktivitas"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = urlBerkas(a.foto_url) ?? "";
                          }}
                          className="h-9 w-9 rounded-md border border-line object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
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
