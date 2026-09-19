import { useRef, useState } from 'react';
import { Camera, RotateCcw } from 'lucide-react';
import { Tombol } from '../ui/Dasar';
import { kecilkanFoto } from '../../lib/perangkat';

/**
 * Pengambil foto lewat kamera perangkat.
 *
 * Memakai input berkas dengan atribut capture, bukan getUserMedia: di WebView
 * Capacitor jalur ini memanggil aplikasi kamera bawaan, yang sudah menangani
 * izin, orientasi, dan lampu kilat tanpa kode tambahan.
 */
export function AmbilFoto({
  label,
  kameraDepan,
  nilai,
  ubah,
}: {
  label: string;
  kameraDepan?: boolean;
  nilai: string | null;
  ubah: (dataUrl: string | null) => void;
}) {
  const masukan = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);

  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-ink-2">{label}</p>
      <input
        ref={masukan}
        type="file"
        accept="image/*"
        capture={kameraDepan ? 'user' : 'environment'}
        hidden
        onChange={async (e) => {
          const berkas = e.target.files?.[0];
          if (!berkas) return;
          setSibuk(true);
          try {
            ubah(await kecilkanFoto(berkas));
          } finally {
            setSibuk(false);
            e.target.value = '';
          }
        }}
      />
      {nilai ? (
        <div className="flex items-start gap-3">
          <img src={nilai} alt={label} className="h-28 w-28 rounded-lg border border-line object-cover" />
          <Tombol onClick={() => ubah(null)}>
            <RotateCcw size={14} /> Ambil ulang
          </Tombol>
        </div>
      ) : (
        <Tombol onClick={() => masukan.current?.click()} sibuk={sibuk} className="w-full justify-center py-3">
          <Camera size={15} /> Ambil foto
        </Tombol>
      )}
    </div>
  );
}
