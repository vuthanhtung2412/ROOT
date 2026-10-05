/**
 * Build React UI, copy into `public/`, start `@root/web` (tsx — lib ships `.ts` sources).
 *
 * Run: pnpm --filter @root/web serve:react
 * Or:  pnpm serve:game (from repo root)
 */
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const webPackageDirectory = resolve(scriptDirectory, '..')
const repositoryRootDirectory = resolve(webPackageDirectory, '../..')
const reactPackageDirectory = join(repositoryRootDirectory, 'frontend/react')
const reactDistDirectory = join(reactPackageDirectory, 'dist')
const publicDirectory = join(webPackageDirectory, 'public')

function runCommand(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })
  if (result.status !== 0) {
    const joined = [command, ...args].join(' ')
    throw new Error(`Command failed (${String(result.status)}): ${joined}`)
  }
}

function main(): void {
  console.log('Building @root/react…')
  runCommand('pnpm', ['--filter', '@root/react', 'build'], repositoryRootDirectory)

  if (!existsSync(reactDistDirectory)) {
    throw new Error(`React dist missing: ${reactDistDirectory}`)
  }

  console.log(`Copying ${reactDistDirectory} → ${publicDirectory}`)
  rmSync(publicDirectory, { recursive: true, force: true })
  cpSync(reactDistDirectory, publicDirectory, { recursive: true })

  console.log('Starting @root/web…')
  runCommand('pnpm', ['exec', 'tsx', 'src/index.ts'], webPackageDirectory)
}

main()
