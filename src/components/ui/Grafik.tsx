import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { rupiah, rupiahRingkas } from '../../lib/format';

/* Warna deret dibaca dari token tema, bukan ditulis sebagai hex di sini,
   supaya grafik ikut berganti saat tema gelap aktif tanpa render ulang. */
const WARNA = ['var(--dh-series-1)', 'var(--dh-series-2)', 'var(--dh-series-3)'];

const SUMBU = { fill: 'var(--dh-ink-3)', fontSize: 11 };

interface Deret {
  kunci: string;
  label: string;
}

function Keterangan({ deret }: { deret: Deret[] }) {
  /* Legenda selalu tampil untuk dua deret atau lebih: sebagian warna deret
     pada permukaan terang berada di bawah rasio kontras 3:1, sehingga identitas
     deret tidak boleh bersandar pada warna saja. */
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {deret.map((d, i) => (
        <span key={d.kunci} className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: WARNA[i % WARNA.length] }} />
          {d.label}
        </span>
      ))}
    </div>
  );
}

function IsiTooltip({ active, payload, label, formatNilai }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1 text-[11px] font-medium text-ink-3">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-[12px] text-ink">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="ml-auto angka font-medium">{formatNilai(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function GrafikArea({
  data,
  sumbuX,
  deret,
  tinggi = 260,
  formatNilai = rupiah,
}: {
  data: any[];
  sumbuX: string;
  deret: Deret[];
  tinggi?: number;
  formatNilai?: (n: number) => string;
}) {
  return (
    <div>
      {deret.length > 1 && <Keterangan deret={deret} />}
      <ResponsiveContainer width="100%" height={tinggi}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {deret.map((d, i) => (
              <linearGradient key={d.kunci} id={`isi-${d.kunci}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={WARNA[i % WARNA.length]} stopOpacity={0.22} />
                <stop offset="100%" stopColor={WARNA[i % WARNA.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--dh-grid)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey={sumbuX} tick={SUMBU} tickLine={false} axisLine={{ stroke: 'var(--dh-line)' }} minTickGap={24} />
          <YAxis tick={SUMBU} tickLine={false} axisLine={false} width={64} tickFormatter={rupiahRingkas} />
          <Tooltip
            content={<IsiTooltip formatNilai={formatNilai} />}
            cursor={{ stroke: 'var(--dh-ink-3)', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          {deret.map((d, i) => (
            <Area
              key={d.kunci}
              type="monotone"
              dataKey={d.kunci}
              name={d.label}
              stroke={WARNA[i % WARNA.length]}
              strokeWidth={2}
              fill={`url(#isi-${d.kunci})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--dh-surface)' }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrafikBatang({
  data,
  sumbuX,
  deret,
  tinggi = 280,
  formatNilai = rupiah,
}: {
  data: any[];
  sumbuX: string;
  deret: Deret[];
  tinggi?: number;
  formatNilai?: (n: number) => string;
}) {
  return (
    <div>
      {deret.length > 1 && <Keterangan deret={deret} />}
      <ResponsiveContainer width="100%" height={tinggi}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--dh-grid)" vertical={false} />
          <XAxis dataKey={sumbuX} tick={SUMBU} tickLine={false} axisLine={{ stroke: 'var(--dh-line)' }} />
          <YAxis tick={SUMBU} tickLine={false} axisLine={false} width={64} tickFormatter={rupiahRingkas} />
          <Tooltip content={<IsiTooltip formatNilai={formatNilai} />} cursor={{ fill: 'var(--dh-surface-2)' }} />
          {deret.map((d, i) => (
            <Bar
              key={d.kunci}
              dataKey={d.kunci}
              name={d.label}
              fill={WARNA[i % WARNA.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={38}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
