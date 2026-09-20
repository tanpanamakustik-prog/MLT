import { useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { rupiah, waktu } from '../lib/format';
import { KepalaBeranda } from './Kerangka';
import { BarisPil, Isi, KartuDaftar, KosongApk, RangkaDaftar } from './komponen';
import { Lencana } from '../components/ui/Dasar';
import { useAuth } from '../context/AuthContext';

const NADA: Record<string, 'netral' | 'baik' | 'kritis' | 'info'> = {
  ditugaskan: 'netral', berangkat: 'info', sampai: 'info', bongkar: 'info',
  diterima: 'info', selesai: 'baik', gagal: 'kritis',
};

const SARING = [
  { nilai: 'jalan', label: 'Belum selesai' },
  { nilai: '', label: 'Semua' },
  { nilai: 'selesai', label: 'Selesai' },
];

/**
 * Papan kerja driver.
 *
 * Satu kartu satu tujuan, dengan alamat dan nomor telepon langsung terpakai —
 * itulah dua hal yang dibuka sopir sambil memegang setir, bukan nomor dokumen.
 */
export default function Kiriman() {
  const { pengguna } = useAuth();
  const [saring, setSaring] = useState('jalan');
  const { data, memuat } = useApi<any[]>(
    `/operasional/pengiriman${kueri({ status: saring === 'jalan' ? '' : saring })}`
  );

  const baris = (data ?? []).filter((g) =>
    saring === 'jalan' ? !['selesai', 'gagal'].includes(g.status) : true
  );

  return (
    <>
      <KepalaBeranda
        sapaan="Pengiriman"
        nama={pengguna!.peran === 'driver' ? 'Tugas Anda' : 'Semua driver'}
      />

      <Isi className="-mt-8">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <BarisPil pilihan={SARING} nilai={saring} ubah={setSaring} />
        </div>

        <div className="mt-4">
          {memuat ? (
            <RangkaDaftar />
          ) : baris.length === 0 ? (
            <KosongApk
              judul={saring === 'jalan' ? 'Tidak ada tugas berjalan' : 'Belum ada pengiriman'}
              pesan={
                saring === 'jalan'
                  ? 'Semua kiriman sudah ditutup. Tugas baru muncul di sini begitu gudang membuatnya.'
                  : 'Tugas pengiriman dibuat dari halaman pesanan oleh admin atau gudang.'
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {baris.map((g) => (
                <li key={g.id} className="overflow-hidden rounded-xl">
                  <KartuDaftar
                    ke={`/a/kiriman/${g.id}`}
                    judul={g.customer}
                    sub={
                      <span className="flex items-start gap-1">
                        <MapPin size={12} className="mt-[2px] shrink-0" />
                        <span className="line-clamp-2">{g.alamat ?? 'Alamat belum diisi'}</span>
                      </span>
                    }
                    kanan={<Lencana nada={NADA[g.status]}>{g.status}</Lencana>}
                    bawah={
                      <div className="flex items-center justify-between gap-3 text-mini">
                        <span className="text-ink-3">
                          {g.nomor} · {g.dimulai_pada ? waktu(g.dimulai_pada) : 'belum berangkat'}
                        </span>
                        <span className="angka font-semibold text-ink">{rupiah(g.total)}</span>
                      </div>
                    }
                  />
                  {/* Tombol telepon menempel di dasar kartunya, bukan berdiri
                      sebagai kartu sendiri: dipisah, daftarnya terbaca sebagai
                      dua kali lebih banyak baris daripada jumlah tujuannya. */}
                  {g.no_hp && (
                    <a
                      href={`tel:${g.no_hp.replace(/\D/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="-mt-px flex items-center justify-center gap-1.5 rounded-b-xl border border-t-0 border-line bg-surface-2 py-2.5 text-mini font-medium text-brand-teks active:brightness-95"
                    >
                      <Phone size={13} /> Telepon {g.customer}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Isi>
    </>
  );
}
