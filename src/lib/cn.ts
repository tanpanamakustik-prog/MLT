import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Menggabungkan kelas dan membiarkan kelas terakhir memenangkan konflik. */
export const cn = (...bagian: ClassValue[]) => twMerge(clsx(bagian));
