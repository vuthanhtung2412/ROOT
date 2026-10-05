import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ROOT_DEV_API_BASE_URL } from '@root/web-client'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin, ViteDevServer } from 'vite'
import { defineConfig } from 'vitest/config'
import {
  QA_SNAPSHOT_PATH_PARAMETER,
  QA_SNAPSHOT_ROUTE,
} from './src/game/qaSnapshotAutoload.ts'

const webApiTarget = process.env.ROOT_DEV_API ?? DEFAULT_ROOT_DEV_API_BASE_URL
const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(packageRoot, '../..')
const SNAPSHOT_FILE_EXTENSION = '.json'
const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_NOT_FOUND = 404

/**
 * Dev server only: serves a repository snapshot JSON file so
 * "QA: Continue loaded game" can autoload it (`?path=tmp/qa/snapshots/x.json`).
 */
function qaSnapshotPlugin(): Plugin {
  return {
    name: 'root-qa-snapshot',
    apply: 'serve',
    configureServer(server: ViteDevServer): void {
      server.middlewares.use(QA_SNAPSHOT_ROUTE, (request, response): void => {
        const requestedPath: string =
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            QA_SNAPSHOT_PATH_PARAMETER,
          ) ?? ''
        const absolutePath: string = path.resolve(repositoryRoot, requestedPath)
        if (
          !absolutePath.startsWith(`${repositoryRoot}${path.sep}`) ||
          path.extname(absolutePath) !== SNAPSHOT_FILE_EXTENSION
        ) {
          response.statusCode = HTTP_STATUS_BAD_REQUEST
          response.end('path must be a .json file inside the repository')
          return
        }
        readFile(absolutePath, 'utf8')
          .then((fileContent: string): void => {
            response.setHeader('Content-Type', 'application/json')
            response.end(fileContent)
          })
          .catch((): void => {
            response.statusCode = HTTP_STATUS_NOT_FOUND
            response.end(`snapshot not found: ${requestedPath}`)
          })
      })
    },
  }
}

/** Vite + Vitest config for @root/react — proxies game/map/ws API to @root/web. */
export default defineConfig({
  /** Expose `ROOT_*` from env / `.env` (via mise) to `import.meta.env`. */
  envPrefix: ['VITE_', 'ROOT_'],
  plugins: [react(), tailwindcss(), qaSnapshotPlugin()],
  resolve: {
    alias: [
      {
        find: /^#(.+)$/,
        replacement: path.join(packageRoot, 'src', '$1'),
      },
    ],
  },
  server: {
    host: true,
    proxy: {
      '/game': webApiTarget,
      '/map': webApiTarget,
      '/doc': webApiTarget,
      '/ws': {
        target: webApiTarget,
        ws: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
