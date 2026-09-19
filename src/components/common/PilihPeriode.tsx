import { Medan, Pilihan } from '../ui/Dasar';
import { hariIniISO } from '../../lib/format';

export interface NilaiPeriode {
  periode: string;
  acuan: string;
  dari: string;
  sampai: string;
}

export const PERIODE_AWAL: NilaiPeriode = {
  periode: 'bulanan',
  acuan: hariIniISO(),
  dari: hariIniISO(),
  sampai: hariIniISO(),
};

const OPSI = [
  { nilai: 'harian', label: 'Harian' },
  { nilai: 'mingguan', label: 'Mingguan' },
  { nilai: 'bulanan', label: 'Bulanan' },
  { nilai: 'semester', label: 'Semester' },
  { nilai: 'tahunan', label: 'Tahunan' },
  { nilai: 'kustom', label: 'Kustom' },
];

/**
 * Penyaring periode untuk seluruh laporan.
 *
 * Selain mode kustom, rentangnya ditentukan server dari satu tanggal acuan —
 * peramban hanya mengirim "bulanan" berikut tanggal mana pun di bulan itu.
 * Batas semester dan minggu dengan demikian hanya ditulis di satu tempat, dan
 * angka di layar tidak bisa berbeda dari angka di berkas ekspor.
 */
export function PilihPeriode({ nilai, ubah }: { nilai: NilaiPeriode; ubah: (n: NilaiPeriode) => void }) {
  const kustom = nilai.periode === 'kustom';

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Pilihan
        aria-label="Jenis periode"
        value={nilai.periode}
        onChange={(e) => ubah({ ...nilai, periode: e.target.value })}
        className="w-[140px]"
      >
        {OPSI.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </Pilihan>

      {kustom ? (
        <>
          <Medan type="date" aria-label="Dari tanggal" value={nilai.dari} onChange={(e) => ubah({ ...nilai, dari: e.target.value })} className="w-[150px]" />
          <Medan type="date" aria-label="Sampai tanggal" value={nilai.sampai} onChange={(e) => ubah({ ...nilai, sampai: e.target.value })} className="w-[150px]" />
        </>
      ) : (
        <Medan
          type="date"
          aria-label="Tanggal acuan periode"
          value={nilai.acuan}
          onChange={(e) => ubah({ ...nilai, acuan: e.target.value })}
          className="w-[160px]"
        />
      )}
    </div>
  );
}
