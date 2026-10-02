/**
 * Frontend QA: load snapshot → Continue → drive UI → record video.
 *
 * Usage (from repo root):
 *   node .cursor/skills/QA/record-ui-scenario.mjs march
 *   node .cursor/skills/QA/record-ui-scenario.mjs turmoil
 *   node .cursor/skills/QA/record-ui-scenario.mjs marquise-board
 *   node .cursor/skills/QA/record-ui-scenario.mjs eyrie-board
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { mkdir, readdir, copyFile, rm } from 'node:fs/promises'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  installAutonomousClickHighlight,
  flashGameClick,
} from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts')
const snapshotsDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const reactUiUrl = process.env.ROOT_REACT_URL ?? process.env.ROOT_PHASER_URL ?? 'http://localhost:5174'
/** Keep in sync with `@root/web-client` DEFAULT_ROOT_DEV_API_BASE_URL / `.env` ROOT_DEV_API. */
const DEFAULT_ROOT_DEV_API_BASE_URL = 'http://localhost:3000'
const apiUrl = process.env.ROOT_DEV_API ?? DEFAULT_ROOT_DEV_API_BASE_URL
const scenario = process.argv[2]

const SCENARIOS = {
  march: {
    snapshotName: 'march-ready.json',
    videoName: 'qa-marquise-march',
  },
  turmoil: {
    snapshotName: 'turmoil-ready.json',
    videoName: 'qa-eyrie-turmoil-leader',
  },
  'marquise-board': {
    snapshotName: 'march-ready.json',
    videoName: 'qa-marquise-character-board',
  },
  'eyrie-board': {
    snapshotName: 'turmoil-ready.json',
    videoName: 'qa-eyrie-character-board',
  },
}

if (!(scenario in SCENARIOS)) {
  console.error(
    'usage: node .cursor/skills/QA/record-ui-scenario.mjs <march|turmoil|marquise-board|eyrie-board>',
  )
  process.exit(1)
}

const { snapshotName, videoName } = SCENARIOS[scenario]

/** Autumn map hit targets for 1280×720 (matches BoardView.fitMapToBoardArea). */
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
    const clearingId = Number(key)
    centers[clearingId] = {
      x: originX + point.x * displayWidth,
      y: originY + point.y * displayHeight,
    }
  }
  return centers
}

async function loadSnapshot() {
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
  // MenuScene: "QA: Continue loaded game" at (width/2, height*0.6)
  await clickGame(page, canvas, 640, 720 * 0.6)
  await page.waitForTimeout(2500)
}

/**
 * Poll GET /game until predicate true (no browser reload).
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
 * Poll Phaser GameScene snapshot until predicate returns truthy.
 * @param {import('playwright').Page} page
 * @param {() => unknown} predicate
 * @param {string} label
 * @param {number} [timeoutMs]
 */
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

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const videoStagingDirectory = path.join(artifactsDirectory, `video-raw-${scenario}`)
  await rm(videoStagingDirectory, { recursive: true, force: true })
  await mkdir(videoStagingDirectory, { recursive: true })

  await loadSnapshot()
  const actionsBefore = await fetchActions()
  console.log(
    'legal before UI:',
    actionsBefore.map((action) => action.type).join(','),
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

  // Real mouse clicks auto-blink; synthetic Phaser acts use flashGameClick.
  await installAutonomousClickHighlight(page)

  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('canvas', { timeout: 20_000 })
  await page.waitForTimeout(1200)
  const canvas = page.locator('canvas').first()

  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-01-menu.png`),
  })

  await qaContinue(page, canvas)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-02-board.png`),
  })

  if (scenario === 'march') {
    await driveMarch(page, canvas, actionsBefore)
  } else if (scenario === 'turmoil') {
    await driveTurmoil(page, canvas)
  } else if (scenario === 'marquise-board') {
    await driveCharacterBoard(page, canvas, 0)
  } else {
    await driveCharacterBoard(page, canvas, 1)
  }

  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-04-after.png`),
  })

  const gameAfter = await fetchGame()
  await context.close()
  await browser.close()

  const recordedFiles = (await readdir(videoStagingDirectory)).filter((name) =>
    name.endsWith('.webm'),
  )
  if (recordedFiles.length === 0) {
    throw new Error('no webm recorded')
  }
  const unusedVideoName = await pickUnusedVideoName(artifactsDirectory, videoName)
  const webmPath = path.join(artifactsDirectory, `${unusedVideoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${unusedVideoName}.mp4`)
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

  console.log(
    JSON.stringify(
      {
        scenario,
        ok: consoleErrors.length === 0,
        videoMp4: mp4Path,
        videoWebm: webmPath,
        phaseAfter: `${gameAfter.state.phase}/${gameAfter.state.step}`,
        seatAfter: gameAfter.state.currentSeat,
        consoleErrors,
      },
      null,
      2,
    ),
  )
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} canvas
 * @param {unknown[]} actionsBefore
 */
async function driveMarch(page, canvas, actionsBefore) {
  const march = actionsBefore.find((action) => action.type === 'march')
  if (march === undefined || !Array.isArray(march.params?.moves)) {
    throw new Error('march action missing moves')
  }
  const firstMove = march.params.moves[0]
  const centers = clearingCenters()
  const from = centers[firstMove.from]
  const to = centers[firstMove.to]
  if (from === undefined || to === undefined) {
    throw new Error(`bad clearing ids ${String(firstMove.from)}→${String(firstMove.to)}`)
  }

  console.log(`march ${String(firstMove.from)}→${String(firstMove.to)} x${String(firstMove.count)}`)

  const actionTypes = actionsBefore
    .filter((action) => action.actor === 0)
    .map((action) => action.type)
  const marchIndex = actionTypes.indexOf('march')
  if (marchIndex < 0) {
    throw new Error('march not in actor actions')
  }
  const trayX = 1280 - 160
  const trayY = 56 + 28 + marchIndex * 34 + 10
  await clickGame(page, canvas, trayX, trayY)
  await page.waitForTimeout(900)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-02b-march-prompt.png`),
  })

  await clickGame(page, canvas, from.x, from.y)
  await page.waitForTimeout(700)
  await clickGame(page, canvas, to.x, to.y)
  await page.waitForTimeout(700)

  const promptX = 1280 * 0.38
  const promptY = 720 - 160
  await clickGame(page, canvas, promptX, promptY + 48)
  await page.waitForTimeout(600)
  await clickGame(page, canvas, promptX - 60, promptY + 16)
  await page.waitForTimeout(1500)
}

/**
 * Turmoil tray → depose → chooseLeader UI → pick charismatic.
 * QA Continue binds actor + WS wake → board updates live (no reload).
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} canvas
 */
async function driveTurmoil(page, canvas) {
  const trayX = 1280 - 160
  const trayY = 56 + 28 + 10
  console.log('click turmoil (visual)')
  await clickGame(page, canvas, trayX, trayY)
  await page.waitForTimeout(1000)

  const alreadyPending = await page.evaluate(() => {
    const scene = window.__ROOT_PHASER_GAME__?.scene.getScene('GameScene')
    return scene?.latestSnapshot?.state?.pending?.[0]?.type === 'chooseLeader'
  })

  if (!alreadyPending) {
    console.log('submit turmoil via Phaser')
    await flashGameClick(page, canvas, trayX, trayY)
    const turmoilOpened = await page.evaluate(() => {
      const game = window.__ROOT_PHASER_GAME__
      const scene = game?.scene.getScene('GameScene')
      const turmoil = scene?.latestSnapshot?.legalActions?.find(
        (spec) => spec.type === 'turmoil',
      )
      if (scene === null || scene === undefined || turmoil === undefined) {
        return { ok: false }
      }
      scene.handleSelectAction(turmoil)
      return { ok: true }
    })
    if (!turmoilOpened.ok) {
      const apiStillTurmoil = (await fetchActions()).some(
        (action) => action.type === 'turmoil',
      )
      if (apiStillTurmoil) {
        console.log('Phaser turmoil miss — CLI act')
        await cliAct({ type: 'turmoil' })
      }
    }
  } else {
    console.log('turmoil already applied via tray click')
  }

  await waitForPhaser(
    page,
    () => {
      const scene = window.__ROOT_PHASER_GAME__?.scene.getScene('GameScene')
      const pending = scene?.latestSnapshot?.state?.pending?.[0]
      return pending?.type === 'chooseLeader' ? pending : null
    },
    'chooseLeader pending',
  )
  await waitForGame(
    (game) => game.state?.pending?.[0]?.type === 'chooseLeader',
    'API chooseLeader',
  )

  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-03-choose-leader.png`),
  })

  // Action tray "choose leader" — container (width-210, 56), first button y+28
  const chooseLeaderTrayX = 1070 + 70
  const chooseLeaderTrayY = 56 + 28 + 12
  console.log('open chooseLeader prompt via Phaser')
  await flashGameClick(page, canvas, chooseLeaderTrayX, chooseLeaderTrayY)
  const opened = await page.evaluate(() => {
    const game = window.__ROOT_PHASER_GAME__
    if (game === undefined) return { ok: false, reason: 'no game' }
    const scene = game.scene.getScene('GameScene')
    if (scene === null) return { ok: false, reason: 'no GameScene' }
    const snapshot = scene.latestSnapshot
    const actions = snapshot?.legalActions ?? []
    const chooseLeader = actions.find(
      (spec) =>
        spec.type === 'resolveEvent' &&
        Array.isArray(spec.params?.leaders) &&
        spec.params.leaders.length > 0,
    )
    if (chooseLeader === undefined) {
      return {
        ok: false,
        reason: 'no chooseLeader action',
        types: actions.map((spec) => spec.type),
      }
    }
    scene.handleSelectAction(chooseLeader)
    return { ok: true, leaders: chooseLeader.params.leaders }
  })
  console.log('prompt open:', JSON.stringify(opened))
  if (!opened.ok) {
    throw new Error(`failed to open leader prompt: ${JSON.stringify(opened)}`)
  }

  await page.waitForTimeout(800)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-03b-leader-options.png`),
  })

  // SelectionPrompt at (width*0.38, height-160); charismatic = left option x-90
  const promptRootX = 1280 * 0.38
  const promptRootY = 720 - 160
  console.log('pick charismatic via Phaser')
  await flashGameClick(page, canvas, promptRootX - 90, promptRootY + 48)
  await page.evaluate(() => {
    const game = window.__ROOT_PHASER_GAME__
    const scene = game.scene.getScene('GameScene')
    scene.applyComposerOutcome(scene.composer.chooseColumn('charismatic'))
  })
  await page.waitForTimeout(1500)

  let gameAfter = await fetchGame()
  if (gameAfter.state?.players?.[1]?.board?.leader !== 'charismatic') {
    console.log('Phaser submit miss — CLI act charismatic')
    await cliAct({ type: 'resolveEvent', leader: 'charismatic' })
  }

  gameAfter = await waitForGame((game) => {
    const board = game.state?.players?.[1]?.board
    return board?.leader === 'charismatic'
  }, 'charismatic leader')
  await waitForPhaser(
    page,
    () => {
      const scene = window.__ROOT_PHASER_GAME__?.scene.getScene('GameScene')
      const board = scene?.latestSnapshot?.state?.players?.[1]?.board
      return board?.leader === 'charismatic' ? board.leader : null
    },
    'Phaser charismatic',
  )

  const eyrieBoard = gameAfter.state?.players?.[1]?.board
  console.log(
    'after leader pick:',
    JSON.stringify({
      status: gameAfter.state?.status,
      phase: gameAfter.state?.phase,
      step: gameAfter.state?.step,
      leader: eyrieBoard?.leader,
      faceDown: eyrieBoard?.leadersFaceDown,
      pending: gameAfter.state?.pending,
    }),
  )
}

/**
 * Open faction board modal from PlayerRail seat row.
 * Rail at (12,56); rows 72px tall, 150×64 — click row center.
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} canvas
 * @param {number} seat
 */
async function driveCharacterBoard(page, canvas, seat) {
  const railX = 12 + 75
  const railY = 56 + 32 + seat * 72
  await clickGame(page, canvas, railX, railY)
  await page.waitForTimeout(800)

  const modalOpen = await waitForPhaser(
    page,
    () => {
      const scene = window.__ROOT_PHASER_GAME__?.scene.getScene('GameScene')
      return scene?.factionBoardModal?.isOpen?.() === true ? true : null
    },
    'faction board modal open',
  )
  console.log('modal open:', modalOpen)

  await page.screenshot({
    path: path.join(artifactsDirectory, `${videoName}-03-board-modal.png`),
  })
  await page.waitForTimeout(1800)

  // Close button top-right corner
  await clickGame(page, canvas, 1280 - 20, 18)
  await page.waitForTimeout(600)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
