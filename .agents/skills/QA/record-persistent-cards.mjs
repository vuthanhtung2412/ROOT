/**
 * Frontend QA: screenshot each persistent card (board + faction modal + actions).
 *
 * Usage (from repo root, web :3000 + phaser running):
 *   ROOT_PHASER_URL=http://localhost:5173 node .cursor/skills/QA/record-persistent-cards.mjs
 *   ROOT_PHASER_URL=http://localhost:5173 node .cursor/skills/QA/record-persistent-cards.mjs boat-builders
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  installAutonomousClickHighlight,
} from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(
  rootDirectory,
  'tmp/artifacts/persistent-cards',
)
const snapshotsDirectory = path.join(
  rootDirectory,
  'tmp/qa/snapshots/persistent',
)
const phaserUrl = process.env.ROOT_PHASER_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_API ?? 'http://localhost:3000'
const onlySlug = process.argv[2]

async function loadSnapshot(snapshotRelativePath) {
  const snapshotPath = path.join(
    rootDirectory,
    'tmp/qa/snapshots',
    snapshotRelativePath,
  )
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

async function fetchActions() {
  const response = await fetch(`${apiUrl}/game/actions`)
  if (!response.ok) {
    throw new Error(`GET /game/actions ${String(response.status)}`)
  }
  const body = await response.json()
  return body.actions
}

async function fetchGame() {
  const response = await fetch(`${apiUrl}/game`)
  if (!response.ok) {
    throw new Error(`GET /game ${String(response.status)}`)
  }
  return response.json()
}

async function clickGame(page, canvas, gameX, gameY) {
  const box = await canvas.boundingBox()
  if (box === null) {
    throw new Error('canvas missing')
  }
  const scaleX = box.width / 1280
  const scaleY = box.height / 720
  await page.mouse.click(box.x + gameX * scaleX, box.y + gameY * scaleY)
}

async function qaContinue(page, canvas) {
  // MenuScene DEV: "QA: Continue loaded game" at (width/2, height*0.6)
  await clickGame(page, canvas, 640, 720 * 0.6)
  await page.waitForTimeout(2500)
}

async function waitForPhaser(page, predicate, label, timeoutMs = 12_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = await page.evaluate(predicate)
    if (value) {
      return value
    }
    await page.waitForTimeout(200)
  }
  throw new Error(`timeout waiting Phaser for ${label}`)
}

async function openFactionBoard(page, canvas, seat) {
  const railX = 12 + 75
  const railY = 56 + 32 + seat * 72
  await clickGame(page, canvas, railX, railY)
  await page.waitForTimeout(800)
  await waitForPhaser(
    page,
    () => {
      const scene = window.__ROOT_PHASER_GAME__?.scene.getScene('GameScene')
      return scene?.factionBoardModal?.isOpen?.() === true ? true : null
    },
    'faction board modal open',
  )
}

async function recordOne(entry, browser) {
  const cardDirectory = path.join(artifactsDirectory, entry.slug)
  await mkdir(cardDirectory, { recursive: true })

  await loadSnapshot(entry.snapshot)
  const actions = await fetchActions()
  const actionTypes = actions.map((action) => action.type)
  console.log(`${entry.slug}: legal=${actionTypes.join(',')}`)

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
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
  await page.goto(phaserUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('canvas', { timeout: 20_000 })
  await page.waitForTimeout(1000)
  const canvas = page.locator('canvas').first()

  await page.screenshot({
    path: path.join(cardDirectory, '01-menu.png'),
  })

  await qaContinue(page, canvas)
  await page.screenshot({
    path: path.join(cardDirectory, '02-board-tray.png'),
  })

  const game = await fetchGame()
  const ownerSeat = game.state.players.findIndex((player) =>
    (player.playArea ?? []).some((card) => card.defId === entry.defId),
  )
  const seatToOpen = ownerSeat >= 0 ? ownerSeat : 0

  await openFactionBoard(page, canvas, seatToOpen)
  await page.screenshot({
    path: path.join(cardDirectory, '03-faction-board.png'),
  })

  // Close modal
  await clickGame(page, canvas, 1280 - 20, 18)
  await page.waitForTimeout(400)

  const playArea = game.state.players[seatToOpen]?.playArea ?? []
  const hasCard = playArea.some((card) => card.defId === entry.defId)

  const missingExpected = (entry.expectedActionTypes ?? []).filter(
    (type) => !actionTypes.includes(type),
  )

  const report = {
    slug: entry.slug,
    defId: entry.defId,
    name: entry.name,
    phase: `${game.state.phase}/${game.state.step}`,
    currentSeat: game.state.currentSeat,
    cardVisibleInState: hasCard,
    legalActionTypes: actionTypes,
    expectedActionTypes: entry.expectedActionTypes ?? [],
    missingExpectedActionTypes: missingExpected,
    consoleErrors,
  }
  await writeFile(
    path.join(cardDirectory, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  )

  await context.close()
  return report
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const manifest = JSON.parse(
    await readFile(path.join(snapshotsDirectory, 'manifest.json'), 'utf8'),
  )
  const entries = onlySlug
    ? manifest.filter((entry) => entry.slug === onlySlug)
    : manifest
  if (entries.length === 0) {
    throw new Error(`no scenarios matched ${onlySlug ?? '(all)'}`)
  }

  const browser = await chromium.launch({ headless: true })
  const reports = []
  for (const entry of entries) {
    try {
      reports.push(await recordOne(entry, browser))
    } catch (error) {
      console.error(`FAIL ${entry.slug}:`, error)
      reports.push({
        slug: entry.slug,
        defId: entry.defId,
        name: entry.name,
        error: String(error),
      })
    }
  }
  await browser.close()

  const lines = [
    '# Persistent card Frontend QA',
    '',
    `Phaser: ${phaserUrl}`,
    `API: ${apiUrl}`,
    `Captured: ${new Date().toISOString()}`,
    '',
    '| Card | defId | Board | Tray actions | Expected grants | Notes |',
    '|------|-------|-------|--------------|-----------------|-------|',
  ]
  for (const report of reports) {
    if (report.error) {
      lines.push(
        `| ${report.name} | ${report.defId} | FAIL | — | — | ${report.error} |`,
      )
      continue
    }
    const grants = (report.expectedActionTypes ?? []).join(', ') || '—'
    const missing =
      report.missingExpectedActionTypes?.length > 0
        ? `missing: ${report.missingExpectedActionTypes.join(', ')}`
        : 'ok'
    const tray = report.legalActionTypes.slice(0, 8).join(', ')
    lines.push(
      `| [${report.name}](./${report.slug}/03-faction-board.png) | ${report.defId} | [tray](./${report.slug}/02-board-tray.png) · [board](./${report.slug}/03-faction-board.png) | \`${tray}\` | ${grants} | ${missing}; cardInState=${String(report.cardVisibleInState)} |`,
    )
  }
  lines.push('')
  lines.push('## How to review')
  lines.push('- Open each `03-faction-board.png` — crafted/play area should name the persistent card.')
  lines.push('- Open `02-board-tray.png` — Action tray should list grant types when expected.')
  lines.push('- Grant actions may still show `Unsupported action …` if composer not wired (backend legal ≠ UI complete).')
  lines.push('')

  await writeFile(
    path.join(artifactsDirectory, 'REVIEW.md'),
    `${lines.join('\n')}\n`,
    'utf8',
  )
  await writeFile(
    path.join(artifactsDirectory, 'reports.json'),
    `${JSON.stringify(reports, null, 2)}\n`,
    'utf8',
  )
  console.log(`wrote review → ${path.join(artifactsDirectory, 'REVIEW.md')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
