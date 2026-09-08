/// <reference types="vite/client" />

declare module "*.css"
declare module "*.tsx"

interface ImportMetaEnv {
  /** 'local' (default) runs the in-process simulation; 'remote' streams from Supabase. */
  readonly VITE_FEED?: 'local' | 'remote'
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Which project's topology to render. Defaults to the public demo. */
  readonly VITE_PROJECT_SLUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
