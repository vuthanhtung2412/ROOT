/**
 * Build Phaser web assets, sync into Capacitor iOS, open Xcode.
 *
 * Run: pnpm --filter @root/phaser build:ios
 * Or:  pnpm build:ios (from repo root)
 *
 * Requires macOS + Xcode. Native API default = mise `ROOT_FUNNEL_URL`.
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const phaserPackageDirectory = resolve(scriptDirectory, '..')
const distDirectory = join(phaserPackageDirectory, 'dist')
const iosDirectory = join(phaserPackageDirectory, 'ios')

function runCommand(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: phaserPackageDirectory,
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
  const funnelUrl = process.env.ROOT_FUNNEL_URL
  if (typeof funnelUrl === 'string' && funnelUrl.length > 0) {
    console.log(`Native API default (ROOT_FUNNEL_URL): ${funnelUrl}`)
  } else {
    console.warn(
      'ROOT_FUNNEL_URL unset — set it in .mise.toml before build:ios',
    )
  }

  console.log('Building Phaser web assets…')
  runCommand('pnpm', ['build'])

  if (!existsSync(distDirectory)) {
    throw new Error(`Phaser dist missing: ${distDirectory}`)
  }

  if (!existsSync(iosDirectory)) {
    console.log('Adding Capacitor iOS platform…')
    runCommand('pnpm', ['exec', 'cap', 'add', 'ios'])
  }

  console.log('Syncing Capacitor iOS…')
  runCommand('pnpm', ['exec', 'cap', 'sync', 'ios'])

  console.log('Opening Xcode…')
  runCommand('pnpm', ['exec', 'cap', 'open', 'ios'])
}

main()
