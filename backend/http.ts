import type { NextFunction, Request, Response } from 'express';
import { StokTidakCukup } from './stok.js';

export class GalatPermintaan extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'GalatPermintaan';
  }
}

/** Membungkus handler agar galat yang dilempar tidak menggantung permintaan. */
export function bungkus(fn: (req: Request, res: Response) => unknown) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
}

export function penangananGalat(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof GalatPermintaan) return res.status(err.status).json({ pesan: err.message });
  if (err instanceof StokTidakCukup) return res.status(409).json({ pesan: err.message });
  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ pesan: 'Data dengan penanda yang sama sudah ada (SKU, kode, atau nomor).' });
  }
  console.error('[galat]', err);
  res.status(500).json({ pesan: 'Terjadi kesalahan di server.' });
}

export function wajibAngka(nilai: unknown, nama: string): number {
  const n = Number(nilai);
  if (!Number.isFinite(n)) throw new GalatPermintaan(`${nama} harus berupa angka.`);
  return n;
}

export function wajibTeks(nilai: unknown, nama: string): string {
  const t = String(nilai ?? '').trim();
  if (!t) throw new GalatPermintaan(`${nama} wajib diisi.`);
  return t;
}

export const angka = (v: unknown, bawaan = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : bawaan;
};
