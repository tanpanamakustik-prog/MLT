import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { api, GalatApi, GalatJaringan } from '../lib/api';
import { angka, rupiah } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useKeranjang } from './useKeranjang';
import { KepalaLayar } from './Kerangka';
import { Isi, KosongApk } from './komponen';
import { Galat, Tombol } from '../components/ui/Dasar';

export default function Keranjang() {
  const navigasi = useNavigate();
  const { pengguna } = useAuth();
  const { data: produk } = useApi<any[]>('/master/produk');
  const { isi, ubah, kosongkan } = useKeranjang();
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const baris = useMemo(
    () => (produk ?? []).filter((p) => isi[p.id] > 0).map((p) => ({ ...p, qty: isi[p.id], sub: isi[p.id] * p.harga_jual })),
    [produk, isi]
  );
  const total = baris.reduce((a, b) => a + b.sub, 0);
  const belumTerverifikasi = pengguna?.status_customer === 'menunggu';

  async function kirim() {
    setGalat(null);
    setSibuk(true);
    try {
      const hasil = await api.post<{ id: number }>('/penjualan', {
        item: baris.map((b) => ({ produk_id: b.id, qty: b.qty })),
      });
      kosongkan();
      navigasi(`/a/pesanan/${hasil.id}`, { replace: true });
    } catch (e) {
      setGalat(e instanceof GalatApi || e instanceof GalatJaringan ? e.message : 'Pesanan gagal dikirim.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <KepalaLayar
        judul="Keranjang"
        sub={baris.length ? `${baris.length} jenis barang` : undefined}
        kembali={false}
        aksi={
          baris.length > 0 ? (
            <button
              onClick={() => confirm('Kosongkan keranjang?') && kosongkan()}
              aria-label="Kosongkan keranjang"
              className="grid h-9 w-9 place-items-center rounded-full text-ink-3 active:bg-surface-2"
            >
              <Trash2 size={17} />
            </button>
          ) : undefined
        }
      />

      {baris.length === 0 ? (
        <KosongApk
          judul="Keranjang masih kosong"
          pesan="Pilih barang dari katalog, lalu kembali ke sini untuk mengirim pesanan."
          aksi={<Tombol varian="utama" onClick={() => navigasi('/a')}>Buka katalog</Tombol>}
        />
      ) : (
        <>
          <Isi>
            <ul className="flex flex-col gap-2.5">
              {baris.map((b) => (
                <li key={b.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-kecil font-medium text-ink">{b.nama}</p>
                      <p className="angka mt-0.5 text-mini text-ink-3">
                        {rupiah(b.harga_jual)} / {b.satuan}
                      </p>
                    </div>
                    <p className="angka shrink-0 text-kecil font-semibold text-ink">{rupiah(b.sub)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => ubah(b.id, b.qty - 1, b.stok)}
                      aria-label={`Kurangi ${b.nama}`}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-2 active:bg-surface-2"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="angka w-12 text-center text-dasar font-semibold text-ink">{b.qty}</span>
                    <button
                      onClick={() => ubah(b.id, b.qty + 1, b.stok)}
                      disabled={b.qty >= b.stok}
                      aria-label={`Tambah ${b.nama}`}
                      className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-brand-ink active:brightness-95 disabled:opacity-40"
                    >
                      <Plus size={15} />
                    </button>
                    <span className="ml-auto text-mini text-ink-3">stok {angka(b.stok)}</span>
                  </div>
                </li>
              ))}
            </ul>

            {galat && <div className="mt-4"><Galat pesan={galat} /></div>}
          </Isi>

          {/* Ringkasan dan tombol kirim menempel di bawah: keranjang panjang
              tidak memaksa menggulir sampai ujung hanya untuk melihat total. */}
          <div
            className="fixed inset-x-0 z-40 border-t border-line bg-surface px-4 pt-3"
            style={{ bottom: 'calc(3.9rem + env(safe-area-inset-bottom, 0px))', paddingBottom: '0.75rem' }}
          >
            <div className="mx-auto flex max-w-lg items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-mini text-ink-3">Total</p>
                <p className="angka text-sedang font-semibold text-ink">{rupiah(total)}</p>
              </div>
              <Tombol
                varian="utama"
                onClick={kirim}
                sibuk={sibuk}
                disabled={belumTerverifikasi}
                className="h-11 flex-1"
              >
                Kirim pesanan
              </Tombol>
            </div>
            {belumTerverifikasi && (
              <p className="mx-auto mt-2 max-w-lg text-mini text-warn-teks">
                Toko Anda belum diverifikasi admin, jadi pesanan belum bisa dikirim.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
