/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ROOT_PROD_API?: string
  readonly ROOT_DEV_API?: string
  /** Browser API base for a static build served apart from @root/web (GitHub Pages). */
  readonly ROOT_WEB_API?: string
  /** Snapshot file "QA: Continue loaded game" loads (repository-relative). */
  readonly ROOT_QA_SNAPSHOT_PATH?: string
  /** `1` turns on the birthday edition theme (menu, lobby, Lizard Cult art). */
  readonly ROOT_BIRTHDAY_EDITION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** QA log replay: skip sole-endPhase / forced prompt autos so the script drives. */
  __ROOT_QA_DISABLE_AUTO__?: boolean
}
