import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { angka, rupiah, rupiahRingkas } from '../lib/format';
import { KepalaBeranda } from './Kerangka';
import { BarisPil, Isi, KartuDaftar, KosongApk, RangkaDaftar } from './komponen';
import { Lencana } from '../components/ui/Dasar';

const NADA = { critical: 'kritis', low: 'awas', normal: 'baik', overstock: 'info' } as const;
const LABEL = { critical: 'Kritis', low: 'Menipis', normal: 'Normal', overstock: 'Menumpuk' } as const;

const SARING = [
  { nilai: '', label: 'Semua' },
  { nilai: 'critical', label: 'Kritis' },
  { nilai: 'low', label: 'Menipis' },
  { nilai: 'normal', label: 'Normal' },
  { nilai: 'overstock', label: 'Menumpuk' },
];

export default function StokApk() {
  const { data, memuat } = useApi<any[]>('/inventory/stok');
  const [saring, setSaring] = useState('');
  const [cari, setCari] = useState('');

  const baris = useMemo(() => {
    const t = cari.trim().toLowerCase();
    return (data ?? []).filter(
      (p) =>
        (!saring || p.status_stok === saring) &&
        (!t || p.nama.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t))
    );
  }, [data, saring, cari]);

  const nilaiStok = (data ?? []).reduce((a, p) => a + p.nilai_stok, 0);

  return (
    <>
      <KepalaBeranda sapaan="Inventory" nama="Stok gudang" />

      <Isi className="-mt-8">
        <div className="rounded-2xl border border-line bg-surface px-4 py-4">
          <p className="text-mini font-medium uppercase tracking-[0.08em] text-ink-3">Nilai persediaan</p>
          <p title={rupiah(nilaiStok)} className="angka-utama mt-1 text-angka leading-none text-ink">
            {rupiahRingkas(nilaiStok)}
          </p>
          <p className="mt-1 text-mini text-ink-3">{angka((data ?? []).length)} produk aktif</p>
        </div>

        <label className="relative mt-4 block">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari produk atau SKU…"
            aria-label="Cari produk"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-kecil text-ink placeholder:text-ink-3 focus:border-brand-teks focus:outline-none"
          />
        </label>

        <div className="mt-3">
          <BarisPil pilihan={SARING} nilai={saring} ubah={setSaring} />
        </div>

        <div className="mt-4">
          {memuat ? (
            <RangkaDaftar />
          ) : baris.length === 0 ? (
            <KosongApk
              judul="Tidak ada produk"
              pesan={cari || saring ? 'Tidak ada yang cocok dengan penyaring ini.' : 'Produk muncul di sini setelah didaftarkan.'}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {baris.map((p) => (
                <li key={p.id}>
                  <KartuDaftar
                    ke={`/a/stok/${p.id}`}
                    judul={p.nama}
                    sub={`${p.sku} · minimum ${angka(p.stok_minimum)} ${p.satuan}`}
                    kanan={
                      <span className="text-right">
                        <span className="angka block text-dasar font-semibold text-ink">{angka(p.stok)}</span>
                        <span className="block text-mikro text-ink-3">{p.satuan}</span>
                      </span>
                    }
                    bawah={
                      <div className="flex items-center justify-between gap-3">
                        <Lencana nada={NADA[p.status_stok as keyof typeof NADA]}>
                          {LABEL[p.status_stok as keyof typeof LABEL]}
                        </Lencana>
                        <span className="angka text-mini text-ink-3">{rupiah(p.nilai_stok)}</span>
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
