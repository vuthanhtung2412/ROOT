/**
 * Frontend QA videos for each BUG.md / PLAN.md fix.
 *
 * Each drive plays a full reviewable flow (setup → action → resolve → result),
 * not a mid-pending freeze-frame.
 *
 * Usage (web :3000 + React UI :5174 running):
 *   ROOT_REACT_URL=http://localhost:5174 node .agents/skills/QA/record-bug-scenarios.mjs
 *   ROOT_REACT_URL=http://localhost:5174 node .agents/skills/QA/record-bug-scenarios.mjs 03-field-hospital
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
const reactUiUrl = process.env.ROOT_REACT_URL ?? process.env.ROOT_PHASER_URL ?? 'http://localhost:5174'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'

const VIEW_WIDTH = 1280
const VIEW_HEIGHT = 720
const TRAY_X = VIEW_WIDTH - 160
const BANNER_CONFIRM_X = VIEW_WIDTH / 2 + 320 - 52
const BANNER_CONFIRM_Y = 28
const BANNER_OPTION_Y = 42
const HAND_Y = VIEW_HEIGHT - 70

/** Autumn map hit targets for 1280×720. */
function clearingCenters() {
  const boardWidth = VIEW_WIDTH * 0.74
  const boardHeight = VIEW_HEIGHT * 0.82
  const textureWidth = 3479
  const textureHeight = 3189
  const scale = Math.min(boardWidth / textureWidth, boardHeight / textureHeight)
  const displayWidth = textureWidth * scale
  const displayHeight = textureHeight * scale
  const originX = VIEW_WIDTH * 0.5 - displayWidth / 2
  const originY = VIEW_HEIGHT * 0.42 - displayHeight / 2
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
    drive: driveFieldHospital,
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
    drive: driveAmbushWindow,
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
    drive: driveBannerPrompt,
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
    drive: driveDecreeSuit,
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
    drive: driveEyrieCraft,
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
  const scaleX = box.width / VIEW_WIDTH
  const scaleY = box.height / VIEW_HEIGHT
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

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} canvas
 * @param {string} actionType
 * @param {(action: { type: string, params?: Record<string, unknown> }) => boolean} [match]
 */
async function clickTrayAction(page, canvas, actionType, match) {
  const actions = await fetchActions()
  const candidates = actions.filter((action) => action.type === actionType)
  const matchAction =
    match === undefined
      ? candidates[0]
      : candidates.find((action) => match(action))
  if (matchAction === undefined) {
    throw new Error(
      `tray action ${actionType} missing; got ${actions.map((action) => action.type).join(',')}`,
    )
  }
  const forActor = actions.filter((action) => action.actor === matchAction.actor)
  const index = forActor.findIndex((action) => action === matchAction)
  if (index < 0) {
    // fall back: first matching type for actor
    const byType = forActor.findIndex(
      (action) =>
        action.type === actionType &&
        (match === undefined || match(action)),
    )
    if (byType < 0) {
      throw new Error(`tray index missing for ${actionType}`)
    }
    const trayY = 56 + 28 + byType * 34 + 10
    await clickGame(page, canvas, TRAY_X, trayY)
    return
  }
  const trayY = 56 + 28 + index * 34 + 10
  await clickGame(page, canvas, TRAY_X, trayY)
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} canvas
 * @param {number} clearingId
 */
async function clickClearing(page, canvas, clearingId) {
  const point = clearingCenters()[clearingId]
  if (point === undefined) {
    throw new Error(`clearing ${String(clearingId)} missing layout`)
  }
  await clickGame(page, canvas, point.x, point.y)
}

/** Single-card hand center (or index among n cards). */
async function clickHandCard(page, canvas, index = 0, handSize = 1) {
  const startX = -((handSize - 1) * 44)
  const cardX = VIEW_WIDTH / 2 + startX + index * 88
  await clickGame(page, canvas, cardX, HAND_Y)
}

async function clickBannerConfirm(page, canvas) {
  await clickGame(page, canvas, BANNER_CONFIRM_X, BANNER_CONFIRM_Y)
}

async function clickBannerCenterOption(page, canvas) {
  await clickGame(page, canvas, VIEW_WIDTH / 2, BANNER_OPTION_Y)
}

async function qaContinue(page, canvas) {
  await clickGame(page, canvas, 640, VIEW_HEIGHT * 0.6)
  await page.waitForTimeout(2800)
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
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`timeout waiting for ${label}`)
}

/**
 * Battle often auto-resolves through ambush/removal before the next poll.
 * Soft-wait for battle pending, then wait for `done` (FH / finished / clear).
 * @param {(game: { state: Record<string, unknown> }) => boolean} done
 * @param {string} label
 * @param {import('playwright').Page} [page]
 * @param {(suffix: string) => Promise<void>} [shot]
 * @param {string} [combatShotSuffix]
 */
async function waitThroughBattle(done, label, page, shot, combatShotSuffix) {
  const softDeadline = Date.now() + 2_500
  while (Date.now() < softDeadline) {
    const game = await fetchGame()
    if (done(game)) {
      return game
    }
    if (game.state.pending?.[0]?.type === 'battle') {
      if (page !== undefined && shot !== undefined && combatShotSuffix !== undefined) {
        await page.waitForTimeout(900)
        await shot(combatShotSuffix)
      }
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  return waitForGame(done, label, 18_000)
}

function roostCountAt(game, clearingId, owner) {
  const clearing = game.state.clearings?.[clearingId]
  if (clearing === undefined) return 0
  return clearing.pieces.filter(
    (piece) =>
      piece.kind === 'building' &&
      piece.type === 'roost' &&
      piece.owner === owner,
  ).length
}

function warriorCountAt(game, clearingId, owner) {
  const clearing = game.state.clearings?.[clearingId]
  if (clearing === undefined) return 0
  return clearing.pieces.filter(
    (piece) => piece.kind === 'warrior' && piece.owner === owner,
  ).length
}

/** @param {DriveContext} ctx */
async function drivePanBoard(ctx) {
  for (const clearingId of [0, 4, 9, 11, 2]) {
    await clickClearing(ctx.page, ctx.canvas, clearingId)
    await ctx.page.waitForTimeout(500)
  }
  await ctx.shot('03-board')
  await ctx.page.waitForTimeout(800)
}

/** @param {DriveContext} ctx */
async function driveDefenselessBattle(ctx) {
  await clickTrayAction(ctx.page, ctx.canvas, 'battle')
  await ctx.page.waitForTimeout(900)
  await ctx.shot('03-battle-tray')
  await clickClearing(ctx.page, ctx.canvas, 4)
  await waitThroughBattle(
    (game) =>
      game.state.pending?.[0] === undefined &&
      roostCountAt(game, 4, 1) === 0,
    'roost removed after defenseless battle',
    ctx.page,
    ctx.shot,
    '04-combat',
  )
  await ctx.page.waitForTimeout(1000)
  await ctx.shot('05-roost-gone')
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
  await ctx.page.waitForTimeout(1200)
  await ctx.shot('03-before-win')
  await clickTrayAction(ctx.page, ctx.canvas, 'battle')
  await ctx.page.waitForTimeout(700)
  await clickClearing(ctx.page, ctx.canvas, 4)
  await waitForGame(
    (game) => game.state.status === 'finished' && game.state.winner === 0,
    'marquise wins at 30 VP',
    15_000,
  )
  await ctx.page.waitForTimeout(1800)
  await ctx.shot('04-winner-overlay')
  await clickGame(ctx.page, ctx.canvas, 640, 360 + 36)
  await ctx.page.waitForTimeout(2000)
  await ctx.shot('05-menu')
}

/** Field Hospital: battle → dice → damage → FH → pay → warriors at keep. */
/** @param {DriveContext} ctx */
async function driveFieldHospital(ctx) {
  const keepBefore = warriorCountAt(await fetchGame(), 0, 0)
  await clickTrayAction(ctx.page, ctx.canvas, 'battle')
  await ctx.page.waitForTimeout(800)
  await ctx.shot('03-battle-tray')
  await clickClearing(ctx.page, ctx.canvas, 4)
  // Catch dice overlay even if removal auto-resolves quickly.
  await ctx.page.waitForTimeout(500)
  await ctx.shot('04-combat-dice')
  await waitForGame(
    (game) => game.state.pending?.[0]?.type === 'fieldHospital',
    'field hospital after damage',
    18_000,
  )
  await ctx.page.waitForTimeout(1200)
  await ctx.shot('05-field-hospital-prompt')
  // Tray "Field Hospitals: pay" auto-picks the sole matching card.
  await clickTrayAction(
    ctx.page,
    ctx.canvas,
    'resolveEvent',
    (action) => Array.isArray(action.params?.cardIds),
  )
  await waitForGame(
    (game) => game.state.pending?.[0] === undefined,
    'field hospital resolved',
    10_000,
  )
  const gameAfter = await fetchGame()
  const keepAfter = warriorCountAt(gameAfter, 0, 0)
  if (keepAfter < keepBefore + 2) {
    throw new Error(
      `expected +2 warriors at keep C0 (before=${String(keepBefore)} after=${String(keepAfter)})`,
    )
  }
  await clickClearing(ctx.page, ctx.canvas, 0)
  await ctx.page.waitForTimeout(1200)
  await ctx.shot('06-warriors-at-keep')
}

/** @param {DriveContext} ctx */
async function driveDrawerNoUndo(ctx) {
  await ctx.page.waitForTimeout(1000)
  await clickGame(ctx.page, ctx.canvas, 40, VIEW_HEIGHT - 80)
  await ctx.page.waitForTimeout(300)
  await clickGame(ctx.page, ctx.canvas, VIEW_WIDTH - 50, VIEW_HEIGHT - 80)
  await ctx.page.waitForTimeout(400)
  await ctx.shot('03-drawer')
  await ctx.page.waitForTimeout(1200)
}

/** @param {DriveContext} ctx */
async function driveDiscardPile(ctx) {
  await clickGame(ctx.page, ctx.canvas, VIEW_WIDTH - 50, VIEW_HEIGHT - 80)
  await ctx.page.waitForTimeout(1500)
  await ctx.shot('03-discard-modal')
  await ctx.page.waitForTimeout(1200)
}

/** @param {DriveContext} ctx */
async function driveDiscardRaise(ctx) {
  await clickTrayAction(ctx.page, ctx.canvas, 'discard')
  await ctx.page.waitForTimeout(900)
  await ctx.shot('03-discard-prompt')
  // Hand of 7 — raise two cards then confirm.
  await clickHandCard(ctx.page, ctx.canvas, 0, 7)
  await ctx.page.waitForTimeout(400)
  await clickHandCard(ctx.page, ctx.canvas, 1, 7)
  await ctx.page.waitForTimeout(500)
  await ctx.shot('04-raised')
  await clickBannerConfirm(ctx.page, ctx.canvas)
  await waitForGame(
    (game) => (game.state.players?.[0]?.hand?.length ?? 99) <= 5,
    'hand at limit after discard',
    10_000,
  )
  await ctx.page.waitForTimeout(800)
  await ctx.shot('05-after-discard')
}

/** @param {DriveContext} ctx */
async function driveAmbushWindow(ctx) {
  await clickTrayAction(ctx.page, ctx.canvas, 'battle')
  await ctx.page.waitForTimeout(700)
  await clickClearing(ctx.page, ctx.canvas, 0)
  await waitForGame(
    (game) =>
      game.state.pending?.[0]?.type === 'battle' &&
      game.state.pending?.[0]?.stage === 'ambush',
    'ambush stage',
    10_000,
  )
  await ctx.page.waitForTimeout(1500)
  await ctx.shot('03-ambush-prompt')
  // Play fox Ambush (Eyrie hand, single card — QA viewer follows actor).
  await clickHandCard(ctx.page, ctx.canvas, 0, 1)
  await waitThroughBattle(
    (game) => game.state.pending?.[0] === undefined,
    'battle fully clear after ambush',
    ctx.page,
    ctx.shot,
    '04-after-ambush-hits',
  )
  await ctx.page.waitForTimeout(800)
  await ctx.shot('05-battle-done')
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
  await clickTrayAction(ctx.page, ctx.canvas, 'battle')
  await ctx.page.waitForTimeout(700)
  await clickClearing(ctx.page, ctx.canvas, 4)
  await waitThroughBattle(
    (game) =>
      game.state.pending?.[0] === undefined &&
      warriorCountAt(game, 4, 1) === 0,
    'auto remove clears battle',
    ctx.page,
    ctx.shot,
    '03-combat',
  )
  await ctx.page.waitForTimeout(800)
  await ctx.shot('04-after-remove')
}

/** @param {DriveContext} ctx */
async function driveZeroHit(ctx) {
  await clickTrayAction(ctx.page, ctx.canvas, 'battle')
  await ctx.page.waitForTimeout(700)
  await clickClearing(ctx.page, ctx.canvas, 9)
  await waitThroughBattle(
    (game) => game.state.pending?.[0] === undefined,
    'battle clears after 0-0',
    ctx.page,
    ctx.shot,
    '03-combat',
  )
  await ctx.page.waitForTimeout(2000)
  await ctx.shot('04-zero-hit-flash')
  await ctx.page.waitForTimeout(1200)
}

/** @param {DriveContext} ctx */
async function driveBattleHighlight(ctx) {
  await clickTrayAction(ctx.page, ctx.canvas, 'battle')
  await ctx.page.waitForTimeout(700)
  await ctx.shot('03-targets')
  await clickClearing(ctx.page, ctx.canvas, 10)
  await waitThroughBattle(
    (game) => game.state.pending?.[0] === undefined,
    'battle finishes',
    ctx.page,
    ctx.shot,
    '04-highlighted',
  )
  await ctx.page.waitForTimeout(600)
  await ctx.shot('05-done')
}

/** @param {DriveContext} ctx */
async function driveBannerPrompt(ctx) {
  await clickTrayAction(ctx.page, ctx.canvas, 'battle')
  await ctx.page.waitForTimeout(600)
  await clickClearing(ctx.page, ctx.canvas, 4)
  await waitThroughBattle(
    (game) => game.state.pending?.[0]?.type === 'fieldHospital',
    'field hospital banner',
    ctx.page,
    ctx.shot,
    '03-battle-banner',
  )
  await ctx.page.waitForTimeout(1200)
  await ctx.shot('04-fh-banner')
  await clickTrayAction(
    ctx.page,
    ctx.canvas,
    'resolveEvent',
    (action) => Array.isArray(action.params?.cardIds),
  )
  await waitForGame(
    (game) => game.state.pending?.[0] === undefined,
    'banner flow done',
    10_000,
  )
  await ctx.page.waitForTimeout(800)
  await ctx.shot('05-after')
}

/** Crafted *items* on faction board (grouped counts) — not crafted-cards modal. */
/** @param {DriveContext} ctx */
async function driveCraftedCounts(ctx) {
  // Player rail seat row (opens FactionBoardModal). Avoid "cards" button (bottom-right of row).
  await clickGame(ctx.page, ctx.canvas, 12 + 50, 56 + 28)
  await ctx.page.waitForTimeout(1500)
  await ctx.shot('03-faction-board-items')
  await ctx.page.waitForTimeout(1200)
}

/** @param {DriveContext} ctx */
async function driveMarchLock(ctx) {
  const actions = await fetchActions()
  const march = actions.find((action) => action.type === 'march')
  const firstMove = march?.params?.moves?.[0]
  if (firstMove === undefined) {
    throw new Error('march moves missing')
  }
  await clickTrayAction(ctx.page, ctx.canvas, 'march')
  await ctx.page.waitForTimeout(900)
  await ctx.shot('03-march-staged')
  // Try clicking another tray action while staged — should stay locked on march.
  await clickGame(ctx.page, ctx.canvas, TRAY_X, 56 + 28 + 10)
  await ctx.page.waitForTimeout(500)
  await clickClearing(ctx.page, ctx.canvas, firstMove.from)
  await ctx.page.waitForTimeout(500)
  await clickClearing(ctx.page, ctx.canvas, firstMove.to)
  await ctx.page.waitForTimeout(700)
  await ctx.shot('04-march-path')
  // Count stepper OK if shown
  await clickBannerConfirm(ctx.page, ctx.canvas)
  await ctx.page.waitForTimeout(800)
  await ctx.shot('05-after-first-move')
}

/** @param {DriveContext} ctx */
async function driveDecreeSuit(ctx) {
  await ctx.page.waitForTimeout(1000)
  await ctx.shot('03-decree-suit-tray')
  await clickTrayAction(ctx.page, ctx.canvas, 'decree')
  await ctx.page.waitForTimeout(900)
  await clickClearing(ctx.page, ctx.canvas, 0)
  await waitThroughBattle(
    (game) => game.state.pending?.[0] === undefined,
    'decree battle done',
    ctx.page,
    ctx.shot,
    '04-decree-battle',
  )
  await ctx.page.waitForTimeout(800)
  await ctx.shot('05-after')
}

/** @param {DriveContext} ctx */
async function driveEyrieCraft(ctx) {
  await ctx.page.waitForTimeout(1000)
  await ctx.shot('03-craft-ready')
  await clickTrayAction(ctx.page, ctx.canvas, 'craft')
  await ctx.page.waitForTimeout(800)
  await clickHandCard(ctx.page, ctx.canvas, 0, 1)
  await waitForGame(
    (game) => (game.state.players?.[1]?.craftedItems?.length ?? 0) >= 1,
    'eyrie crafted item',
    10_000,
  )
  await ctx.page.waitForTimeout(1000)
  await ctx.shot('04-after-craft')
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
    viewport: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
    recordVideo: {
      dir: videoStagingDirectory,
      size: { width: VIEW_WIDTH, height: VIEW_HEIGHT },
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
    (message) =>
      !message.includes('404 (Not Found)') &&
      !message.includes('400 (Bad Request)'),
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
