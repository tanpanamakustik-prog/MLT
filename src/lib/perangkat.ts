/**
 * Lokasi perangkat untuk absensi dan bukti pengiriman.
 *
 * enableHighAccuracy dinyalakan karena radius absensi dihitung dalam satuan
 * meter; posisi dari menara seluler saja bisa meleset ratusan meter dan
 * membuat karyawan yang benar-benar berdiri di gudang tercatat di luar area.
 * maximumAge nol mencegah peramban menjawab dengan posisi lama saat karyawan
 * sudah berpindah tempat.
 */
export function ambilLokasi(): Promise<{ lat: number; lng: number; akurasi: number }> {
  return new Promise((selesai, gagal) => {
    if (!navigator.geolocation) {
      gagal(new Error('Perangkat ini tidak mendukung layanan lokasi.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => selesai({ lat: p.coords.latitude, lng: p.coords.longitude, akurasi: Math.round(p.coords.accuracy) }),
      (e) => {
        const pesan: Record<number, string> = {
          1: 'Izin lokasi ditolak. Aktifkan izin lokasi untuk aplikasi ini lalu coba lagi.',
          2: 'Lokasi tidak dapat ditentukan. Pastikan GPS menyala dan Anda tidak berada di dalam ruangan tertutup.',
          3: 'Pencarian lokasi terlalu lama. Coba lagi di tempat yang lebih terbuka.',
        };
        gagal(new Error(pesan[e.code] ?? 'Lokasi tidak terbaca.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/** Mengubah berkas hasil kamera menjadi data URL yang dikirim ke server. */
export function bacaSebagaiDataUrl(berkas: File): Promise<string> {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload = () => selesai(String(pembaca.result));
    pembaca.onerror = () => gagal(new Error('Foto gagal dibaca.'));
    pembaca.readAsDataURL(berkas);
  });
}

export interface Foto {
  penuh: string;
  kecil: string;
}

/**
 * Dua ukuran dari satu jepretan.
 *
 * Daftar absensi dan pengiriman menampilkan foto sebesar kuku jari, tetapi
 * memuat berkas ukuran penuh untuk tiap barisnya — sekitar dua puluh empat kali
 * data yang sebenarnya dipakai, dan pada kuota gratis itu berarti seperdelapan
 * jatah bulanan habis hanya untuk kotak 36 piksel. Versi kecil dibuat di
 * perangkat sekalian, jadi tidak ada pekerjaan tambahan di server.
 */
export async function siapkanFoto(berkas: File): Promise<Foto> {
  return {
    penuh: await kecilkanFoto(berkas, 1024, 0.72),
    kecil: await kecilkanFoto(berkas, 240, 0.6),
  };
}

/**
 * Mengecilkan foto sebelum dikirim.
 *
 * Kamera ponsel menghasilkan berkas 3-5 MB, sementara yang dibutuhkan hanya
 * bukti visual bahwa orangnya benar dan barangnya sampai. Pengecilan dilakukan
 * di perangkat supaya unggahan tetap masuk akal di jaringan seluler di jalan.
 */
export async function kecilkanFoto(berkas: File, sisiMaks = 1024, mutu = 0.72): Promise<string> {
  const dataUrl = await bacaSebagaiDataUrl(berkas);
  const gambar = new Image();
  gambar.src = dataUrl;
  await new Promise((selesai, gagal) => {
    gambar.onload = selesai;
    gambar.onerror = () => gagal(new Error('Foto tidak dapat dibuka.'));
  });

  const skala = Math.min(1, sisiMaks / Math.max(gambar.width, gambar.height));
  const kanvas = document.createElement('canvas');
  kanvas.width = Math.round(gambar.width * skala);
  kanvas.height = Math.round(gambar.height * skala);
  const konteks = kanvas.getContext('2d');
  if (!konteks) return dataUrl;
  konteks.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
  return kanvas.toDataURL('image/jpeg', mutu);
}
