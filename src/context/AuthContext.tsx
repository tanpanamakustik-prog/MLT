import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ambilToken, api, hapusToken, pasangPenanganSesiBerakhir, simpanToken } from '../lib/api';

export type Peran = 'owner' | 'admin' | 'gudang' | 'sales' | 'driver' | 'buyer';

export interface Pengguna {
  id: number;
  username: string;
  nama: string;
  peran: Peran;
  karyawan_id: number | null;
  customer_id: number | null;
  /* Hanya terisi untuk peran buyer. 'menunggu' berarti tokonya belum
     diverifikasi admin dan pemesanan masih tertutup. */
  status_customer?: string | null;
}

interface IsiAuth {
  pengguna: Pengguna | null;
  modul: string[];
  memuat: boolean;
  masuk: (username: string, kataSandi: string) => Promise<void>;
  keluar: () => void;
  boleh: (...peran: Peran[]) => boolean;
}

const KonteksAuth = createContext<IsiAuth | null>(null);

export function PenyediaAuth({ children }: { children: ReactNode }) {
  const [pengguna, setPengguna] = useState<Pengguna | null>(null);
  const [modul, setModul] = useState<string[]>([]);
  const [memuat, setMemuat] = useState(true);

  const keluar = useCallback(() => {
    hapusToken();
    setPengguna(null);
    setModul([]);
  }, []);

  useEffect(() => {
    pasangPenanganSesiBerakhir(keluar);
  }, [keluar]);

  /* Token di localStorage hanya berarti pernah masuk; keabsahannya diputuskan
     server. Sesi dipulihkan dengan menanyakannya, bukan dengan mempercayai
     isi token di sisi peramban. */
  useEffect(() => {
    if (!ambilToken()) {
      setMemuat(false);
      return;
    }
    api
      .get<{ pengguna: Pengguna; modul: string[] }>('/auth/saya')
      .then((d) => {
        setPengguna(d.pengguna);
        setModul(d.modul);
      })
      .catch(() => hapusToken())
      .finally(() => setMemuat(false));
  }, []);

  const masuk = useCallback(async (username: string, kata_sandi: string) => {
    const d = await api.post<{ token: string; pengguna: Pengguna; modul: string[] }>('/auth/login', { username, kata_sandi });
    simpanToken(d.token);
    setPengguna(d.pengguna);
    setModul(d.modul);
  }, []);

  const nilai = useMemo<IsiAuth>(
    () => ({
      pengguna,
      modul,
      memuat,
      masuk,
      keluar,
      boleh: (...peran: Peran[]) => !!pengguna && peran.includes(pengguna.peran),
    }),
    [pengguna, modul, memuat, masuk, keluar]
  );

  return <KonteksAuth.Provider value={nilai}>{children}</KonteksAuth.Provider>;
}

export function useAuth(): IsiAuth {
  const isi = useContext(KonteksAuth);
  if (!isi) throw new Error('useAuth dipakai di luar PenyediaAuth.');
  return isi;
}
