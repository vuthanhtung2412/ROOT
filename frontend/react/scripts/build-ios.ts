/**
 * Build React web assets, sync into Capacitor iOS, open Xcode.
 *
 * Run: pnpm --filter @root/react build:ios
 * Or:  pnpm build:ios (from repo root)
 *
 * Native API default always comes from repo-root `.env` → `ROOT_PROD_API`
 * (mise also loads `.env` via `[env] _.file`).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT_PROD_API_ENV_KEY = 'ROOT_PROD_API'
const DOTENV_FILE_NAME = '.env'
const MISE_TOML_FILE_NAME = '.mise.toml'
const ROOT_PROD_API_LINE_PATTERN =
  /^ROOT_PROD_API\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*$/m

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const reactPackageDirectory = resolve(scriptDirectory, '..')
const distDirectory = join(reactPackageDirectory, 'dist')
const iosDirectory = join(reactPackageDirectory, 'ios')

function findRepoRoot(startDirectory: string): string {
  let currentDirectory = startDirectory
  for (;;) {
    if (
      existsSync(join(currentDirectory, DOTENV_FILE_NAME)) ||
      existsSync(join(currentDirectory, MISE_TOML_FILE_NAME))
    ) {
      return currentDirectory
    }
    const parentDirectory = dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      throw new Error(
        `Could not find ${DOTENV_FILE_NAME} or ${MISE_TOML_FILE_NAME} walking up from ${startDirectory}`,
      )
    }
    currentDirectory = parentDirectory
  }
}

/**
 * Read `ROOT_PROD_API` from `.env` (SoT for native iOS API base).
 */
function readRootProdApiFromDotenv(dotenvPath: string): string {
  if (!existsSync(dotenvPath)) {
    throw new Error(
      `${dotenvPath} missing — copy env.template to .env and set ${ROOT_PROD_API_ENV_KEY}`,
    )
  }
  const contents = readFileSync(dotenvPath, 'utf8')
  const match = ROOT_PROD_API_LINE_PATTERN.exec(contents)
  const prodApiUrl = match?.[1] ?? match?.[2] ?? match?.[3]
  if (prodApiUrl === undefined || prodApiUrl.length === 0) {
    throw new Error(
      `${ROOT_PROD_API_ENV_KEY} missing in ${dotenvPath} — set ${ROOT_PROD_API_ENV_KEY}=https://…`,
    )
  }
  return prodApiUrl
}

function runCommand(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
): void {
  const result = spawnSync(command, args, {
    cwd: reactPackageDirectory,
    stdio: 'inherit',
    shell: false,
    env: environment,
  })
  if (result.status !== 0) {
    const joined = [command, ...args].join(' ')
    throw new Error(`Command failed (${String(result.status)}): ${joined}`)
  }
}

function main(): void {
  const repoRoot = findRepoRoot(reactPackageDirectory)
  const dotenvPath = join(repoRoot, DOTENV_FILE_NAME)
  const prodApiUrl = readRootProdApiFromDotenv(dotenvPath)
  const buildEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    [ROOT_PROD_API_ENV_KEY]: prodApiUrl,
  }

  console.log(
    `Native API default (${ROOT_PROD_API_ENV_KEY} from ${DOTENV_FILE_NAME}): ${prodApiUrl}`,
  )

  console.log('Building React web assets…')
  runCommand('pnpm', ['build'], buildEnvironment)

  if (!existsSync(distDirectory)) {
    throw new Error(`React dist missing: ${distDirectory}`)
  }

  if (!existsSync(iosDirectory)) {
    console.log('Adding Capacitor iOS platform…')
    runCommand('pnpm', ['exec', 'cap', 'add', 'ios'], buildEnvironment)
  }

  console.log('Syncing Capacitor iOS…')
  runCommand('pnpm', ['exec', 'cap', 'sync', 'ios'], buildEnvironment)

  console.log('Opening Xcode…')
  runCommand('pnpm', ['exec', 'cap', 'open', 'ios'], buildEnvironment)
}

main()
