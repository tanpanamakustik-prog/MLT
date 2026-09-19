/**
 * Ekspor tabel yang sedang tampil ke Excel.
 *
 * Yang diekspor adalah baris yang sudah disaring di layar, bukan seluruh isi
 * tabel di server: berkas yang diterima owner harus sama persis dengan angka
 * yang baru saja dilihatnya, termasuk penyaring periode yang sedang aktif.
 *
 * Pustaka xlsx dimuat saat tombol ditekan, bukan ikut bundel awal. Ukurannya
 * hampir sepertiga aplikasi, sementara driver dan sales yang membuka APK di
 * jalan tidak pernah menyentuh tombol ekspor.
 */
export async function eksporExcel(namaBerkas: string, baris: Array<Record<string, unknown>>, namaLembar = 'Laporan') {
  if (baris.length === 0) return;
  const XLSX = await import('xlsx');
  const lembar = XLSX.utils.json_to_sheet(baris);
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, lembar, namaLembar.slice(0, 31));
  XLSX.writeFile(buku, `${namaBerkas}.xlsx`);
}

/** Cetak halaman. Dialog cetak peramban juga menyediakan "Simpan sebagai PDF". */
export const cetak = () => window.print();
