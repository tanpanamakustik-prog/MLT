/// <reference types="vite/client" />

/** Variabel build yang dibaca sisi peramban. Hanya yang berawalan VITE_ yang
    ikut terbundel — dan karena itu tidak satu pun boleh berisi rahasia. */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
