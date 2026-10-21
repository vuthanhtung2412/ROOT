import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ROOT_DEV_API_BASE_URL } from '@root/web-client'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { IndexHtmlTransformContext, Plugin, ViteDevServer } from 'vite'
import { defineConfig } from 'vitest/config'
import { nativeCompileTimePreloadImagePaths } from './src/assets/gameAssets.ts'
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
/** Set by `build:ios` so only the native Capacitor build injects image preloads. */
const NATIVE_ASSET_PRELOAD_ENV_KEY = 'ROOT_NATIVE_ASSET_PRELOAD'
const NATIVE_ASSET_PRELOAD_ENABLED_VALUE = '1'
/** Public path the build is served under, e.g. `/ROOT/` on GitHub Pages. */
const WEB_BASE_PATH_ENV_KEY = 'ROOT_WEB_BASE_PATH'
const DEFAULT_WEB_BASE_PATH = '/'

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

const REACT_SOURCE_ROOT = path.join(packageRoot, 'src')
const LIBRARY_SOURCE_ROOT = path.join(repositoryRoot, 'lib', 'src')
const SUBPATH_IMPORT_PREFIX = '#'
const COMPILED_SCRIPT_EXTENSION = /\.js$/
const TYPESCRIPT_EXTENSION = '.ts'

/**
 * `#x` subpath imports resolve inside the importing package: React's own
 * `src/`, or `lib/src/` for the engine the solo mode runs in the browser
 * (`lib` writes `#x/y.js` for `y.ts`, like its package.json `imports`).
 */
function subpathImportPlugin(): Plugin {
  return {
    name: 'root-subpath-imports',
    enforce: 'pre',
    resolveId(source: string, importer: string | undefined): string | null {
      if (!source.startsWith(SUBPATH_IMPORT_PREFIX)) {
        return null
      }
      const subpath: string = source.slice(SUBPATH_IMPORT_PREFIX.length)
      const isLibraryImporter: boolean =
        importer?.startsWith(`${LIBRARY_SOURCE_ROOT}${path.sep}`) === true
      if (!isLibraryImporter) {
        return path.join(REACT_SOURCE_ROOT, subpath)
      }
      return path.join(
        LIBRARY_SOURCE_ROOT,
        subpath.replace(COMPILED_SCRIPT_EXTENSION, TYPESCRIPT_EXTENSION),
      )
    },
  }
}

function publicImageHref(assetPath: string): string {
  return assetPath.startsWith('/') ? assetPath : `/${assetPath}`
}

/**
 * Capacitor iOS only: bake image preloads into index.html at compile time.
 * Web builds leave this off so mobile Safari is unchanged.
 */
function nativeAssetPreloadPlugin(): Plugin {
  return {
    name: 'root-native-asset-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(
        html: string,
        _context: IndexHtmlTransformContext,
      ): string {
        if (
          process.env[NATIVE_ASSET_PRELOAD_ENV_KEY] !==
          NATIVE_ASSET_PRELOAD_ENABLED_VALUE
        ) {
          return html
        }
        const preloadTags = nativeCompileTimePreloadImagePaths()
          .map((assetPath) => {
            const href = publicImageHref(assetPath)
            return `    <link rel="preload" as="image" href="${href}" />`
          })
          .join('\n')
        return html.replace('</head>', `${preloadTags}\n  </head>`)
      },
    },
  }
}

/** Vite + Vitest config for @root/react — proxies game/map/ws API to @root/web. */
export default defineConfig({
  /** Expose `ROOT_*` from env / `.env` (via mise) to `import.meta.env`. */
  envPrefix: ['VITE_', 'ROOT_'],
  base: process.env[WEB_BASE_PATH_ENV_KEY] ?? DEFAULT_WEB_BASE_PATH,
  plugins: [
    subpathImportPlugin(),
    react(),
    tailwindcss(),
    qaSnapshotPlugin(),
    nativeAssetPreloadPlugin(),
  ],
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
