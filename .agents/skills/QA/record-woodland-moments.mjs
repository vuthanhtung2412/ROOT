/**
 * Video demo of the woodland moments, played in real games: Vagabond
 * explore, Alliance revolt, Eyrie turmoil and the leader pick after it.
 * One video under tmp/artifacts/woodland-moments-demo.{webm,mp4}.
 *
 * Usage (web API + React dev server running):
 *   ROOT_REACT_URL=http://localhost:5173 ROOT_DEV_API=http://localhost:3000 \
 *     node .agents/skills/QA/record-woodland-moments.mjs [explore|revolt|turmoil]
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts')
const snapshotsDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const VIDEO_NAME = 'woodland-moments-demo'
/**
 * Headless Chromium draws WebGL in software (SwiftShader, ~2 fps on the 3D
 * map): use the real GPU through Metal so the video is smooth.
 */
const GPU_ARGUMENTS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
const VIDEO_FRAMES_PER_SECOND = 24

/** Explore: the Vagabond stands on a ruin with a torch, in Daylight. */
const EXPLORE_SNAPSHOT = 'vagabond-daylight-explore.json'
/** Revolt: Cat warriors, wood and the Vagabond in sympathetic fox clearing 7. */
const REVOLT_SNAPSHOT = 'wa-vb-qa-run.json'
const REVOLT_CLEARING = 'Clearing 7'
/** Turmoil: made from the decree snapshot, see `writeTurmoilSnapshot`. */
const TURMOIL_SOURCE_SNAPSHOT = 'eyrie-decree-auto.json'
const TURMOIL_SNAPSHOT = 'eyrie-turmoil.json'
const PICKED_LEADER = /Builder/
/** Long enough for a moment to play out (the longest is ~5 s). */
const MOMENT_WATCH_MS = 6000

/**
 * The Eyrie at the start of their decree with no roost left on the map:
 * Recruit cannot be carried out, so Turmoil is their only action.
 * Commander already lies face down, so the pick deals a deposed card.
 */
async function writeTurmoilSnapshot() {
  const snapshot = JSON.parse(
    await readFile(path.join(snapshotsDirectory, TURMOIL_SOURCE_SNAPSHOT), 'utf8'),
  )
  const state = snapshot.state
  const eyrie = state.players.find((player) => player.faction === 'eyrie')
  let removedRoosts = 0
  state.clearings = state.clearings.map((clearing) => ({
    ...clearing,
    pieces: clearing.pieces.filter((piece) => {
      const isRoost = piece.owner === eyrie.seat && piece.type === 'roost'
      if (isRoost) removedRoosts += 1
      return !isRoost
    }),
  }))
  eyrie.vp = 6
  eyrie.board.roostTrack.placed += removedRoosts
  eyrie.board.leader = 'charismatic'
  eyrie.board.leadersFaceUp = ['builder', 'despot']
  eyrie.board.leadersFaceDown = ['commander']
  state.currentSeat = eyrie.seat
  state.phase = 'daylight'
  state.step = 'decree'
  state.turnScratch.decree = null
  state.turnScratch.decreeDone = false
  state.pending = []
  await writeFile(
    path.join(snapshotsDirectory, TURMOIL_SNAPSHOT),
    JSON.stringify(snapshot),
  )
}

function loadSnapshot(snapshotName) {
  const load = spawnSync(
    'pnpm',
    ['--filter', '@root/cli', 'start', '--', 'load', path.join(snapshotsDirectory, snapshotName)],
    { cwd: rootDirectory, env: { ...process.env, ROOT_DEV_API: apiUrl }, encoding: 'utf8' },
  )
  if (load.status !== 0) {
    throw new Error(`cli load failed:\n${load.stdout}\n${load.stderr}`)
  }
}

/** @param {import('playwright').Page} page */
async function enterGame(page, snapshotName) {
  loadSnapshot(snapshotName)
  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  // A reload after the first game resumes it straight from the server slot,
  // which already holds the snapshot just loaded: no menu then.
  const continueButton = page.getByRole('button', { name: 'QA: Continue loaded game' })
  const onMenu = await continueButton
    .waitFor({ timeout: 6000 })
    .then(() => true)
    .catch(() => false)
  if (onMenu) {
    await continueButton.click()
  }
  await page.waitForTimeout(2500)
}

/** @param {import('playwright').Page} page */
async function clickTrayAction(page, label) {
  const button = page
    .locator('button.action-tray__action')
    .filter({ hasText: new RegExp(label, 'i') })
  await button.first().waitFor({ timeout: 10_000 })
  await button.first().click()
}

/** @param {import('playwright').Page} page */
async function playExplore(page) {
  await enterGame(page, EXPLORE_SNAPSHOT)
  await clickTrayAction(page, 'explore')
  await page.waitForTimeout(MOMENT_WATCH_MS)
}

/** @param {import('playwright').Page} page */
async function playRevolt(page) {
  await enterGame(page, REVOLT_SNAPSHOT)
  await clickTrayAction(page, 'revolt')
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: REVOLT_CLEARING, exact: true }).click()
  await page.waitForTimeout(700)
  // The first ROOT-202 button is the hand card; the next two are supporters.
  const supporters = page.getByRole('button', { name: 'ROOT-202', exact: true })
  await supporters.nth(1).click()
  await page.waitForTimeout(400)
  await supporters.nth(2).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'OK', exact: true }).click()
  await page.waitForTimeout(MOMENT_WATCH_MS)
}

/** @param {import('playwright').Page} page */
async function playTurmoilAndLeaderPick(page) {
  await writeTurmoilSnapshot()
  await enterGame(page, TURMOIL_SNAPSHOT)
  await clickTrayAction(page, 'turmoil')
  await page.waitForTimeout(MOMENT_WATCH_MS)
  await clickTrayAction(page, 'choose leader')
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: PICKED_LEADER }).first().click()
  await page.waitForTimeout(MOMENT_WATCH_MS)
}

/** Scenes of the demo, in play order; one may be named on the command line. */
const MOMENT_SCENES = {
  explore: playExplore,
  revolt: playRevolt,
  turmoil: playTurmoilAndLeaderPick,
}
const onlyMoment = process.argv[2]

async function main() {
  if (onlyMoment !== undefined && !(onlyMoment in MOMENT_SCENES)) {
    throw new Error(`unknown scene ${onlyMoment}: ${Object.keys(MOMENT_SCENES).join('|')}`)
  }
  const staging = path.join(artifactsDirectory, `video-raw-${VIDEO_NAME}`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: GPU_ARGUMENTS })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: staging, size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await installAutonomousClickHighlight(page)
  try {
    for (const [name, play] of Object.entries(MOMENT_SCENES)) {
      if (onlyMoment === undefined || onlyMoment === name) {
        await play(page)
      }
    }
  } finally {
    await context.close()
    await browser.close()
  }
  const recorded = (await readdir(staging)).filter((name) => name.endsWith('.webm'))
  if (recorded.length === 0) throw new Error('no webm recorded')
  const videoName = await pickUnusedVideoName(
    artifactsDirectory,
    onlyMoment === undefined ? VIDEO_NAME : `${VIDEO_NAME}-${onlyMoment}`,
  )
  const webmPath = path.join(artifactsDirectory, `${videoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${videoName}.mp4`)
  await copyFile(path.join(staging, recorded[0]), webmPath)
  spawnSync('ffmpeg', ['-i', webmPath, '-vf', `fps=${String(VIDEO_FRAMES_PER_SECOND)}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path])
  console.log(JSON.stringify({ video: mp4Path, pageErrors: errors.slice(0, 6) }, null, 2))
}

await main()
