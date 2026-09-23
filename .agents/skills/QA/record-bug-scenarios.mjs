/**
 * Frontend QA videos for each BUG.md / PLAN.md fix.
 *
 * Usage (web :3000 + phaser :5174 running):
 *   ROOT_PHASER_URL=http://localhost:5174 node .cursor/skills/QA/record-bug-scenarios.mjs
 *   ROOT_PHASER_URL=http://localhost:5174 node .cursor/skills/QA/record-bug-scenarios.mjs 01-defenseless
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { mkdir, readdir, copyFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  installAutonomousClickHighlight,
} from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/bugs')
const snapshotsDirectory = path.join(rootDirectory, 'tmp/qa/snapshots/bugs')
const phaserUrl = process.env.ROOT_PHASER_URL ?? 'http://localhost:5174'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'

/** Autumn map hit targets for 1280×720. */
function clearingCenters() {
  const viewWidth = 1280
  const viewHeight = 720
  const boardWidth = viewWidth * 0.74
  const boardHeight = viewHeight * 0.82
  const textureWidth = 3479
  const textureHeight = 3189
  const scale = Math.min(boardWidth / textureWidth, boardHeight / textureHeight)
  const displayWidth = textureWidth * scale
  const displayHeight = textureHeight * scale
  const originX = viewWidth * 0.5 - displayWidth / 2
  const originY = viewHeight * 0.42 - displayHeight / 2
  const layout = {
    0: { x: 0.113, y: 0.119 },
    1: { x: 0.881, y: 0.226 },
    2: { x: 0.836, y: 0.868 },
    3: { x: 0.104, y: 0.819 },
    4: { x: 0.548, y: 0.097 },
    5: { x: 0.894, y: 0.531 },
    6: { x: 0.583, y: 0.78 },
    7: { x: 0.354, y: 0.912 },
    8: { x: 0.108, y: 0.387 },
    9: { x: 0.437, y: 0.294 },
    10: { x: 0.645, y: 0.497 },
    11: { x: 0.313, y: 0.545 },
  }
  /** @type {Record<number, { x: number, y: number }>} */
  const centers = {}
  for (const [key, point] of Object.entries(layout)) {
    centers[Number(key)] = {
      x: originX + point.x * displayWidth,
      y: originY + point.y * displayHeight,
    }
  }
  return centers
}

/**
 * @typedef {{
 *   id: string
 *   snapshotName: string
 *   videoName: string
 *   drive: (ctx: DriveContext) => Promise<void>
 * }} BugScenario
 *
 * @typedef {{
 *   page: import('playwright').Page
 *   canvas: import('playwright').Locator
 *   actionsBefore: unknown[]
 *   shot: (suffix: string) => Promise<void>
 * }} DriveContext
 */

/** @type {BugScenario[]} */
const SCENARIOS = [
  {
    id: '01-defenseless',
    snapshotName: '01-defenseless-battle.json',
    videoName: 'qa-bug-01-defenseless-battle',
    drive: driveDefenselessBattle,
  },
  {
    id: '02-winner',
    snapshotName: '02-winner-menu.json',
    videoName: 'qa-bug-02-winner-menu',
    drive: driveWinnerMenu,
  },
  {
    id: '03-field-hospital',
    snapshotName: '03-field-hospital.json',
    videoName: 'qa-bug-03-field-hospital',
    drive: driveObservePrompt,
  },
  {
    id: '04-no-undo',
    snapshotName: '04-no-undo-drawer.json',
    videoName: 'qa-bug-04-no-undo-drawer',
    drive: driveDrawerNoUndo,
  },
  {
    id: '05-discard-pile',
    snapshotName: '05-discard-pile.json',
    videoName: 'qa-bug-05-discard-pile',
    drive: driveDiscardPile,
  },
  {
    id: '06-discard-raise',
    snapshotName: '06-discard-raise.json',
    videoName: 'qa-bug-06-discard-raise',
    drive: driveDiscardRaise,
  },
  {
    id: '07-ambush',
    snapshotName: '07-ambush-window.json',
    videoName: 'qa-bug-07-ambush-window',
    drive: driveObservePrompt,
  },
  {
    id: '08-auto-end',
    snapshotName: '08-auto-end-phase.json',
    videoName: 'qa-bug-08-auto-end-phase',
    drive: driveAutoEndPhase,
  },
  {
    id: '09-auto-remove',
    snapshotName: '09-auto-remove-warriors.json',
    videoName: 'qa-bug-09-auto-remove-warriors',
    drive: driveAutoRemove,
  },
  {
    id: '10-zero-hit',
    snapshotName: '10-zero-hit-battle.json',
    videoName: 'qa-bug-10-zero-hit-battle',
    drive: driveZeroHit,
  },
  {
    id: '11-battle-hl',
    snapshotName: '11-battle-highlight.json',
    videoName: 'qa-bug-11-battle-highlight',
    drive: driveBattleHighlight,
  },
  {
    id: '12-banner',
    snapshotName: '12-banner-prompt.json',
    videoName: 'qa-bug-12-banner-prompt',
    drive: driveObservePrompt,
  },
  {
    id: '13-ruins',
    snapshotName: '13-ruins.json',
    videoName: 'qa-bug-13-ruins',
    drive: drivePanBoard,
  },
  {
    id: '14-crafted',
    snapshotName: '14-crafted-counts.json',
    videoName: 'qa-bug-14-crafted-counts',
    drive: driveCraftedCounts,
  },
  {
    id: '15-march-lock',
    snapshotName: '15-march-lock.json',
    videoName: 'qa-bug-15-march-lock',
    drive: driveMarchLock,
  },
  {
    id: '16-decree-suit',
    snapshotName: '16-decree-suit.json',
    videoName: 'qa-bug-16-decree-suit',
    drive: driveObservePrompt,
  },
  {
    id: '17-slots',
    snapshotName: '17-slot-counts.json',
    videoName: 'qa-bug-17-slot-counts',
    drive: drivePanBoard,
  },
  {
    id: '18-eyrie-craft',
    snapshotName: '18-eyrie-craft.json',
    videoName: 'qa-bug-18-eyrie-craft',
    drive: driveObservePrompt,
  },
  {
    id: '19-piece-rings',
    snapshotName: '19-piece-rings.json',
    videoName: 'qa-bug-19-piece-rings',
    drive: drivePanBoard,
  },
]

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

async function loadSnapshot(snapshotName) {
  const snapshotPath = path.join(snapshotsDirectory, snapshotName)
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

async function cliAct(action) {
  const act = spawnSync(
    'pnpm',
    ['--filter', '@root/cli', 'start', '--', 'act', JSON.stringify(action)],
    {
      cwd: rootDirectory,
      env: { ...process.env, ROOT_DEV_API: apiUrl },
      encoding: 'utf8',
    },
  )
  if (act.status !== 0) {
    throw new Error(`cli act failed:\n${act.stdout}\n${act.stderr}`)
  }
  console.log(act.stdout.trim())
}

async function qaContinue(page, canvas) {
  await clickGame(page, canvas, 640, 720 * 0.6)
  await page.waitForTimeout(2800)
}

/** @param {DriveContext} ctx */
async function driveObservePrompt(ctx) {
  await ctx.page.waitForTimeout(2200)
  await ctx.shot('03-prompt')
  await ctx.page.waitForTimeout(1500)
}

/** @param {DriveContext} ctx */
async function drivePanBoard(ctx) {
  const centers = clearingCenters()
  for (const clearingId of [0, 4, 9, 11, 2]) {
    const point = centers[clearingId]
    if (point === undefined) continue
    await clickGame(ctx.page, ctx.canvas, point.x, point.y)
    await ctx.page.waitForTimeout(500)
  }
  await ctx.shot('03-board')
  await ctx.page.waitForTimeout(800)
}

/** @param {DriveContext} ctx */
async function driveDefenselessBattle(ctx) {
  const battle = ctx.actionsBefore.find((action) => action.type === 'battle')
  if (battle === undefined) {
    throw new Error('battle missing')
  }
  const targets = battle.params?.targets ?? []
  if (targets.length !== 1 || targets[0]?.clearing !== 4 || targets[0]?.defender !== 1) {
    throw new Error(
      `expected sole battle target C4 vs seat 1, got ${JSON.stringify(targets)}`,
    )
  }
  const actionTypes = ctx.actionsBefore
    .filter((action) => action.actor === 0)
    .map((action) => action.type)
  const battleIndex = actionTypes.indexOf('battle')
  const trayX = 1280 - 160
  const trayY = 56 + 28 + battleIndex * 34 + 10
  await clickGame(ctx.page, ctx.canvas, trayX, trayY)
  await ctx.page.waitForTimeout(900)
  await ctx.shot('03-battle-tray')
  // Only C4 is a legal battle clearing (roost-only eyrie).
  const centers = clearingCenters()
  const point = centers[4]
  await clickGame(ctx.page, ctx.canvas, point.x, point.y)
  await waitForGame(
    (game) => game.state.pending?.[0]?.type === 'battle',
    'battle pending after C4 click',
    8_000,
  )
  await ctx.page.waitForTimeout(1500)
  await ctx.shot('04-after-battle')
}

/** @param {DriveContext} ctx */
async function driveWinnerMenu(ctx) {
  const gameBefore = await fetchGame()
  if (
    gameBefore.state.status !== 'playing' ||
    gameBefore.state.players?.[0]?.vp !== 29
  ) {
    throw new Error(
      `expected playing at 29 VP, got status=${String(gameBefore.state.status)} vp=${String(gameBefore.state.players?.[0]?.vp)}`,
    )
  }
  await ctx.page.waitForTimeout(1500)
  await ctx.shot('03-before-win')

  const battle = ctx.actionsBefore.find((action) => action.type === 'battle')
  if (battle === undefined) {
    throw new Error('battle missing')
  }
  const actionTypes = ctx.actionsBefore
    .filter((action) => action.actor === 0)
    .map((action) => action.type)
  const battleIndex = actionTypes.indexOf('battle')
  const trayX = 1280 - 160
  const trayY = 56 + 28 + battleIndex * 34 + 10
  await clickGame(ctx.page, ctx.canvas, trayX, trayY)
  await ctx.page.waitForTimeout(800)
  const centers = clearingCenters()
  const point = centers[4]
  await clickGame(ctx.page, ctx.canvas, point.x, point.y)

  await waitForGame(
    (game) => game.state.status === 'finished' && game.state.winner === 0,
    'marquise wins at 30 VP',
    15_000,
  )
  await ctx.page.waitForTimeout(1800)
  await ctx.shot('04-winner-overlay')
  // Back to menu deletes the slot (expected 404 after).
  await clickGame(ctx.page, ctx.canvas, 640, 360 + 36)
  await ctx.page.waitForTimeout(2000)
  await ctx.shot('05-menu')
}

/** @param {DriveContext} ctx */
async function driveDrawerNoUndo(ctx) {
  await ctx.page.waitForTimeout(1000)
  // End game left; Discard right — confirm no Undo on either side
  await clickGame(ctx.page, ctx.canvas, 40, 720 - 80)
  await ctx.page.waitForTimeout(300)
  await clickGame(ctx.page, ctx.canvas, 1280 - 50, 720 - 80)
  await ctx.page.waitForTimeout(400)
  await ctx.shot('03-drawer')
  await ctx.page.waitForTimeout(1200)
}

/** @param {DriveContext} ctx */
async function driveDiscardPile(ctx) {
  await clickGame(ctx.page, ctx.canvas, 1280 - 50, 720 - 80)
  await ctx.page.waitForTimeout(1500)
  await ctx.shot('03-discard-modal')
  await ctx.page.waitForTimeout(1200)
}

/** @param {DriveContext} ctx */
async function driveDiscardRaise(ctx) {
  await ctx.page.waitForTimeout(1200)
  await ctx.shot('03-hand')
  // Hand cards roughly bottom center — click a few
  for (const x of [420, 520, 620]) {
    await clickGame(ctx.page, ctx.canvas, x, 720 - 70)
    await ctx.page.waitForTimeout(500)
  }
  await ctx.shot('04-raised')
  await ctx.page.waitForTimeout(1000)
}

/** @param {DriveContext} ctx */
async function driveAutoEndPhase(ctx) {
  await ctx.page.waitForTimeout(1200)
  await ctx.shot('03-before-auto')
  await waitForGame(
    (game) => game.state.phase !== 'evening' || game.state.step !== 'discard',
    'auto endPhase leave evening/discard',
    10_000,
  )
  await ctx.page.waitForTimeout(800)
  await ctx.shot('04-after-auto')
}

/** @param {DriveContext} ctx */
async function driveAutoRemove(ctx) {
  await ctx.page.waitForTimeout(1200)
  await ctx.shot('03-battle')
  await waitForGame(
    (game) => {
      const pending = game.state.pending?.[0]
      return pending === undefined || pending.type !== 'battle'
    },
    'auto remove clears battle pending',
    10_000,
  )
  await ctx.page.waitForTimeout(800)
  await ctx.shot('04-after-remove')
}

/** @param {DriveContext} ctx */
async function driveZeroHit(ctx) {
  await ctx.page.waitForTimeout(1500)
  await ctx.shot('03-ambush-or-roll')
  // Empty ambush hand → UI auto-declines; imposed rng yields 0–0 → flash.
  await waitForGame(
    (game) => {
      const pending = game.state.pending?.[0]
      return pending === undefined || pending.type !== 'battle'
    },
    'battle clears after 0-0',
    12_000,
  )
  await ctx.page.waitForTimeout(2000)
  await ctx.shot('04-zero-hit-flash')
  await ctx.page.waitForTimeout(1200)
}

/** @param {DriveContext} ctx */
async function driveBattleHighlight(ctx) {
  await ctx.page.waitForTimeout(1500)
  const centers = clearingCenters()
  const point = centers[10]
  await clickGame(ctx.page, ctx.canvas, point.x, point.y)
  await ctx.page.waitForTimeout(800)
  await ctx.shot('03-highlighted')
  await ctx.page.waitForTimeout(1200)
}

/** @param {DriveContext} ctx */
async function driveCraftedCounts(ctx) {
  // Marquise cards / items button near left rail
  await clickGame(ctx.page, ctx.canvas, 160, 100)
  await ctx.page.waitForTimeout(1500)
  await ctx.shot('03-crafted')
  await ctx.page.waitForTimeout(1000)
}

/** @param {DriveContext} ctx */
async function driveMarchLock(ctx) {
  const actions = ctx.actionsBefore
  const actionTypes = actions
    .filter((action) => action.actor === 0)
    .map((action) => action.type)
  const marchIndex = actionTypes.indexOf('march')
  if (marchIndex < 0) {
    throw new Error('march missing')
  }
  const march = actions.find((action) => action.type === 'march')
  const firstMove = march?.params?.moves?.[0]
  if (firstMove === undefined) {
    throw new Error('march moves missing')
  }
  const centers = clearingCenters()
  const trayX = 1280 - 160
  const trayY = 56 + 28 + marchIndex * 34 + 10
  await clickGame(ctx.page, ctx.canvas, trayX, trayY)
  await ctx.page.waitForTimeout(900)
  await ctx.shot('03-march-staged')
  // Try clicking another tray action while staged — should be locked
  await clickGame(ctx.page, ctx.canvas, trayX, trayY - 34)
  await ctx.page.waitForTimeout(600)
  const from = centers[firstMove.from]
  const to = centers[firstMove.to]
  await clickGame(ctx.page, ctx.canvas, from.x, from.y)
  await ctx.page.waitForTimeout(500)
  await clickGame(ctx.page, ctx.canvas, to.x, to.y)
  await ctx.page.waitForTimeout(700)
  await ctx.shot('04-march-path')
  await ctx.page.waitForTimeout(800)
}

/**
 * @param {(game: { state: Record<string, unknown> }) => boolean} predicate
 * @param {string} label
 * @param {number} [timeoutMs]
 */
async function waitForGame(predicate, label, timeoutMs = 12_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const game = await fetchGame()
    if (predicate(game)) {
      return game
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`timeout waiting for ${label}`)
}

/**
 * @param {BugScenario} scenario
 */
async function recordScenario(scenario) {
  console.log(`\n=== ${scenario.id} ===`)
  await mkdir(artifactsDirectory, { recursive: true })
  const videoStagingDirectory = path.join(
    artifactsDirectory,
    `video-raw-${scenario.id}`,
  )
  await rm(videoStagingDirectory, { recursive: true, force: true })
  await mkdir(videoStagingDirectory, { recursive: true })

  await loadSnapshot(scenario.snapshotName)
  const actionsBefore = await fetchActions()
  console.log(
    'legal:',
    actionsBefore.map((action) => action.type).join(',') || '(none)',
  )

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoStagingDirectory,
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
  await page.goto(phaserUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('canvas', { timeout: 20_000 })
  await page.waitForTimeout(1200)
  const canvas = page.locator('canvas').first()

  const shot = async (suffix) => {
    await page.screenshot({
      path: path.join(artifactsDirectory, `${scenario.videoName}-${suffix}.png`),
    })
  }

  await shot('01-menu')
  await qaContinue(page, canvas)
  await shot('02-board')

  await scenario.drive({ page, canvas, actionsBefore, shot })

  await page.waitForTimeout(1200)
  await shot('99-end')

  let gameAfter
  try {
    gameAfter = await fetchGame()
  } catch (error) {
    // Winner "Back to menu" deletes the slot (404) — still a successful scenario.
    gameAfter = {
      state: {
        phase: 'n/a',
        step: 'n/a',
        status: 'deleted',
        currentSeat: null,
      },
    }
    console.log(`post-drive GET /game skipped: ${String(error)}`)
  }
  await context.close()
  await browser.close()

  const recordedFiles = (await readdir(videoStagingDirectory)).filter((name) =>
    name.endsWith('.webm'),
  )
  if (recordedFiles.length === 0) {
    throw new Error('no webm recorded')
  }
  const webmPath = path.join(artifactsDirectory, `${scenario.videoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${scenario.videoName}.mp4`)
  await copyFile(path.join(videoStagingDirectory, recordedFiles[0]), webmPath)

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

  const relevantConsoleErrors = consoleErrors.filter(
    (message) => !message.includes('404 (Not Found)'),
  )
  const summary = {
    id: scenario.id,
    ok: relevantConsoleErrors.length === 0,
    videoMp4: mp4Path,
    phaseAfter: `${gameAfter.state.phase}/${gameAfter.state.step}`,
    statusAfter: gameAfter.state.status,
    consoleErrors: relevantConsoleErrors,
  }
  console.log(JSON.stringify(summary, null, 2))
  return summary
}

async function main() {
  const filter = process.argv[2]
  const selected = filter
    ? SCENARIOS.filter(
        (scenario) =>
          scenario.id === filter ||
          scenario.id.startsWith(filter) ||
          scenario.videoName.includes(filter),
      )
    : SCENARIOS
  if (selected.length === 0) {
    console.error(
      `unknown scenario ${filter ?? ''}\nknown: ${SCENARIOS.map((scenario) => scenario.id).join(', ')}`,
    )
    process.exit(1)
  }

  /** @type {unknown[]} */
  const results = []
  for (const scenario of selected) {
    try {
      results.push(await recordScenario(scenario))
    } catch (error) {
      console.error(`FAIL ${scenario.id}`, error)
      results.push({
        id: scenario.id,
        ok: false,
        error: String(error),
      })
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(results, null, 2))
  const failed = results.filter((result) => result.ok !== true)
  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
