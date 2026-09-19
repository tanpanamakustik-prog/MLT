import { useCallback, useEffect, useState } from 'react';
import { api, GalatApi } from './api';

/**
 * Pengambilan data sekali jalan dengan status muat dan galat.
 *
 * Jawaban yang datang setelah jalur berganti dibuang, bukan disimpan: berpindah
 * cepat antar periode laporan membuat permintaan lama selesai belakangan, dan
 * tanpa penjagaan ini layar bisa menampilkan angka periode yang sudah
 * ditinggalkan.
 */
export function useApi<T>(jalur: string | null, kunciTambahan: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [memuat, setMemuat] = useState(!!jalur);
  const [galat, setGalat] = useState<string | null>(null);
  const [penanda, setPenanda] = useState(0);

  const muatUlang = useCallback(() => setPenanda((n) => n + 1), []);

  useEffect(() => {
    if (!jalur) {
      setData(null);
      setMemuat(false);
      return;
    }
    let dibatalkan = false;
    setMemuat(true);
    setGalat(null);
    api
      .get<T>(jalur)
      .then((d) => {
        if (!dibatalkan) setData(d);
      })
      .catch((e: unknown) => {
        if (!dibatalkan) setGalat(e instanceof GalatApi ? e.message : 'Gagal memuat data.');
      })
      .finally(() => {
        if (!dibatalkan) setMemuat(false);
      });
    return () => {
      dibatalkan = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jalur, penanda, ...kunciTambahan]);

  return { data, memuat, galat, muatUlang, setData };
}
