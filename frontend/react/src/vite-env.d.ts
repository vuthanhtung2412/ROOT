/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ROOT_PROD_API?: string
  readonly ROOT_DEV_API?: string
  /** Snapshot file "QA: Continue loaded game" loads (repository-relative). */
  readonly ROOT_QA_SNAPSHOT_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** QA log replay: skip sole-endPhase / forced prompt autos so the script drives. */
  __ROOT_QA_DISABLE_AUTO__?: boolean
}
