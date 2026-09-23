/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ROOT_PROD_API?: string
  readonly ROOT_DEV_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
