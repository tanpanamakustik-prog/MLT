import { useState } from 'react';
import { Download } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, Kosong, Lencana, Medan, Memuat, Tabel, Td, Th, Tombol, RangkaTabel } from '../components/ui/Dasar';
import { KartuKpi } from '../components/ui/Kpi';
import { useApi } from '../lib/useApi';
import { kueri, urlBerkas } from '../lib/api';
import { angka, hariIniISO, jam, tanggal, fotoKecil } from '../lib/format';
import { eksporExcel } from '../components/common/ekspor';

export default function Absensi() {
  const [dari, setDari] = useState(hariIniISO());
  const [sampai, setSampai] = useState(hariIniISO());
  const { data, memuat, galat } = useApi<any[]>(`/operasional/absensi${kueri({ dari, sampai })}`);

  const baris = data ?? [];
  const terlambat = baris.filter((b) => b.status === 'terlambat').length;
  const diLuarArea = baris.filter((b) => (b.jarak_masuk_m ?? 0) > 150).length;

  return (
    <>
      <JudulHalaman
        judul="Absensi"
        deskripsi="Kehadiran berikut koordinat dan jarak dari titik absensi"
        aksi={
          <Tombol
            disabled={baris.length === 0}
            onClick={() =>
              eksporExcel(
                `absensi-${dari}-sd-${sampai}`,
                baris.map((b) => ({
                  Tanggal: b.tanggal, Nama: b.nama, Jabatan: b.jabatan,
                  'Jam masuk': b.jam_masuk, 'Jam pulang': b.jam_pulang,
                  'Jarak masuk (m)': b.jarak_masuk_m, Status: b.status,
                })),
                'Absensi'
              )
            }
          >
            <Download size={14} /> Excel
          </Tombol>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Medan type="date" aria-label="Dari tanggal" value={dari} onChange={(e) => setDari(e.target.value)} className="w-[150px]" />
        <Medan type="date" aria-label="Sampai tanggal" value={sampai} onChange={(e) => setSampai(e.target.value)} className="w-[150px]" />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <KartuKpi label="Catatan kehadiran" nilai={angka(baris.length)} />
        <KartuKpi label="Terlambat" nilai={angka(terlambat)} nada={terlambat > 0 ? 'kritis' : undefined} />
        <KartuKpi label="Di luar radius" nilai={angka(diLuarArea)} catatan="Lebih dari 150 m dari titik absensi" />
      </div>

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <RangkaTabel />
        ) : baris.length === 0 ? (
          <Kosong pesan="Belum ada catatan absensi pada rentang ini." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Karyawan</Th>
                <Th>Masuk</Th>
                <Th>Pulang</Th>
                <Th kanan>Jarak masuk</Th>
                <Th>Status</Th>
                <Th>Foto</Th>
              </tr>
            </thead>
            <tbody>
              {baris.map((a) => (
                <tr key={a.id} className="transition-colors duration-150 hover:bg-surface-2">
                  <Td>{tanggal(a.tanggal)}</Td>
                  <Td>
                    <span className="text-ink">{a.nama}</span>
                    <span className="block text-mikro text-ink-3">{a.jabatan}</span>
                  </Td>
                  <Td>{jam(a.jam_masuk)}</Td>
                  <Td>{jam(a.jam_pulang)}</Td>
                  <Td kanan>{a.jarak_masuk_m != null ? `${angka(a.jarak_masuk_m)} m` : '—'}</Td>
                  <Td>
                    <Lencana nada={a.status === 'terlambat' ? 'awas' : a.status === 'alpha' ? 'kritis' : 'baik'}>{a.status}</Lencana>
                  </Td>
                  <Td>
                    {a.foto_masuk ? (
                      <a href={urlBerkas(a.foto_masuk)} target="_blank" rel="noreferrer">
                        <img
                          src={fotoKecil(a.foto_masuk)}
                          alt={`Selfie ${a.nama}`}
                          loading="lazy"
                          onError={(e) => {
                            /* Foto yang tersimpan sebelum versi kecil ada tidak punya
                               berkasnya; jatuh kembali ke versi penuh alih-alih
                               menampilkan kotak rusak. */
                            e.currentTarget.src = urlBerkas(a.foto_masuk) ?? "";
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
