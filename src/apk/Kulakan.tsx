import { useState } from 'react';
import { useApi } from '../lib/useApi';
import { angka, rupiah, rupiahRingkas } from '../lib/format';
import { KepalaBeranda } from './Kerangka';
import { BarisPil, Isi, KartuDaftar, KosongApk, RangkaDaftar } from './komponen';
import { Lencana } from '../components/ui/Dasar';

const SARING = [
  { nilai: 'perlu', label: 'Perlu dikulak' },
  { nilai: '', label: 'Semua produk' },
];

/**
 * Saran kulakan di ponsel.
 *
 * Yang ditanyakan orang gudang sambil berdiri di depan rak: barang ini perlu
 * dipesan atau belum, dan berapa. Angka penyusunnya — titik pesan, rata-rata
 * harian, lead time — tetap ditampilkan, tetapi sebagai keterangan di bawah
 * jawabannya, bukan sebagai deretan kolom yang harus dibaca dulu.
 */
export default function KulakanApk() {
  const [saring, setSaring] = useState('perlu');
  const { data, memuat } = useApi<any[]>('/kulakan/saran');

  const baris = (data ?? []).filter((s) => (saring === 'perlu' ? s.perlu_kulakan : true));
  const biaya = baris.reduce((a, s) => a + s.perkiraan_biaya, 0);

  return (
    <>
      <KepalaBeranda sapaan="Kulakan" nama="Saran pembelian" />

      <Isi className="-mt-8">
        <div className="rounded-2xl border border-line bg-surface px-4 py-4">
          <p className="text-mini font-medium uppercase tracking-[0.08em] text-ink-3">
            {saring === 'perlu' ? 'Perkiraan biaya' : 'Bila semua dibeli'}
          </p>
          <p title={rupiah(biaya)} className="angka-utama mt-1 text-angka leading-none text-ink">
            {rupiahRingkas(biaya)}
          </p>
          <p className="mt-1 text-mini text-ink-3">{angka(baris.length)} produk</p>
        </div>

        <div className="mt-4">
          <BarisPil pilihan={SARING} nilai={saring} ubah={setSaring} />
        </div>

        <div className="mt-4">
          {memuat ? (
            <RangkaDaftar />
          ) : baris.length === 0 ? (
            <KosongApk
              judul="Stok masih aman"
              pesan="Tidak ada produk yang menyentuh titik pesan hari ini."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {baris.map((s) => (
                <li key={s.produk_id}>
                  <KartuDaftar
                    judul={s.nama}
                    sub={
                      s.hari_tersisa == null
                        ? 'Tidak bergerak 30 hari terakhir'
                        : `Stok cukup ${s.hari_tersisa} hari lagi`
                    }
                    kanan={
                      s.perlu_kulakan ? (
                        <span className="text-right">
                          <span className="angka block text-dasar font-semibold text-ink">{angka(s.saran_qty)}</span>
                          <span className="block text-mikro text-ink-3">{s.satuan}</span>
                        </span>
                      ) : (
                        <Lencana nada="baik">aman</Lencana>
                      )
                    }
                    bawah={
                      <div className="grid grid-cols-3 gap-2 text-mini">
                        {[
                          ['Stok', angka(s.stok)],
                          ['Titik pesan', angka(s.reorder_point)],
                          ['Jual/hari', s.avg_harian.toLocaleString('id-ID')],
                        ].map(([l, v]) => (
                          <div key={l}>
                            <p className="text-ink-3">{l}</p>
                            <p className="angka font-medium text-ink">{v}</p>
                          </div>
                        ))}
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
