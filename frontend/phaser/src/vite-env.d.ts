/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ROOT_FUNNEL_URL?: string
  readonly ROOT_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
