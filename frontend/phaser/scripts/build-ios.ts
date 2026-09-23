/**
 * Build Phaser web assets, sync into Capacitor iOS, open Xcode.
 *
 * Run: pnpm --filter @root/phaser build:ios
 * Or:  pnpm build:ios (from repo root)
 *
 * Native API default always comes from repo-root `.mise.toml` → `ROOT_PROD_API`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT_PROD_API_ENV_KEY = 'ROOT_PROD_API'
const MISE_TOML_FILE_NAME = '.mise.toml'
const ROOT_PROD_API_LINE_PATTERN =
  /^ROOT_PROD_API\s*=\s*["']([^"']+)["']\s*$/m

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const phaserPackageDirectory = resolve(scriptDirectory, '..')
const distDirectory = join(phaserPackageDirectory, 'dist')
const iosDirectory = join(phaserPackageDirectory, 'ios')

function findRepoRootWithMiseToml(startDirectory: string): string {
  let currentDirectory = startDirectory
  for (;;) {
    if (existsSync(join(currentDirectory, MISE_TOML_FILE_NAME))) {
      return currentDirectory
    }
    const parentDirectory = dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      throw new Error(
        `Could not find ${MISE_TOML_FILE_NAME} walking up from ${startDirectory}`,
      )
    }
    currentDirectory = parentDirectory
  }
}

/**
 * Read `ROOT_PROD_API` from `.mise.toml` (SoT for native iOS API base).
 */
function readRootProdApiFromMiseToml(miseTomlPath: string): string {
  const contents = readFileSync(miseTomlPath, 'utf8')
  const match = ROOT_PROD_API_LINE_PATTERN.exec(contents)
  const prodApiUrl = match?.[1]
  if (prodApiUrl === undefined || prodApiUrl.length === 0) {
    throw new Error(
      `${ROOT_PROD_API_ENV_KEY} missing in ${miseTomlPath} — set [env] ${ROOT_PROD_API_ENV_KEY} = "https://…"`,
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
    cwd: phaserPackageDirectory,
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
  const repoRoot = findRepoRootWithMiseToml(phaserPackageDirectory)
  const miseTomlPath = join(repoRoot, MISE_TOML_FILE_NAME)
  const prodApiUrl = readRootProdApiFromMiseToml(miseTomlPath)
  const buildEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    [ROOT_PROD_API_ENV_KEY]: prodApiUrl,
  }

  console.log(
    `Native API default (${ROOT_PROD_API_ENV_KEY} from ${MISE_TOML_FILE_NAME}): ${prodApiUrl}`,
  )

  console.log('Building Phaser web assets…')
  runCommand('pnpm', ['build'], buildEnvironment)

  if (!existsSync(distDirectory)) {
    throw new Error(`Phaser dist missing: ${distDirectory}`)
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
