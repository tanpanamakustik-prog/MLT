import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../lib/useApi';
import { kueri } from '../lib/api';
import { KartuDaftar } from './komponen';
import { angka, persen, rupiah, rupiahRingkas, tanggal } from '../lib/format';
import { KartuNaik, KepalaBeranda } from './Kerangka';
import { Isi, KosongApk } from './komponen';
import { Rangka } from '../components/ui/Dasar';
import { PINTASAN } from './navigasi';
import { Selisih } from '../components/ui/Kpi';

function sapaan(): string {
  const j = Number(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }));
  if (j < 11) return 'Selamat pagi';
  if (j < 15) return 'Selamat siang';
  if (j < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/**
 * Beranda peran internal.
 *
 * Satu angka memimpin, lalu pintasan ke pekerjaan yang benar-benar dibuka tiap
 * hari. Yang dilihat di ponsel bukan laporan lengkap — itu ada di web — tetapi
 * jawaban atas satu pertanyaan sebelum berangkat: hari ini bagaimana, dan apa
 * yang perlu saya kerjakan.
 */
export default function Beranda() {
  const { pengguna } = useAuth();
  const peran = pengguna!.peran;
  const bolehUang = ['owner', 'admin', 'sales'].includes(peran);

  const { data, memuat } = useApi<any>(`/laporan/dashboard${kueri({ periode: 'harian' })}`);
  /* Beranda tanpa daftar apa pun menyisakan setengah layar kosong pada hari
     yang sepi. Pesanan terakhir selalu ada isinya dan justru itu yang dicari
     orang setelah melihat angka hari ini. */
  const { data: pesanan } = useApi<any[]>(`/penjualan${kueri({ batas: 5 })}`);
  const pintasan = PINTASAN[peran] ?? [];
  const k = data?.kpi;

  return (
    <>
      <KepalaBeranda
        sapaan={sapaan()}
        nama={pengguna!.nama}
        kanan={
          <span className="grid h-9 w-9 place-items-center rounded-full bg-krom-2 text-krom-ink">
            <Bell size={17} />
          </span>
        }
      />

      <KartuNaik className="px-4 py-4">
        {memuat || !data ? (
          <>
            <Rangka className="h-3 w-24" />
            <Rangka className="mt-2.5 h-7 w-40" />
            <Rangka className="mt-3 h-3 w-32" />
          </>
        ) : bolehUang ? (
          <>
            <p className="text-mini font-medium uppercase tracking-[0.08em] text-ink-3">Pendapatan hari ini</p>
            <p title={rupiah(k.omzet)} className="angka-utama mt-1 text-angka leading-none text-ink">
              {rupiahRingkas(k.omzet)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-mini text-ink-2">
              <Selisih nilai={data.pertumbuhan.omzet} />
              <span>dibanding {data.pembanding.label}</span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3.5">
              {[
                ['Order', angka(k.jumlah_order)],
                ['Laba', rupiahRingkas(k.laba_kotor)],
                ['Margin', persen(k.margin)],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-mikro uppercase tracking-[0.06em] text-ink-3">{l}</dt>
                  <dd className="angka mt-0.5 text-kecil font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          /* Peran gudang tidak berurusan dengan uang; angka yang memimpin
             baginya adalah pekerjaan hari ini, bukan omzet. */
          <>
            <p className="text-mini font-medium uppercase tracking-[0.08em] text-ink-3">Hari ini</p>
            <dl className="mt-2 grid grid-cols-3 gap-3">
              {[
                ['Order masuk', angka(k.jumlah_order)],
                ['Perlu kulakan', angka(data.saran_kulakan.length)],
                ['Kiriman jalan', angka(k.pengiriman_berjalan)],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-mikro uppercase tracking-[0.06em] text-ink-3">{l}</dt>
                  <dd className="angka mt-0.5 text-besar font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </KartuNaik>

      <Isi>
        <div className="grid grid-cols-4 gap-2">
          {pintasan.map((p) => {
            const Ikon = p.ikon;
            return (
              <Link
                key={p.ke + p.label}
                to={p.ke}
                className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface px-1 py-3.5 text-center transition-colors duration-150 active:bg-surface-2"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand-teks">
                  <Ikon size={19} />
                </span>
                <span className="text-mikro leading-tight text-ink-2">{p.label}</span>
              </Link>
            );
          })}
        </div>

        {data && data.peringatan_stok.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-kecil font-semibold text-ink">Stok perlu perhatian</h2>
              <Link to="/a/stok" className="inline-flex items-center gap-0.5 text-mini font-medium text-brand-teks">
                Semua <ArrowUpRight size={12} />
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {data.peringatan_stok.slice(0, 4).map((s: any) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-kecil text-ink">{s.nama}</span>
                    <span className="angka block text-mini text-ink-3">
                      sisa {angka(s.stok)} dari minimum {angka(s.stok_minimum)} {s.satuan}
                    </span>
                  </span>
                  <AlertTriangle
                    size={17}
                    className={s.status_stok === 'critical' ? 'shrink-0 text-critical-teks' : 'shrink-0 text-warn-teks'}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-kecil font-semibold text-ink">Pesanan terakhir</h2>
            <Link to="/a/pesanan" className="inline-flex items-center gap-0.5 text-mini font-medium text-brand-teks">
              Semua <ArrowUpRight size={12} />
            </Link>
          </div>
          {(pesanan ?? []).length === 0 ? (
            <KosongApk
              judul="Belum ada pesanan"
              pesan="Pesanan yang masuk akan muncul di sini, yang terbaru lebih dulu."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {pesanan!.slice(0, 5).map((o) => (
                <li key={o.id}>
                  <KartuDaftar
                    ke={`/a/pesanan/${o.id}`}
                    judul={o.customer}
                    sub={`${tanggal(o.tanggal)} · ${angka(o.jumlah_item)} item`}
                    kanan={
                      bolehUang ? (
                        <span className="angka text-kecil font-semibold text-ink">{rupiahRingkas(o.total)}</span>
                      ) : undefined
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
