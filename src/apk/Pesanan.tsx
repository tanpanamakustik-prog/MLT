import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { angka, hariIniISO, rupiah, tanggal } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { KepalaBeranda } from './Kerangka';
import { BarisPil, Isi, KartuDaftar, KosongApk, RangkaDaftar } from './komponen';
import { Lencana } from '../components/ui/Dasar';

const SARING = [
  { nilai: '', label: 'Semua' },
  { nilai: 'baru', label: 'Baru' },
  { nilai: 'diproses', label: 'Diproses' },
  { nilai: 'dikirim', label: 'Dikirim' },
  { nilai: 'selesai', label: 'Selesai' },
];

function awalBulan(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function PesananApk() {
  const { pengguna } = useAuth();
  const buyer = pengguna!.peran === 'buyer';
  const [saring, setSaring] = useState('');
  const { data, memuat } = useApi<any[]>(
    `/penjualan${kueri({ dari: buyer ? '' : awalBulan(), sampai: buyer ? '' : hariIniISO(), status_kirim: saring, batas: 60 })}`
  );

  const bolehBuat = ['owner', 'admin', 'sales'].includes(pengguna!.peran);

  return (
    <>
      <KepalaBeranda
        sapaan={buyer ? 'Riwayat' : 'Penjualan'}
        nama={buyer ? 'Pesanan saya' : 'Bulan ini'}
        kanan={
          bolehBuat ? (
            <Link
              to="/a/pesanan/baru"
              className="grid h-9 w-9 place-items-center rounded-full bg-krom-isi text-krom-isi-ink"
              aria-label="Pesanan baru"
            >
              <Plus size={18} />
            </Link>
          ) : undefined
        }
      />

      <Isi className="-mt-8">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <BarisPil pilihan={SARING} nilai={saring} ubah={setSaring} />
        </div>

        <div className="mt-4">
          {memuat ? (
            <RangkaDaftar />
          ) : (data ?? []).length === 0 ? (
            <KosongApk
              judul="Belum ada pesanan"
              pesan={
                buyer
                  ? 'Pesanan yang Anda kirim akan muncul di sini beserta status pengirimannya.'
                  : 'Belum ada pesanan pada bulan ini dengan penyaring yang dipilih.'
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data!.map((o) => (
                <li key={o.id}>
                  <KartuDaftar
                    ke={`/a/pesanan/${o.id}`}
                    judul={buyer ? o.nomor : o.customer}
                    sub={`${tanggal(o.tanggal)} · ${angka(o.jumlah_item)} item${buyer ? '' : ` · ${o.nomor}`}`}
                    kanan={<span className="angka text-kecil font-semibold text-ink">{rupiah(o.total)}</span>}
                    bawah={
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Lencana nada={o.status_bayar === 'lunas' ? 'baik' : 'awas'}>{o.status_bayar}</Lencana>
                        <Lencana
                          nada={o.status_kirim === 'batal' ? 'kritis' : o.status_kirim === 'selesai' ? 'baik' : 'netral'}
                        >
                          {o.status_kirim}
                        </Lencana>
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Isi>
    </>
  );
}
