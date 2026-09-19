import { useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { JudulHalaman } from '../components/layout/AppShell';
import { Dialog, Galat, Kartu, Kosong, Lencana, Medan, Memuat, Pilihan, Tabel, Td, Th, Tombol } from '../components/ui/Dasar';
import { useApi } from '../lib/useApi';
import { api, GalatApi, kueri } from '../lib/api';
import { angka, hariIniISO, rupiah, tanggal } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const NADA: Record<string, 'netral' | 'baik' | 'kritis' | 'info'> = {
  draft: 'netral', dipesan: 'info', diterima: 'baik', batal: 'kritis',
};

function awalTahun(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export default function PurchaseOrder() {
  const { boleh } = useAuth();
  const [dari, setDari] = useState(awalTahun());
  const [sampai, setSampai] = useState(hariIniISO());
  const [status, setStatus] = useState('');
  const { data, memuat, galat, muatUlang } = useApi<any[]>(`/kulakan${kueri({ dari, sampai, status })}`);

  const [poDibuka, setPoDibuka] = useState<number | null>(null);

  return (
    <>
      <JudulHalaman judul="Purchase order" deskripsi="Dokumen pembelian ke supplier" />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Medan type="date" aria-label="Dari tanggal" value={dari} onChange={(e) => setDari(e.target.value)} className="w-[150px]" />
        <Medan type="date" aria-label="Sampai tanggal" value={sampai} onChange={(e) => setSampai(e.target.value)} className="w-[150px]" />
        <Pilihan aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-[150px]">
          <option value="">Semua status</option>
          {['draft', 'dipesan', 'diterima', 'batal'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Pilihan>
      </div>

      <Kartu>
        {galat ? (
          <div className="p-4"><Galat pesan={galat} /></div>
        ) : memuat ? (
          <Memuat />
        ) : (data ?? []).length === 0 ? (
          <Kosong pesan="Belum ada purchase order pada rentang ini." />
        ) : (
          <Tabel>
            <thead>
              <tr>
                <Th>Nomor</Th>
                <Th>Tanggal</Th>
                <Th>Supplier</Th>
                <Th kanan>Item</Th>
                <Th kanan>Total</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data!.map((po) => (
                <tr key={po.id} className="hover:bg-surface-2">
                  <Td>
                    <button onClick={() => setPoDibuka(po.id)} className="font-medium text-ink hover:text-brand hover:underline">
                      {po.nomor}
                    </button>
                  </Td>
                  <Td>{tanggal(po.tanggal)}</Td>
                  <Td>{po.supplier}</Td>
                  <Td kanan>{angka(po.jumlah_item)}</Td>
                  <Td kanan>{rupiah(po.total)}</Td>
                  <Td><Lencana nada={NADA[po.status]}>{po.status}</Lencana></Td>
                  <Td>
                    {boleh('owner', 'admin', 'gudang') && po.status === 'dipesan' && (
                      <button onClick={() => setPoDibuka(po.id)} className="text-[12px] font-medium text-brand hover:underline">
                        Terima barang
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabel>
        )}
      </Kartu>

      {poDibuka && <DialogPO id={poDibuka} tutup={() => setPoDibuka(null)} selesai={() => { setPoDibuka(null); muatUlang(); }} />}
    </>
  );
}

/** Rincian PO sekaligus form penerimaan barang. */
function DialogPO({ id, tutup, selesai }: { id: number; tutup: () => void; selesai: () => void }) {
  const { boleh } = useAuth();
  const { data, memuat } = useApi<any>(`/kulakan/${id}`);
  const [diterima, setDiterima] = useState<Record<number, string>>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const bisaTerima = boleh('owner', 'admin', 'gudang') && data?.status === 'dipesan';

  async function terima() {
    setGalat(null);
    setSibuk(true);
    try {
      await api.post(`/kulakan/${id}/terima`, {
        /* Baris yang tidak disentuh dikirim apa adanya sesuai qty pesan; yang
           diisi memakai angka hasil hitung di gudang. */
        item: data.item.map((i: any) => ({
          produk_id: i.produk_id,
          qty_diterima: diterima[i.produk_id] !== undefined && diterima[i.produk_id] !== '' ? Number(diterima[i.produk_id]) : i.qty,
        })),
      });
      selesai();
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Gagal menyimpan penerimaan.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Dialog
      judul={data?.nomor ?? 'Purchase order'}
      lebar="max-w-3xl"
      tutup={tutup}
      kaki={
        <>
          <Tombol onClick={tutup}>Tutup</Tombol>
          {bisaTerima && (
            <Tombol varian="utama" onClick={terima} sibuk={sibuk}>
              <PackageCheck size={14} /> Terima barang
            </Tombol>
          )}
        </>
      }
    >
      {memuat || !data ? (
        <Memuat />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
            {[
              ['Supplier', data.supplier],
              ['Tanggal', tanggal(data.tanggal)],
              ['Status', data.status],
              ['Total', rupiah(data.total)],
            ].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-[11.5px] text-ink-3">{k}</p>
                <p className="text-ink">{v as string}</p>
              </div>
            ))}
          </div>

          <Tabel className="min-w-[520px]">
            <thead>
              <tr>
                <Th>Produk</Th>
                <Th kanan>Qty pesan</Th>
                <Th kanan>Harga</Th>
                <Th kanan>Subtotal</Th>
                {bisaTerima && <Th kanan>Qty diterima</Th>}
                {!bisaTerima && <Th kanan>Diterima</Th>}
              </tr>
            </thead>
            <tbody>
              {data.item.map((i: any) => (
                <tr key={i.id}>
                  <Td>
                    <span className="text-ink">{i.nama}</span>
                    <span className="block text-[11.5px] text-ink-3">{i.sku} · {i.satuan}</span>
                  </Td>
                  <Td kanan>{angka(i.qty)}</Td>
                  <Td kanan>{rupiah(i.harga)}</Td>
                  <Td kanan>{rupiah(i.subtotal)}</Td>
                  {bisaTerima ? (
                    <Td kanan className="w-[130px]">
                      <Medan
                        type="number"
                        min={0}
                        aria-label={`Qty diterima ${i.nama}`}
                        placeholder={String(i.qty)}
                        value={diterima[i.produk_id] ?? ''}
                        onChange={(e) => setDiterima((d) => ({ ...d, [i.produk_id]: e.target.value }))}
                        className="text-right"
                      />
                    </Td>
                  ) : (
                    <Td kanan>{angka(i.qty_diterima)}</Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Tabel>

          {bisaTerima && (
            <p className="mt-3 text-[12px] text-ink-3">
              Kosongkan kolom qty diterima bila jumlahnya sama dengan qty pesan. Stok bertambah sebesar yang benar-benar
              diterima, dan harga beli produk diperbarui ke harga pada dokumen ini.
            </p>
          )}
          {galat && <div className="mt-3"><Galat pesan={galat} /></div>}
        </>
      )}
    </Dialog>
  );
}
