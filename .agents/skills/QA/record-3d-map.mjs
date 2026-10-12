/**
 * Demo of the 3D map → video under tmp/artifacts.
 *
 * Plays on a very crowded four-faction board (Marquise, Eyrie, Alliance,
 * Vagabond): flat map → 3D map seen from above with 2D icons → zoom into the
 * fullest clearing (the camera tilts, the 3D models rise) → pan to the keep →
 * End Phase for the evening light → a birdsong game for the dawn.
 *
 * Usage (spare web backend + react dev server, see SKILL.md):
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-ui-busy-snapshot.ts
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-3d-map-crowded-snapshot.ts
 *   ROOT_DEV_API=http://localhost:3000 ROOT_REACT_URL=http://localhost:5173 \
 *     node .agents/skills/QA/record-3d-map.mjs
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, mkdtemp, readdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installAutonomousClickHighlight } from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts')
const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
/** Four factions, Vagabond's daylight, three clearings packed full. */
const SNAPSHOT_PATH = 'tmp/qa/snapshots/3d-map-crowded.json'
/** A game standing in birdsong, only looked at (for the dawn light). */
const BIRDSONG_SNAPSHOT_PATH = 'tmp/qa/snapshots/alliance-birdsong-revolt.json'
const VIDEO_NAME = 'demo-3d-map'
const VIEWPORT = { width: 1440, height: 900 }
const DRAG_STEP_PAUSE_MS = 16
/** The clearings of the 3D map show up once its scene is loaded. */
const MAP_3D_READY_SELECTOR = '.map-3d-canvas ~ [data-clearing-id]'
/** The fullest clearing: three slots taken, three armies, the pawn. */
const CROWDED_CLEARING_ID = 10
/** The keep: the other packed clearing, up in the corner. */
const KEEP_CLEARING_ID = 0

/**
 * Drag slowly enough for the video to show the camera moving.
 * @param {import('playwright').Page} page
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {number} [steps]
 */
async function slowDrag(page, from, to, steps = 60) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps
    await page.mouse.move(
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
    )
    await page.waitForTimeout(DRAG_STEP_PAUSE_MS)
  }
  await page.mouse.up()
}

/**
 * @param {import('playwright').Page} page
 * @param {number} totalDelta negative zooms in
 */
async function slowZoom(page, totalDelta) {
  const steps = 40
  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, totalDelta / steps)
    await page.waitForTimeout(45)
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} label
 */
async function caption(page, label) {
  await page.evaluate((text) => {
    const existing = document.getElementById('qa-demo-caption')
    const element = existing ?? document.createElement('div')
    element.id = 'qa-demo-caption'
    element.textContent = text
    element.style.cssText =
      'position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:99999;' +
      'padding:8px 18px;border-radius:999px;background:rgba(20,28,40,.9);color:#f0e6d3;' +
      'font:600 18px Georgia,serif;pointer-events:none;white-space:nowrap'
    if (existing === null) document.body.appendChild(element)
  }, label)
}

/**
 * @param {import('playwright').Page} page
 * @param {number} clearingId
 * @returns {Promise<{ x: number, y: number }>}
 */
async function clearingCenter(page, clearingId) {
  const box = await page
    .locator(`[data-clearing-id="${String(clearingId)}"]`)
    .boundingBox()
  if (box === null) throw new Error(`clearing ${String(clearingId)} not on screen`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** @returns {Promise<{ factions: string[], phase: string }>} */
async function gameSummary() {
  const response = await fetch(`${apiUrl}/game`)
  const game = await response.json()
  return { factions: game.state.factions, phase: game.state.phase }
}

/** @param {import('playwright').Page} page */
async function drive(page) {
  await page.goto(`${reactUiUrl}/?qaSnapshot=${SNAPSHOT_PATH}`)
  await page.getByRole('button', { name: 'QA: Continue loaded game' }).click()
  await page.waitForSelector('[data-clearing-id]', { timeout: 20_000 })
  console.log(`game: ${JSON.stringify(await gameSummary())}`)
  // The game opens on the 3D map: the demo starts from the flat one.
  await page.locator('.map-view-toggle').click()
  await caption(page, 'Flat map — four factions, a very crowded board')
  await page.waitForTimeout(2400)

  await caption(page, '3D map: the whole background, seen from above, 2D icons')
  await page.locator('.map-view-toggle').click()
  await page.waitForSelector(MAP_3D_READY_SELECTOR, { timeout: 30_000 })
  await page.waitForTimeout(4200)

  await caption(page, 'Zoom in: the camera tilts, 3D models rise, icons shrink')
  const overview = await clearingCenter(page, CROWDED_CLEARING_ID)
  await page.mouse.move(overview.x, overview.y)
  await slowZoom(page, -2300)
  await page.waitForTimeout(1600)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${VIDEO_NAME}-crowded-clearing.png`),
  })

  await caption(page, 'A full clearing: 3 slots taken, 3 armies, wood, sympathy, the Vagabond')
  await page.waitForTimeout(2600)

  await caption(page, 'Drag to pan — over to the keep')
  // Drags towards the top left corner, until the keep is well in view.
  for (let leg = 0; leg < 5; leg += 1) {
    const keepNow = await clearingCenter(page, KEEP_CLEARING_ID)
    if (keepNow.x > VIEWPORT.width * 0.35) break
    const from = { x: VIEWPORT.width * 0.42, y: VIEWPORT.height * 0.4 }
    await slowDrag(page, from, { x: from.x + 420, y: from.y + 250 }, 70)
    await page.waitForTimeout(300)
  }
  const keep = await clearingCenter(page, KEEP_CLEARING_ID)
  console.log(`keep on screen at ${String(Math.round(keep.x))},${String(Math.round(keep.y))}`)
  await page.waitForTimeout(1800)

  await caption(page, 'Hide actions: the tray folds, the map stays put')
  await page.locator('.action-tray__collapse').click()
  await page.waitForSelector(MAP_3D_READY_SELECTOR, { timeout: 30_000 })
  await page.waitForTimeout(4200)
  await caption(page, 'Show them again')
  await page.locator('.action-tray__collapse').click()
  await page.waitForSelector(MAP_3D_READY_SELECTOR, { timeout: 30_000 })
  await page.waitForTimeout(3600)

  // The light follows the phase of the turn: daylight fades to evening …
  await caption(page, 'End Phase → evening: the woodland goes dark')
  await page.getByRole('button', { name: /end phase/i }).first().click()
  await page.waitForTimeout(4200)
  console.log(`after End Phase: ${JSON.stringify(await gameSummary())}`)

  // … and a game standing in birdsong opens at dawn. A reload re-enters the
  // game without the menu, so the state is swapped on the server first.
  const birdsongSnapshot = await readFile(
    path.join(rootDirectory, BIRDSONG_SNAPSHOT_PATH),
    'utf8',
  )
  await fetch(`${apiUrl}/game/snapshot?replace=1`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: birdsongSnapshot,
  })
  await page.reload()
  // The map choice is page state: a reload starts on the 3D map again.
  await page.waitForSelector(MAP_3D_READY_SELECTOR, { timeout: 30_000 })
  await caption(page, 'Birdsong: orange dawn sun, warm mist')
  await page.waitForTimeout(4600)

  await caption(page, 'Back to the flat map')
  await page.locator('.map-view-toggle').click()
  await page.waitForTimeout(2200)
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const staging = await mkdtemp(path.join(os.tmpdir(), 'root-3d-map-'))
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: staging, size: VIEWPORT },
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => {
    console.error('page error:', error.message)
  })
  await installAutonomousClickHighlight(page)
  try {
    await drive(page)
  } finally {
    await context.close()
    await browser.close()
  }

  const recordedFiles = (await readdir(staging)).filter((name) =>
    name.endsWith('.webm'),
  )
  if (recordedFiles.length === 0) throw new Error('no video recorded')
  const videoName = await pickUnusedVideoName(artifactsDirectory, VIDEO_NAME)
  const webmPath = path.join(artifactsDirectory, `${videoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${videoName}.mp4`)
  await copyFile(path.join(staging, recordedFiles[0]), webmPath)
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-n', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { encoding: 'utf8' },
  )
  if (ffmpeg.status !== 0) console.error(ffmpeg.stderr)
  console.log(`video: ${mp4Path}`)
}

await main()
