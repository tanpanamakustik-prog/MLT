import { db, ZONA, type Kueri } from './db.js';

/**
 * Tanggal hari ini menurut zona usaha, bukan menurut jam mesin.
 *
 * Vercel menjalankan fungsi di UTC. Tanpa menyebut zona secara eksplisit,
 * pukul tujuh pagi WIB masih terbaca sebagai tanggal kemarin, dan seluruh
 * penyaring laporan meleset satu hari untuk sebagian besar jam kerja.
 */
export function hariIni(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: ZONA });
}

export function waktuSekarang(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: ZONA });
}

/** Jam HH:MM:SS sekarang menurut zona usaha. */
export function jamSekarang(): string {
  return new Date().toLocaleTimeString('en-GB', { timeZone: ZONA, hour12: false });
}

/**
 * Nomor dokumen berurut per hari, misalnya SO-20260919-003.
 *
 * Urutannya dihitung dari nomor terbesar yang sudah ada pada prefiks hari itu,
 * bukan dari COUNT(*), supaya penghapusan satu dokumen tidak membuat nomor
 * berikutnya bertabrakan dengan nomor yang pernah terpakai.
 *
 * Dijalankan di dalam transaksi pemanggilnya: dua pesanan yang dibuat pada
 * detik yang sama akan diserialisasi oleh kunci baris, bukan saling menimpa.
 */
export async function nomorBerikutnya(
  k: Kueri,
  tabel: 'pesanan' | 'pembelian' | 'pengiriman',
  prefiks: string
): Promise<string> {
  const tanggal = hariIni().replace(/-/g, '');
  const awalan = `${prefiks}-${tanggal}-`;
  const baris = await k.satu<{ nomor: string }>(
    `SELECT nomor FROM ${tabel} WHERE nomor LIKE $1 ORDER BY nomor DESC LIMIT 1`,
    [`${awalan}%`]
  );
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

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

/** Rentang tanggal [mulai, selesai] inklusif untuk tiap jenis periode laporan. */
export function rentangPeriode(
  periode: string,
  acuan: string = hariIni(),
  mulaiKustom?: string,
  selesaiKustom?: string
): { mulai: string; selesai: string; label: string } {
  /* Tanggal diurai sebagai angka, bukan lewat Date: "2026-09-19T00:00:00"
     ditafsirkan peramban dan Node menurut zona mesin, dan di mesin UTC
     perhitungan minggu bisa bergeser satu hari. */
  const [thn, bln, tgl] = acuan.split('-').map(Number);
  const d = new Date(Date.UTC(thn, bln - 1, tgl));
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (x: Date) => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  const akhirBulan = (y: number, m: number) => `${y}-${pad(m + 1)}-${pad(new Date(Date.UTC(y, m + 1, 0)).getUTCDate())}`;
  const tampil = (s: string) => {
    const [a, b, c] = s.split('-');
    return `${Number(c)} ${NAMA_BULAN[Number(b) - 1]} ${a}`;
  };

  switch (periode) {
    case 'mingguan': {
      /* Minggu kerja dimulai Senin: distributor menutup rekap mingguan pada
         akhir pekan, bukan di tengah minggu. */
      const hari = (d.getUTCDay() + 6) % 7;
      const senin = new Date(d);
      senin.setUTCDate(d.getUTCDate() - hari);
      const minggu = new Date(senin);
      minggu.setUTCDate(senin.getUTCDate() + 6);
      return { mulai: iso(senin), selesai: iso(minggu), label: `${tampil(iso(senin))} – ${tampil(iso(minggu))}` };
    }
    case 'bulanan':
      return {
        mulai: `${thn}-${pad(bln)}-01`,
        selesai: akhirBulan(thn, bln - 1),
        label: `${NAMA_BULAN[bln - 1]} ${thn}`,
      };
    case 'semester': {
      const semester1 = bln <= 6;
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
        label: `${tampil(mulaiKustom || acuan)} – ${tampil(selesaiKustom || acuan)}`,
      };
    default:
      return { mulai: acuan, selesai: acuan, label: tampil(acuan) };
  }
}

/**
 * Periode pembanding: satu satuan penuh sebelum periode yang diminta.
 *
 * Dihitung dengan mundur satu hari dari tanggal mulai lalu menjalankan ulang
 * rentangPeriode dari sana. Cara ini benar untuk bulan yang panjangnya berbeda
 * dan untuk tahun kabisat, sementara "mundur 30 hari" tidak — Februari
 * dibanding Januari akan meleset dan angkanya tampak turun tanpa sebab.
 */
export function periodeSebelumnya(
  periode: string,
  p: { mulai: string; selesai: string }
): { mulai: string; selesai: string; label: string } {
  const geser = (t: string, n: number) => {
    const [y, m, d] = t.split('-').map(Number);
    const x = new Date(Date.UTC(y, m - 1, d + n));
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
  };

  if (periode === 'kustom') {
    const hari = (t: string) => Date.UTC(...(t.split('-').map(Number) as [number, number, number]));
    const panjang = Math.round((hari(p.selesai) - hari(p.mulai)) / 86400000) + 1;
    return { mulai: geser(p.mulai, -panjang), selesai: geser(p.mulai, -1), label: `${panjang} hari sebelumnya` };
  }

  const r = rentangPeriode(periode, geser(p.mulai, -1));
  return { mulai: r.mulai, selesai: r.selesai, label: r.label };
}
