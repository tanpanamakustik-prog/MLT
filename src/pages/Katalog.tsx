import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Dialog, Galat, Kartu, Kosong, Memuat, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi, kueri } from '../lib/api';
import { angka, rupiah } from '../lib/format';

export default function Katalog() {
  const navigasi = useNavigate();
  const [cari, setCari] = useState('');
  const { data, memuat, galat } = useApi<any[]>(`/master/produk${kueri({ cari })}`);

  const [keranjang, setKeranjang] = useState<Record<number, number>>({});
  const [dialogBuka, setDialogBuka] = useState(false);
  const [galatKirim, setGalatKirim] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const isi = useMemo(
    () =>
      (data ?? [])
        .filter((p) => keranjang[p.id] > 0)
        .map((p) => ({ ...p, qty: keranjang[p.id], subtotal: keranjang[p.id] * p.harga_jual })),
    [data, keranjang]
  );
  const total = isi.reduce((a, i) => a + i.subtotal, 0);

  function ubahQty(id: number, delta: number, stok: number) {
    setKeranjang((k) => {
      /* Kuantitas dibatasi stok yang tampil, supaya pembeli tidak menyusun
         keranjang yang sudah pasti ditolak server saat checkout. */
      const baru = Math.max(0, Math.min(stok, (k[id] ?? 0) + delta));
      return { ...k, [id]: baru };
    });
  }

  async function checkout() {
    setGalatKirim(null);
    setSibuk(true);
    try {
      const hasil = await api.post<{ id: number }>('/penjualan', {
        item: isi.map((i) => ({ produk_id: i.id, qty: i.qty })),
      });
      setKeranjang({});
      setDialogBuka(false);
      navigasi(`/pesanan-saya?baru=${hasil.id}`);
    } catch (e) {
      setGalatKirim(e instanceof GalatApi ? e.message : 'Pesanan gagal dikirim.');
    } finally {
      setSibuk(false);
    }
  }

  if (galat) return <Galat pesan={galat} />;

  return (
    <>
      <JudulHalaman
        judul="Katalog"
        deskripsi="Harga sudah termasuk harga jual berlaku"
        aksi={
          <Tombol varian="utama" disabled={isi.length === 0} onClick={() => setDialogBuka(true)}>
            <ShoppingCart size={14} /> Keranjang ({isi.length})
          </Tombol>
        }
      />

      <input
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="Cari produk…"
        aria-label="Cari produk"
        className="mb-4 w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2 text-kecil text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
      />

      {memuat ? (
        <Memuat />
      ) : (data ?? []).length === 0 ? (
        <Kartu><Kosong pesan="Tidak ada produk yang cocok." /></Kartu>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data!.map((p) => (
            <Kartu key={p.id} className="flex flex-col p-4">
              <p className="text-dasar font-medium text-ink">{p.nama}</p>
              <p className="text-mikro text-ink-3">{p.sku} · per {p.satuan}</p>
              <p className="mt-2 angka text-besar font-semibold text-ink">{rupiah(p.harga_jual)}</p>
              <p className="mb-3 text-mikro text-ink-3">
                {p.stok > 0 ? `Tersedia ${angka(p.stok)} ${p.satuan}` : 'Stok habis'}
              </p>

              <div className="mt-auto flex items-center gap-2">
                <button
                  onClick={() => ubahQty(p.id, -1, p.stok)}
                  disabled={!keranjang[p.id]}
                  aria-label={`Kurangi ${p.nama}`}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span className="angka min-w-[2.5rem] text-center text-dasar font-medium text-ink">{keranjang[p.id] ?? 0}</span>
                <button
                  onClick={() => ubahQty(p.id, 1, p.stok)}
                  disabled={p.stok === 0 || (keranjang[p.id] ?? 0) >= p.stok}
                  aria-label={`Tambah ${p.nama}`}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </Kartu>
          ))}
        </div>
      )}

      {dialogBuka && (
        <Dialog
          judul="Keranjang"
          tutup={() => setDialogBuka(false)}
          kaki={
            <>
              <Tombol onClick={() => setDialogBuka(false)}>Lanjut belanja</Tombol>
              <Tombol varian="utama" onClick={checkout} sibuk={sibuk}>Kirim pesanan</Tombol>
            </>
          }
        >
          <ul className="flex flex-col gap-2.5">
            {isi.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-3 text-kecil">
                <span className="min-w-0">
                  <span className="block truncate text-ink">{i.nama}</span>
                  <span className="text-mikro text-ink-3">{angka(i.qty)} {i.satuan} × {rupiah(i.harga_jual)}</span>
                </span>
                <span className="angka shrink-0 font-medium text-ink">{rupiah(i.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-sedang font-semibold">
            <span>Total</span>
            <span className="angka">{rupiah(total)}</span>
          </div>
          {galatKirim && <div className="mt-3"><Galat pesan={galatKirim} /></div>}
        </Dialog>
      )}
    </>
  );
}
