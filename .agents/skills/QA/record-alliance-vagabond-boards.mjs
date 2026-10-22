/**
 * Frontend QA videos: Alliance + Vagabond faction boards (React HUD).
 *
 * Rule checklist (Law of Root §8 / §9) exercised visually:
 * - Alliance 8.2.3 Supporters stack inspectable; suit spend summary; setup 8.3
 *   (10 sympathy on track, 3 bases in supply, 3 supporters).
 * - Vagabond 9.2.5 Items: satchel (boot/torch/sword) + tea track; Thief start 9.3.5.
 *
 * Usage (web :3000 + react :5173):
 *   ROOT_REACT_URL=http://localhost:5173 node .cursor/skills/QA/record-alliance-vagabond-boards.mjs
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { mkdir, readdir, copyFile, rm } from 'node:fs/promises'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts')
const snapshotPath = path.join(
  rootDirectory,
  'tmp/qa/snapshots/alliance-vagabond-boards.json',
)
const reactUiUrl =
  process.env.ROOT_REACT_URL ?? process.env.ROOT_PHASER_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'

async function loadSnapshot() {
  const load = spawnSync(
    'pnpm',
    ['--filter', '@root/cli', 'start', '--', 'load', snapshotPath],
    {
      cwd: rootDirectory,
      env: { ...process.env, ROOT_DEV_API: apiUrl },
      encoding: 'utf8',
    },
  )
  if (load.status !== 0) {
    throw new Error(`cli load failed:\n${load.stdout}\n${load.stderr}`)
  }
  console.log(load.stdout.trim())
}

async function fetchGame() {
  const response = await fetch(`${apiUrl}/game`)
  if (!response.ok) {
    throw new Error(`GET /game ${String(response.status)}`)
  }
  return response.json()
}

/**
 * @param {import('playwright').Page} page
 * @param {string} factionSubstring
 */
async function openFactionBoard(page, factionSubstring) {
  const seatButton = page
    .locator('button')
    .filter({ hasText: new RegExp(factionSubstring, 'i') })
    .first()
  await seatButton.click()
  await page.waitForSelector('.faction-board-modal', { timeout: 10_000 })
  await page.waitForTimeout(1200)
}

/**
 * @param {import('playwright').Page} page
 */
async function closeFactionBoard(page) {
  const close = page.locator('.faction-board-modal__close')
  if ((await close.count()) > 0) {
    await close.click()
    await page.waitForTimeout(600)
  }
}

async function recordScenario(videoName, drive) {
  const staging = path.join(artifactsDirectory, `video-raw-${videoName}`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })

  await loadSnapshot()
  const gameBefore = await fetchGame()
  console.log(
    videoName,
    'loaded',
    `${gameBefore.state.phase}/${gameBefore.state.step}`,
    'seat',
    gameBefore.state.currentSeat,
  )

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: staging,
      size: { width: 1280, height: 720 },
    },
  })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await installAutonomousClickHighlight(page)
  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  await page
    .getByRole('button', { name: 'QA: Continue loaded game' })
    .waitFor({ timeout: 20_000 })
  await page.waitForTimeout(800)

  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-01-menu.png`),
  })

  await page.getByRole('button', { name: 'QA: Continue loaded game' }).click()
  await page.getByText(/alliance/i).first().waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1500)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-02-game.png`),
  })

  await drive(page)

  await page.waitForTimeout(1500)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-04-after.png`),
  })

  const gameAfter = await fetchGame()
  await context.close()
  await browser.close()

  const recordedFiles = (await readdir(staging)).filter((name) =>
    name.endsWith('.webm'),
  )
  if (recordedFiles.length === 0) {
    throw new Error(`no webm for ${videoName}`)
  }
  const unusedVideoName = await pickUnusedVideoName(artifactsDirectory, videoName)
  const webmPath = path.join(artifactsDirectory, `${unusedVideoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${unusedVideoName}.mp4`)
  await copyFile(path.join(staging, recordedFiles[0]), webmPath)

  const ffmpeg = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webmPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4Path,
    ],
    { encoding: 'utf8' },
  )
  if (ffmpeg.status !== 0) {
    console.error(ffmpeg.stderr)
  }

  console.log(
    JSON.stringify(
      {
        scenario: videoName,
        ok: consoleErrors.length === 0,
        videoMp4: mp4Path,
        videoWebm: webmPath,
        phaseAfter: `${gameAfter.state.phase}/${gameAfter.state.step}`,
        consoleErrors: consoleErrors.slice(0, 8),
      },
      null,
      2,
    ),
  )
  return { consoleErrors, mp4Path }
}

/** @param {import('playwright').Page} page */
async function driveAlliance(page) {
  await openFactionBoard(page, 'alliance')
  await page.screenshot({
    path: path.join(artifactsDirectory, 'qa-alliance-board-03-modal.png'),
  })
  await page.waitForTimeout(1500)

  // Rule 8.2.3 — inspect supporters (top card + suit bar + gallery)
  const supporters = page.locator('.faction-board-modal__supporters-hit')
  if ((await supporters.count()) > 0) {
    await supporters.click()
    await page.waitForSelector('.card-gallery-modal', { timeout: 8000 })
    await page.waitForTimeout(1600)
    await page.screenshot({
      path: path.join(artifactsDirectory, 'qa-alliance-board-03b-supporters.png'),
    })
    await page.locator('.card-gallery-modal__close').click()
    await page.waitForTimeout(700)
  }

  await closeFactionBoard(page)
}

/** @param {import('playwright').Page} page */
async function driveVagabond(page) {
  await openFactionBoard(page, 'vagabond')
  await page.screenshot({
    path: path.join(artifactsDirectory, 'qa-vagabond-board-03-modal.png'),
  })
  // Linger so satchel + tea + torch are visible on video
  await page.waitForTimeout(2800)
  await closeFactionBoard(page)
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })

  // Refresh snapshot (run from lib so tsx resolves)
  const make = spawnSync(
    'pnpm',
    ['exec', 'tsx', '../.cursor/skills/QA/make-alliance-vagabond-snapshot.ts'],
    { cwd: path.join(rootDirectory, 'lib'), encoding: 'utf8' },
  )
  if (make.status !== 0) {
    throw new Error(`make snapshot failed:\n${make.stdout}\n${make.stderr}`)
  }
  console.log(make.stdout.trim())

  const alliance = await recordScenario('qa-alliance-board', driveAlliance)
  const vagabond = await recordScenario('qa-vagabond-board', driveVagabond)

  console.log(
    JSON.stringify(
      {
        videos: [alliance.mp4Path, vagabond.mp4Path],
        allianceOk: alliance.consoleErrors.length === 0,
        vagabondOk: vagabond.consoleErrors.length === 0,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
