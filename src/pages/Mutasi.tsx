import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, KepalaKartu, Kosong, Lencana, Medan, Memuat, Pilihan, Tabel, Td, Th } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { angka, hariIniISO, waktu } from '../lib/format';

const LABEL_TIPE = { masuk: 'Masuk', keluar: 'Keluar', adjustment: 'Penyesuaian' } as const;

function awalBulan(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function Mutasi() {
  const [params, setParams] = useSearchParams();
  const { data: produk } = useApi<any[]>('/master/produk');
  const [produkId, setProdukId] = useState(params.get('produk') ?? '');
  const [dari, setDari] = useState(awalBulan());
  const [sampai, setSampai] = useState(hariIniISO());

  /* Produk yang sedang dilihat ikut ditulis ke URL, sehingga kartu stok bisa
     dikirim sebagai tautan ke rekan kerja dan tetap membuka produk yang sama. */
  useEffect(() => {
    setParams(produkId ? { produk: produkId } : {}, { replace: true });
  }, [produkId, setParams]);

  useEffect(() => {
    if (!produkId && produk?.length) setProdukId(String(produk[0].id));
  }, [produk, produkId]);

  const { data, memuat, galat } = useApi<any>(produkId ? `/inventory/mutasi/${produkId}${kueri({ dari, sampai })}` : null);

  return (
    <>
      <JudulHalaman judul="Mutasi stok" deskripsi="Kartu stok per produk: stok awal, seluruh pergerakan, stok akhir" />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Pilihan aria-label="Produk" value={produkId} onChange={(e) => setProdukId(e.target.value)} className="w-[260px]">
          <option value="">— Pilih produk —</option>
          {(produk ?? []).map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </Pilihan>
        <Medan type="date" aria-label="Dari tanggal" value={dari} onChange={(e) => setDari(e.target.value)} className="w-[150px]" />
        <Medan type="date" aria-label="Sampai tanggal" value={sampai} onChange={(e) => setSampai(e.target.value)} className="w-[150px]" />
      </div>

      {galat ? (
        <Galat pesan={galat} />
      ) : !produkId ? (
        <Kartu><Kosong pesan="Pilih produk untuk melihat kartu stoknya." /></Kartu>
      ) : memuat || !data ? (
        <Memuat />
      ) : (
        <Kartu>
          <KepalaKartu judul={data.produk.nama} deskripsi={`${data.produk.sku} · satuan ${data.produk.satuan}`} />

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-line px-4 py-3 text-[13px] lg:grid-cols-5">
            {[
              ['Stok awal', angka(data.stok_awal)],
              ['Masuk', `+${angka(data.masuk)}`],
              ['Keluar', `−${angka(data.keluar)}`],
              ['Penyesuaian', `${data.adjustment >= 0 ? '+' : ''}${angka(data.adjustment)}`],
              ['Stok akhir', angka(data.stok_akhir)],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[11.5px] text-ink-3">{k}</p>
                <p className="angka text-[15px] font-semibold text-ink">{v}</p>
              </div>
            ))}
          </div>

          {data.mutasi.length === 0 ? (
            <Kosong pesan="Tidak ada pergerakan stok pada rentang ini." />
          ) : (
            <Tabel>
              <thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Tipe</Th>
                  <Th kanan>Qty</Th>
                  <Th kanan>Sebelum</Th>
                  <Th kanan>Sesudah</Th>
                  <Th>Keterangan</Th>
                  <Th>Oleh</Th>
                </tr>
              </thead>
              <tbody>
                {data.mutasi.map((m: any) => (
                  <tr key={m.id} className="hover:bg-surface-2">
                    <Td>{waktu(m.waktu)}</Td>
                    <Td>
                      <Lencana nada={m.tipe === 'masuk' ? 'baik' : m.tipe === 'keluar' ? 'netral' : 'awas'}>
                        {LABEL_TIPE[m.tipe as keyof typeof LABEL_TIPE]}
                      </Lencana>
                    </Td>
                    <Td kanan className={m.qty < 0 ? 'text-critical' : 'text-good'}>{m.qty > 0 ? `+${angka(m.qty)}` : angka(m.qty)}</Td>
                    <Td kanan>{angka(m.stok_sebelum)}</Td>
                    <Td kanan>{angka(m.stok_sesudah)}</Td>
                    <Td>{m.catatan ?? '—'}</Td>
                    <Td>{m.nama_pengguna ?? 'sistem'}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabel>
          )}
        </Kartu>
      )}
    </>
  );
}
