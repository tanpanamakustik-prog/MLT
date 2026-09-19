/**
 * Membangun APK Android.
 *
 *   npm run apk -- --api http://192.168.1.12:3335     (uji di jaringan rumah)
 *   npm run apk -- --api https://mlt.vercel.app --rilis
 *
 * Alamat API wajib disebutkan. Capacitor menyajikan berkas web dari
 * http://localhost di dalam ponsel, jadi APK tanpa alamat server akan memanggil
 * dirinya sendiri dan tidak ada satu pun permintaan yang sampai — dan itu baru
 * ketahuan setelah aplikasinya terpasang di ponsel orang.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const api = arg('api');
if (!api || !/^https?:\/\//.test(api)) {
  console.error(`Alamat API wajib disebutkan.

  npm run apk -- --api http://192.168.1.12:3335
  npm run apk -- --api https://nama-project.vercel.app --rilis

Alamat ini ditanam ke dalam APK saat build dan tidak bisa diubah setelahnya
tanpa membangun ulang.`);
  process.exit(1);
}

/* HTTP polos hanya diizinkan untuk alamat lokal oleh network_security_config.
   Memakai http ke alamat publik akan menghasilkan APK yang gagal senyap. */
if (api.startsWith('http://') && !/localhost|10\.0\.2\.2|192\.168\.|127\.0\.0\.1|172\.(1[6-9]|2\d|3[01])\.|10\./.test(api)) {
  console.error(`Alamat "${api}" memakai HTTP polos tetapi bukan alamat jaringan lokal.

Android memblokirnya, dan aturan di android/app/src/main/res/xml/network_security_config.xml
sengaja hanya mengizinkan alamat lokal. Pakai https:// untuk server publik.`);
  process.exit(1);
}

/* JDK dicari, bukan diasumsikan ada di PATH: macOS tidak membawa Java, tetapi
   Android Studio membawa JDK sendiri dan itu sudah cukup. */
const KANDIDAT_JDK = [
  process.env.JAVA_HOME,
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  '/Library/Java/JavaVirtualMachines',
].filter(Boolean);

const jdk = KANDIDAT_JDK.find((j) => fs.existsSync(path.join(j, 'bin', 'java')));
if (!jdk) {
  console.error(`JDK tidak ditemukan.

Pasang Android Studio (sudah membawa JDK-nya sendiri), atau setel JAVA_HOME
ke JDK yang sudah ada.`);
  process.exit(1);
}

const sdk = process.env.ANDROID_HOME ?? path.join(os.homedir(), 'Library/Android/sdk');
if (!fs.existsSync(sdk)) {
  console.error(`Android SDK tidak ditemukan di ${sdk}. Setel ANDROID_HOME.`);
  process.exit(1);
}

const rilis = process.argv.includes('--rilis');
const env = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, VITE_API_BASE: api };
const jalan = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', env, ...opts });

fs.writeFileSync('android/local.properties', `sdk.dir=${sdk}\n`);

console.log(`\nMembangun APK\n  API   : ${api}\n  varian: ${rilis ? 'release (perlu ditandatangani)' : 'debug'}\n  JDK   : ${jdk}\n`);

jalan('npm', ['run', 'build:web']);
jalan('npx', ['cap', 'sync', 'android']);
jalan('./gradlew', [rilis ? 'assembleRelease' : 'assembleDebug'], { cwd: 'android' });

const keluar = rilis
  ? 'android/app/build/outputs/apk/release/app-release-unsigned.apk'
  : 'android/app/build/outputs/apk/debug/app-debug.apk';

if (!fs.existsSync(keluar)) {
  console.error(`\nBuild selesai tetapi ${keluar} tidak ada.`);
  process.exit(1);
}

const ukuran = (fs.statSync(keluar).size / 1024 / 1024).toFixed(1);
console.log(`\nSelesai: ${keluar} (${ukuran} MB)`);
if (rilis) {
  console.log('\nAPK release belum ditandatangani dan tidak bisa dipasang apa adanya.\nTandatangani dengan apksigner sebelum dibagikan.');
}
