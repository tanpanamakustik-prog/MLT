import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, KepalaKartu, Medan, Pilihan, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi } from '../lib/api';
import { angka, hariIniISO, rupiah } from '../lib/format';

interface Baris {
  produk_id: string;
  qty: number;
  harga: number;
}

export default function PesananBaru() {
  const navigasi = useNavigate();
  const { data: produk } = useApi<any[]>('/master/produk');
  const { data: customer } = useApi<any[]>('/master/customer');

  const [customerId, setCustomerId] = useState('');
  const [tanggal, setTanggal] = useState(hariIniISO());
  const [diskon, setDiskon] = useState(0);
  const [ongkir, setOngkir] = useState(0);
  const [catatan, setCatatan] = useState('');
  const [baris, setBaris] = useState<Baris[]>([{ produk_id: '', qty: 1, harga: 0 }]);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const petaProduk = useMemo(() => new Map((produk ?? []).map((p) => [String(p.id), p])), [produk]);

  const subtotal = baris.reduce((a, b) => a + b.qty * b.harga, 0);
  const total = subtotal - diskon + ongkir;

  function ubahBaris(i: number, patch: Partial<Baris>) {
    setBaris((lama) =>
      lama.map((b, j) => {
        if (j !== i) return b;
        const baru = { ...b, ...patch };
        /* Harga menyesuaikan otomatis saat produk berganti, tapi tetap dapat
           ditimpa — potongan grosir diputuskan per pesanan oleh sales. */
        if (patch.produk_id !== undefined) {
          baru.harga = petaProduk.get(patch.produk_id)?.harga_jual ?? 0;
        }
        return baru;
      })
    );
  }

  async function simpan() {
    setGalat(null);
    const item = baris.filter((b) => b.produk_id && b.qty > 0);
    if (!customerId) return setGalat('Customer wajib dipilih.');
    if (item.length === 0) return setGalat('Tambahkan minimal satu produk.');

    setSibuk(true);
    try {
      const hasil = await api.post<{ id: number }>('/penjualan', {
        customer_id: Number(customerId),
        tanggal,
        diskon,
        ongkir,
        catatan,
        item: item.map((b) => ({ produk_id: Number(b.produk_id), qty: b.qty, harga: b.harga })),
      });
      navigasi(`/penjualan/${hasil.id}`);
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Gagal menyimpan pesanan.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <JudulHalaman judul="Pesanan baru" deskripsi="Stok dipotong begitu pesanan tersimpan" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu className="lg:col-span-2">
          <KepalaKartu
            judul="Item pesanan"
            aksi={
              <Tombol onClick={() => setBaris((b) => [...b, { produk_id: '', qty: 1, harga: 0 }])}>
                <Plus size={14} /> Baris
              </Tombol>
            }
          />
          <Tabel className="min-w-[560px]">
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th kanan>Qty</Th>
                <Th kanan>Harga</Th>
                <Th kanan>Subtotal</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => {
                const p = petaProduk.get(b.produk_id);
                const stokKurang = p && b.qty > p.stok;
                return (
                  <tr key={i}>
                    <Td className="min-w-[220px]">
                      <Pilihan aria-label="Produk" value={b.produk_id} onChange={(e) => ubahBaris(i, { produk_id: e.target.value })}>
                        <option value="">— Pilih produk —</option>
                        {(produk ?? []).map((x) => (
                          <option key={x.id} value={x.id}>{x.nama} ({angka(x.stok)} {x.satuan})</option>
                        ))}
                      </Pilihan>
                      {stokKurang && (
                        <span className="mt-1 block text-mikro text-critical-teks">
                          Stok tersedia hanya {angka(p.stok)} {p.satuan}.
                        </span>
                      )}
                    </Td>
                    <Td kanan className="w-[100px]">
                      <Medan type="number" min={1} aria-label="Qty" value={b.qty} onChange={(e) => ubahBaris(i, { qty: Number(e.target.value) })} className="text-right" />
                    </Td>
                    <Td kanan className="w-[140px]">
                      <Medan type="number" aria-label="Harga" value={b.harga} onChange={(e) => ubahBaris(i, { harga: Number(e.target.value) })} className="text-right" />
                    </Td>
                    <Td kanan>{rupiah(b.qty * b.harga)}</Td>
                    <Td>
                      <button
                        onClick={() => setBaris((l) => l.filter((_, j) => j !== i))}
                        aria-label="Hapus baris"
                        className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-critical-teks"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabel>
        </Kartu>

        <Kartu className="h-fit">
          <KepalaKartu judul="Rincian" />
          <div className="flex flex-col gap-3 px-4 py-4">
            <Pilihan label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— Pilih customer —</option>
              {(customer ?? []).map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
            </Pilihan>
            <Medan label="Tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            <Medan label="Diskon" type="number" value={diskon} onChange={(e) => setDiskon(Number(e.target.value))} />
            <Medan label="Ongkir" type="number" value={ongkir} onChange={(e) => setOngkir(Number(e.target.value))} />
            <Medan label="Catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} />

            <dl className="mt-1 flex flex-col gap-1.5 border-t border-line pt-3 text-kecil">
              <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd className="angka text-ink">{rupiah(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Diskon</dt><dd className="angka text-ink">{diskon > 0 ? `−${rupiah(diskon)}` : rupiah(0)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Ongkir</dt><dd className="angka text-ink">{rupiah(ongkir)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5 text-sedang font-semibold">
                <dt>Total</dt><dd className="angka">{rupiah(total)}</dd>
              </div>
            </dl>

            {galat && <Galat pesan={galat} />}
            <Tombol varian="utama" onClick={simpan} sibuk={sibuk} className="w-full py-2.5">Simpan pesanan</Tombol>
          </div>
        </Kartu>
      </div>
    </>
  );
}
