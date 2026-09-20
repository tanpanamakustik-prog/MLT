import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Search, ShoppingCart } from 'lucide-react';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { angka, rupiah } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useKeranjang } from './useKeranjang';
import { Isi, KosongApk, RangkaDaftar } from './komponen';

/**
 * Katalog pembeli.
 *
 * Dua kolom kartu, bukan tabel: yang dipilih orang di ponsel adalah barangnya,
 * dan barang dikenali dari nama serta harganya, bukan dari deretan kolom.
 * Tombol tambah dan kurang berukuran penuh ibu jari karena inilah satu-satunya
 * kendali yang ditekan berulang di layar ini.
 */
export default function Katalog() {
  const { pengguna } = useAuth();
  const [cari, setCari] = useState('');
  const { data, memuat } = useApi<any[]>(`/master/produk${kueri({ cari })}`);
  const { isi, ubah, jumlahJenis } = useKeranjang();

  const belumTerverifikasi = pengguna?.status_customer === 'menunggu';
  const total = useMemo(
    () => (data ?? []).reduce((a, p) => a + (isi[p.id] ?? 0) * p.harga_jual, 0),
    [data, isi]
  );

  return (
    <>
      <header
        className="sticky top-0 z-30 bg-krom px-4 pb-3 pt-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <label className="relative block">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari beras, minyak, telur…"
            aria-label="Cari produk"
            className="h-11 w-full rounded-full border-0 bg-surface pl-11 pr-4 text-kecil text-ink placeholder:text-ink-3 focus:outline-none"
          />
        </label>
      </header>

      {belumTerverifikasi && (
        <div className="mx-4 mt-4 rounded-xl border border-warn/40 bg-warn/12 px-4 py-3">
          <p className="text-kecil font-medium text-ink">Toko Anda sedang diverifikasi</p>
          <p className="mt-1 text-mini leading-relaxed text-ink-2">
            Harga dan stok sudah bisa dilihat. Pemesanan terbuka setelah admin menghubungi nomor HP Anda.
          </p>
        </div>
      )}

      <Isi>
        {memuat ? (
          <RangkaDaftar baris={4} />
        ) : (data ?? []).length === 0 ? (
          <KosongApk
            judul={cari ? 'Tidak ditemukan' : 'Katalog masih kosong'}
            pesan={cari ? `Tidak ada produk yang cocok dengan "${cari}".` : 'Produk akan muncul di sini setelah didaftarkan.'}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data!.map((p) => {
              const qty = isi[p.id] ?? 0;
              const habis = p.stok <= 0;
              return (
                <div key={p.id} className="flex flex-col rounded-xl border border-line bg-surface p-3">
                  {/* Tinggi nama dikunci dua baris supaya tombol tiap kartu
                      sejajar; tanpa itu, satu nama panjang menggeser tombolnya
                      sendiri ke bawah dan barisnya terlihat patah. */}
                  <p className="line-clamp-2 min-h-[2.4rem] text-kecil font-medium leading-snug text-ink">{p.nama}</p>
                  <p className="mt-0.5 text-mikro text-ink-3">per {p.satuan}</p>
                  <p className="angka mt-2 text-sedang font-semibold text-ink">{rupiah(p.harga_jual)}</p>
                  <p className={`mt-0.5 text-mikro ${habis ? 'text-critical-teks' : 'text-ink-3'}`}>
                    {habis ? 'Stok habis' : `Tersedia ${angka(p.stok)}`}
                  </p>
                  <div className="flex-1" />

                  <div className="mt-3 flex items-center justify-between gap-2 pt-1">
                    {qty === 0 ? (
                      <button
                        onClick={() => ubah(p.id, 1, p.stok)}
                        disabled={habis || belumTerverifikasi}
                        className="h-9 w-full rounded-lg bg-brand text-mini font-semibold text-brand-ink transition-[filter] duration-150 active:brightness-95 disabled:opacity-40"
                      >
                        Tambah
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => ubah(p.id, qty - 1, p.stok)}
                          aria-label={`Kurangi ${p.nama}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink-2 active:bg-surface-2"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="angka flex-1 text-center text-dasar font-semibold text-ink">{qty}</span>
                        <button
                          onClick={() => ubah(p.id, qty + 1, p.stok)}
                          disabled={qty >= p.stok}
                          aria-label={`Tambah ${p.nama}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-brand-ink active:brightness-95 disabled:opacity-40"
                        >
                          <Plus size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Isi>

      {/* Bilah keranjang melayang tepat di atas navigasi: isinya terbawa ke mana
          pun pembeli menggulir, tanpa harus mencari tombol di ujung halaman. */}
      {jumlahJenis > 0 && (
        <Link
          to="/a/keranjang"
          className="fixed inset-x-4 z-40 flex items-center gap-3 rounded-xl bg-brand px-4 py-3 text-brand-ink shadow-naik"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <ShoppingCart size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-mini opacity-90">{jumlahJenis} jenis barang</span>
            <span className="angka block text-kecil font-semibold">{rupiah(total)}</span>
          </span>
          <span className="shrink-0 text-kecil font-semibold">Lihat</span>
        </Link>
      )}
    </>
  );
}
