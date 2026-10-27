/**
 * Demo: Eyrie Decree medallion prefers non-bird; sole clearing auto-submits.
 *
 * Spare servers (leave :3000 alone):
 *   ROOT_GAME_STORE_FILE=off PORT=3001 pnpm --filter @root/web dev
 *   ROOT_DEV_API=http://localhost:3001 pnpm --filter @root/react exec vite --port 5180 --strictPort
 *   ROOT_DEV_API=http://localhost:3001 ROOT_REACT_URL=http://localhost:5180 \
 *     node .cursor/skills/QA/record-eyrie-decree-auto.mjs
 *
 * Snapshot: tmp/qa/snapshots/eyrie-decree-auto.json
 * Output: tmp/artifacts/eyrie-decree-auto/qa-eyrie-decree-auto.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/eyrie-decree-auto')
const snapshotPath = path.join(
  rootDirectory,
  'tmp/qa/snapshots/eyrie-decree-auto.json',
)
const VIDEO_NAME = 'qa-eyrie-decree-auto'
const INTRO = 'Eyrie Decree · non-bird first · sole clearing auto'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5180'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3001'
const isHeaded = process.env.HEADED === '1'
const isDryRun = process.env.DRY_RUN === '1'
const VIEWPORT = { width: 1440, height: 900 }
const LOOK_MS = 1600
const SETTLE_MS = 900
const FOX_CARD_ID = 'ROOT-72#qa-decree'

async function fetchJson(route) {
  const response = await fetch(`${apiUrl}${route}`)
  if (!response.ok) throw new Error(`GET ${route} ${response.status}`)
  return response.json()
}

async function loadSnapshot() {
  const response = await fetch(`${apiUrl}/game/snapshot?replace=1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: await readFile(snapshotPath, 'utf8'),
  })
  if (!response.ok) throw new Error(`PUT /game/snapshot ${response.status}`)
}

async function convertWebmToMp4(webmPath, mp4Path) {
  const result = spawnSync(
    'ffmpeg',
    ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4Path],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) {
    console.warn('ffmpeg convert skipped:', result.stderr?.slice(0, 200))
    return false
  }
  return true
}

/**
 * @param {import('playwright').Page} page
 */
async function qaContinue(page) {
  const button = page.getByRole('button', { name: 'QA: Continue loaded game' })
  await button.waitFor({ timeout: 20_000 })
  await button.click()
  await page.waitForTimeout(2200)
}

/**
 * @param {import('playwright').Page} page
 */
async function clickRecruitMedallion(page) {
  const head = page.locator('button.action-dock__decree-head').first()
  await head.waitFor({ timeout: 10_000 })
  await head.click()
  await page.waitForTimeout(SETTLE_MS)
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const videoName = await pickUnusedVideoName(artifactsDirectory, VIDEO_NAME)
  const tempVideoDirectory = path.join(artifactsDirectory, `${videoName}-pw`)
  await mkdir(tempVideoDirectory, { recursive: true })

  console.log(`API ${apiUrl}`)
  console.log(`UI  ${reactUiUrl}`)
  console.log(`load ${snapshotPath}`)
  await loadSnapshot()
  const before = await fetchJson('/game')
  console.log(
    `before: seat=${before.state.currentSeat} ${before.state.phase}/${before.state.step}`,
  )

  const browser = await chromium.launch({ headless: !isHeaded })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: isDryRun
      ? undefined
      : { dir: tempVideoDirectory, size: VIEWPORT },
  })
  const page = await context.newPage()
  await installAutonomousClickHighlight(page)

  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await qaContinue(page)

  // Intro beat: decree dock visible.
  await page.locator('.action-dock__decree').waitFor({ timeout: 15_000 })
  await page.waitForTimeout(LOOK_MS)

  // Medallion → non-bird (rabbit) + sole clearing auto-submit.
  await clickRecruitMedallion(page)
  await page.waitForTimeout(LOOK_MS)

  const mid = await fetchJson('/game')
  const remaining = mid.state?.turnScratch?.decree?.remaining ?? []
  if (remaining.includes(FOX_CARD_ID)) {
    throw new Error(
      `expected fox card cleared first, remaining=${JSON.stringify(remaining)}`,
    )
  }
  console.log('ok: fox (non-bird) cleared first', remaining)

  // Second medallion click → bird vizier, also sole clearing auto.
  await clickRecruitMedallion(page)
  await page.waitForTimeout(LOOK_MS)

  const after = await fetchJson('/game')
  const column = after.state?.turnScratch?.decree?.column
  console.log(
    `after recruit: column=${String(column)} phase=${after.state.phase}/${after.state.step}`,
  )

  await page.waitForTimeout(LOOK_MS)
  await context.close()
  await browser.close()

  if (isDryRun) {
    console.log('DRY_RUN: no video kept')
    await rm(tempVideoDirectory, { recursive: true, force: true })
    return
  }

  const recorded = (await readdir(tempVideoDirectory)).find((name) =>
    name.endsWith('.webm'),
  )
  if (recorded === undefined) {
    throw new Error('playwright left no webm')
  }
  const webmPath = path.join(artifactsDirectory, `${videoName}.webm`)
  await copyFile(path.join(tempVideoDirectory, recorded), webmPath)
  await rm(tempVideoDirectory, { recursive: true, force: true })

  const mp4Path = path.join(artifactsDirectory, `${videoName}.mp4`)
  const converted = await convertWebmToMp4(webmPath, mp4Path)
  console.log(`video: ${webmPath}`)
  if (converted) console.log(`video: ${mp4Path}`)
  console.log(INTRO)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
