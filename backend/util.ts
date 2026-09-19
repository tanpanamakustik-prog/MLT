import { db } from './db.js';

/** Tanggal lokal YYYY-MM-DD. new Date().toISOString() memberi UTC, yang di
    WIB membuat transaksi sebelum pukul 07:00 tercatat pada hari sebelumnya. */
export function hariIni(): string {
  return new Date().toLocaleDateString('sv-SE');
}

export function waktuSekarang(): string {
  return new Date().toLocaleString('sv-SE');
}

/**
 * Nomor dokumen berurut per hari, misalnya SO-20260919-003.
 *
 * Urutannya dihitung dari nomor terbesar yang sudah ada pada prefiks hari itu,
 * bukan dari COUNT(*), supaya penghapusan satu dokumen tidak membuat nomor
 * berikutnya bertabrakan dengan nomor yang pernah terpakai.
 */
export function nomorBerikutnya(tabel: 'pesanan' | 'pembelian' | 'pengiriman', prefiks: string): string {
  const tanggal = hariIni().replace(/-/g, '');
  const awalan = `${prefiks}-${tanggal}-`;
  const baris = db
    .prepare(`SELECT nomor FROM ${tabel} WHERE nomor LIKE ? ORDER BY nomor DESC LIMIT 1`)
    .get(`${awalan}%`) as { nomor: string } | undefined;
  const urut = baris ? Number(baris.nomor.slice(awalan.length)) + 1 : 1;
  return awalan + String(urut).padStart(3, '0');
}

/**
 * Jarak dua titik koordinat dalam meter (haversine).
 *
 * Dipakai untuk memvalidasi radius absensi. Pendekatan bidang datar sudah cukup
 * untuk jarak ratusan meter, tapi haversine dipilih karena biayanya nol di sini
 * dan tidak perlu dipikirkan lagi kalau nanti ada gudang cabang di pulau lain.
 */
export function jarakMeter(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** Rentang tanggal [mulai, selesai] inklusif untuk tiap jenis periode laporan. */
export function rentangPeriode(
  periode: string,
  acuan: string = hariIni(),
  mulaiKustom?: string,
  selesaiKustom?: string
): { mulai: string; selesai: string; label: string } {
  const d = new Date(acuan + 'T00:00:00');
  const thn = d.getFullYear();
  const bln = d.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const akhirBulan = (y: number, m: number) => `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
  const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  switch (periode) {
    case 'mingguan': {
      /* Minggu kerja dimulai Senin: distributor menutup rekap mingguan pada
         akhir pekan, bukan di tengah minggu. */
      const hari = (d.getDay() + 6) % 7;
      const senin = new Date(d);
      senin.setDate(d.getDate() - hari);
      const minggu = new Date(senin);
      minggu.setDate(senin.getDate() + 6);
      return {
        mulai: senin.toLocaleDateString('sv-SE'),
        selesai: minggu.toLocaleDateString('sv-SE'),
        label: `${senin.toLocaleDateString('id-ID')} – ${minggu.toLocaleDateString('id-ID')}`,
      };
    }
    case 'bulanan':
      return { mulai: `${thn}-${pad(bln + 1)}-01`, selesai: akhirBulan(thn, bln), label: `${NAMA_BULAN[bln]} ${thn}` };
    case 'semester': {
      const semester1 = bln < 6;
      return {
        mulai: semester1 ? `${thn}-01-01` : `${thn}-07-01`,
        selesai: semester1 ? `${thn}-06-30` : `${thn}-12-31`,
        label: `Semester ${semester1 ? 1 : 2} — ${thn}`,
      };
    }
    case 'tahunan':
      return { mulai: `${thn}-01-01`, selesai: `${thn}-12-31`, label: String(thn) };
    case 'kustom':
      return {
        mulai: mulaiKustom || acuan,
        selesai: selesaiKustom || acuan,
        label: `${mulaiKustom || acuan} – ${selesaiKustom || acuan}`,
      };
    default:
      return { mulai: acuan, selesai: acuan, label: new Date(acuan + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'long' }) };
  }
}
