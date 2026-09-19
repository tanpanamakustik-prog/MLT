import { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Galat, Kartu, KepalaKartu, Medan, Memuat, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi } from '../lib/api';
import { angka } from '../lib/format';

export default function Opname() {
  const { data: produk, memuat, muatUlang } = useApi<any[]>('/inventory/stok');
  const [fisik, setFisik] = useState<Record<number, string>>({});
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<any | null>(null);
  const [sibuk, setSibuk] = useState(false);

  /* Hanya baris yang benar-benar diisi yang dihitung sebagai hasil opname.
     Kolom kosong berarti produk itu tidak dihitung hari ini, bukan nol. */
  const terisi = useMemo(
    () =>
      (produk ?? [])
        .map((p) => ({ p, nilai: fisik[p.id] }))
        .filter((x) => x.nilai !== undefined && x.nilai !== '')
        .map((x) => ({ ...x, selisih: Number(x.nilai) - x.p.stok })),
    [produk, fisik]
  );

  const adaSelisih = terisi.filter((t) => t.selisih !== 0);

  async function kirim() {
    setGalat(null);
    if (terisi.length === 0) return setGalat('Isi minimal satu hasil hitung fisik.');
    if (!alasan.trim()) return setGalat('Alasan opname wajib diisi.');

    setSibuk(true);
    try {
      const r = await api.post<any>('/inventory/opname', {
        alasan,
        item: terisi.map((t) => ({ produk_id: t.p.id, qty_fisik: Number(t.nilai) })),
      });
      setHasil(r);
      setFisik({});
      setAlasan('');
      muatUlang();
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Gagal menyimpan opname.');
    } finally {
      setSibuk(false);
    }
  }

  if (memuat || !produk) return <Memuat tinggi="h-64" />;

  return (
    <>
      <JudulHalaman
        judul="Stock opname"
        deskripsi="Masukkan hasil hitung fisik. Selisihnya tercatat sebagai penyesuaian bermeterai alasan."
      />

      {hasil && (
        <div className="mb-4 rounded-lg border border-good/30 bg-good/8 px-3 py-2.5 text-[13px] text-ink">
          <p className="font-medium text-good">Opname tersimpan.</p>
          <p className="text-ink-2">
            {hasil.jumlah_disesuaikan} produk disesuaikan. Setiap perubahan tercatat di mutasi stok dan audit log.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu className="lg:col-span-2">
          <KepalaKartu judul="Hitung fisik" deskripsi="Kosongkan baris produk yang tidak dihitung" />
          <Tabel>
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th kanan>Stok sistem</Th>
                <Th kanan>Hitung fisik</Th>
                <Th kanan>Selisih</Th>
              </tr>
            </thead>
            <tbody>
              {produk.map((p) => {
                const nilai = fisik[p.id];
                const selisih = nilai === undefined || nilai === '' ? null : Number(nilai) - p.stok;
                return (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <Td>
                      <span className="text-ink">{p.nama}</span>
                      <span className="block text-[11.5px] text-ink-3">{p.sku} · {p.satuan}</span>
                    </Td>
                    <Td kanan>{angka(p.stok)}</Td>
                    <Td kanan className="w-[130px]">
                      <Medan
                        type="number"
                        min={0}
                        aria-label={`Hitung fisik ${p.nama}`}
                        value={nilai ?? ''}
                        onChange={(e) => setFisik((f) => ({ ...f, [p.id]: e.target.value }))}
                        className="text-right"
                      />
                    </Td>
                    <Td kanan className={selisih == null ? 'text-ink-3' : selisih === 0 ? 'text-ink-2' : selisih > 0 ? 'text-good' : 'text-critical'}>
                      {selisih == null ? '—' : selisih > 0 ? `+${angka(selisih)}` : angka(selisih)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabel>
        </Kartu>

        <Kartu className="h-fit">
          <KepalaKartu judul="Ringkasan" />
          <div className="flex flex-col gap-3 px-4 py-4 text-[13px]">
            <div className="flex justify-between"><span className="text-ink-2">Produk dihitung</span><span className="angka font-medium">{terisi.length}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Ada selisih</span><span className="angka font-medium">{adaSelisih.length}</span></div>

            <Medan
              label="Alasan opname"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Opname rutin akhir bulan"
              petunjuk="Tersimpan pada setiap baris penyesuaian agar selisihnya bisa ditelusuri."
            />

            {galat && <Galat pesan={galat} />}
            <Tombol varian="utama" onClick={kirim} sibuk={sibuk} className="w-full py-2.5">
              <ClipboardCheck size={14} /> Simpan opname
            </Tombol>
          </div>
        </Kartu>
      </div>
    </>
  );
}
