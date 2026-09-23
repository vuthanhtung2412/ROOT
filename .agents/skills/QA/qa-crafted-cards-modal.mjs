/**
 * Frontend QA: open crafted-cards modal with packed playArea; scroll + screenshots.
 *
 * Usage (servers up: web :3000, phaser :5173/:5174):
 *   ROOT_PHASER_URL=http://localhost:5173 node .cursor/skills/QA/qa-crafted-cards-modal.mjs
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts')
const snapshotPath = path.join(
  rootDirectory,
  'tmp/qa/snapshots/crafted-cards-many.json',
)
const phaserUrl = process.env.ROOT_PHASER_URL ?? 'http://localhost:5174'
const apiUrl = process.env.ROOT_API ?? 'http://localhost:3000'

/** PlayerRail: container (12,56), row0 button origin(1,1) at (ROW_WIDTH-8, ROW_HEIGHT-12) */
const MARQUISE_CARDS_BUTTON = { x: 160, y: 100 }
const EYRIE_CARDS_BUTTON = { x: 160, y: 172 }

async function loadSnapshot() {
  const load = spawnSync(
    'pnpm',
    ['--filter', '@root/cli', 'start', '--', 'load', snapshotPath],
    {
      cwd: rootDirectory,
      env: { ...process.env, ROOT_API: apiUrl },
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
 * @param {import('playwright').Locator} canvas
 * @param {number} gameX
 * @param {number} gameY
 */
async function clickGame(page, canvas, gameX, gameY) {
  const box = await canvas.boundingBox()
  if (box === null) {
    throw new Error('canvas missing')
  }
  const scaleX = box.width / 1280
  const scaleY = box.height / 720
  await page.mouse.click(box.x + gameX * scaleX, box.y + gameY * scaleY)
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  await loadSnapshot()

  const game = await fetchGame()
  const playAreas = game.state.players.map((player) => ({
    seat: player.seat,
    faction: player.faction,
    playAreaCount: (player.playArea ?? []).length,
  }))
  console.log('playAreas', JSON.stringify(playAreas))

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const consoleErrors = []
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await installAutonomousClickHighlight(page)
  await page.goto(phaserUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('canvas', { timeout: 20_000 })
  await page.waitForTimeout(1500)
  const canvas = page.locator('canvas').first()

  await page.screenshot({
    path: path.join(artifactsDirectory, 'qa-crafted-cards-01-menu.png'),
  })

  // MenuScene: Continue loaded game
  await clickGame(page, canvas, 640, 720 * 0.6)
  await page.waitForTimeout(3000)
  await page.screenshot({
    path: path.join(artifactsDirectory, 'qa-crafted-cards-02-board.png'),
  })

  // Open Marquise crafted cards
  await clickGame(page, canvas, MARQUISE_CARDS_BUTTON.x, MARQUISE_CARDS_BUTTON.y)
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(artifactsDirectory, 'qa-crafted-cards-03-marquise-modal.png'),
  })

  // Horizontal scroll via wheel over modal center
  const box = await canvas.boundingBox()
  if (box === null) {
    throw new Error('canvas missing')
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let step = 0; step < 8; step++) {
    await page.mouse.wheel(180, 0)
    await page.waitForTimeout(120)
  }
  await page.screenshot({
    path: path.join(artifactsDirectory, 'qa-crafted-cards-04-scrolled.png'),
  })

  // Drag scroll further
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await page.waitForTimeout(400)
  await page.screenshot({
    path: path.join(artifactsDirectory, 'qa-crafted-cards-05-dragged.png'),
  })

  // Close via veil (top-left corner of screen, outside panel)
  await clickGame(page, canvas, 40, 40)
  await page.waitForTimeout(500)

  // Open Eyrie crafted cards
  await clickGame(page, canvas, EYRIE_CARDS_BUTTON.x, EYRIE_CARDS_BUTTON.y)
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(artifactsDirectory, 'qa-crafted-cards-06-eyrie-modal.png'),
  })

  await browser.close()

  if (consoleErrors.length > 0) {
    console.error('console errors:', consoleErrors)
    process.exit(1)
  }
  console.log('OK — artifacts in tmp/artifacts/qa-crafted-cards-*.png')
  console.log(
    `verified API playArea counts: ${playAreas.map((entry) => `${entry.faction}=${String(entry.playAreaCount)}`).join(', ')}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
