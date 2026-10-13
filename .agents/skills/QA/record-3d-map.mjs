/**
 * Demo of the 3D map → video under tmp/artifacts, with a screenshot of every
 * look in `<video name>-shots/`.
 *
 * Three games, each loaded into the API in turn:
 *  1. Marquise daylight (buildings board): flat map ↔ 3D map, zoom until the
 *     models rise, recruits walking up, a march on footsteps that walks in
 *     behind the warriors already there, a building rising from its dust,
 *     the evening light with the campfires.
 *  2. Vagabond daylight (crowded four-faction board): the fullest clearing,
 *     the keep, then the evening with the torch of the pawn.
 *  3. Vagabond birdsong: the dawn light, the aura marks of a slip.
 *
 * Usage (spare web backend + react dev server, ROOT_GAME_STORE_FILE=off):
 *   cd lib && pnpm exec tsx ../.agents/skills/QA/make-3d-map-buildings-snapshot.ts
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
/** Marquise daylight, three actions: recruit, march, build. */
const BUILDINGS_SNAPSHOT_PATH = 'tmp/qa/snapshots/3d-map-buildings.json'
/** Four factions, Vagabond's daylight, three clearings packed full. */
const CROWDED_SNAPSHOT_PATH = 'tmp/qa/snapshots/3d-map-crowded.json'
/** Vagabond's birdsong: the dawn light, a slip to pick. */
const BIRDSONG_SNAPSHOT_PATH = 'tmp/qa/snapshots/vagabond-birdsong-slip.json'
const VIDEO_NAME = 'demo-3d-map'
const VIEWPORT = { width: 1440, height: 900 }
const DRAG_STEP_PAUSE_MS = 16
/** The clearings of the 3D map show up once its scene is loaded. */
const MAP_3D_READY_SELECTOR = '.map-3d-canvas ~ [data-clearing-id]'
const FOOTSTEP_SELECTOR = '.board-effects svg.overflow-visible'
/** The dock and its tabs: everything the fold takes off the map. */
const DOCK_SELECTOR = '.action-dock'
const DOCK_FOLD_SELECTOR = '.action-tray__collapse'
const CLEARING_COUNT = 12
/** Points probed around a clearing for something drawn over it. */
const RIM_POINT_COUNT = 8
const MARQUISE_SEAT = 0
const VAGABOND_SEAT = 3
/** The keep of the buildings board: three Marquise warriors leave from here. */
const MARCH_ORIGIN_CLEARING_ID = 0
/** Two recruiters and two Marquise warriors: recruits and marchers join them. */
const MARCH_DESTINATION_CLEARING_ID = 4
const MARCH_WARRIOR_COUNT = 3
/** The fullest clearing of the crowded board: three slots, three armies, the pawn. */
const CROWDED_CLEARING_ID = 10
/** The keep of the crowded board, up in the corner. */
const KEEP_CLEARING_ID = 0
const LOOK_MS = 2200
const WALK_MS = 4200

/** What went wrong on the page or against the server, listed at the end. */
const problems = []

function report(problem) {
  problems.push(problem)
  console.error(`PROBLEM: ${problem}`)
}

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
 * @param {{ x: number, y: number }} point the zoom goes towards it
 * @param {number} totalDelta negative zooms in
 */
async function slowZoom(page, point, totalDelta) {
  const steps = 40
  await page.mouse.move(point.x, point.y)
  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, totalDelta / steps)
    await page.waitForTimeout(45)
  }
  await page.waitForTimeout(900)
}

/**
 * @param {import('playwright').Page} page
 * @param {string} label
 */
async function caption(page, label) {
  console.log(`— ${label}`)
  await page.evaluate((text) => {
    const existing = document.getElementById('qa-demo-caption')
    const element = existing ?? document.createElement('div')
    element.id = 'qa-demo-caption'
    element.textContent = text
    element.style.cssText =
      'position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:99999;' +
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

/**
 * True when something of the HUD is drawn over the point: neither the map
 * canvas nor a clearing is on top there.
 * @param {import('playwright').Page} page
 * @param {{ x: number, y: number }} point
 * @returns {Promise<boolean>}
 */
async function isUnderHud(page, point) {
  return page.evaluate(([x, y]) => {
    const top = document.elementFromPoint(x, y)
    if (top === null) return true
    return !top.matches('.map-3d-canvas, [data-clearing-id]')
  }, [point.x, point.y])
}

/**
 * What the HUD draws over a clearing: its centre and eight points of its rim
 * are probed. `dock` tells the action dock (it folds away) from the rest.
 * @param {import('playwright').Page} page
 * @param {number} clearingId
 * @returns {Promise<{ dock: boolean, others: string[] }>}
 */
async function overlaysOnClearing(page, clearingId) {
  const box = await page
    .locator(`[data-clearing-id="${String(clearingId)}"]`)
    .boundingBox()
  if (box === null) return { dock: false, others: [] }
  return page.evaluate(
    ([centerX, centerY, radius, dockSelector, rimPointCount]) => {
      const found = { dock: false, others: [] }
      const points = [[centerX, centerY]]
      for (let index = 0; index < rimPointCount; index += 1) {
        const angle = (index / rimPointCount) * Math.PI * 2
        points.push([
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius,
        ])
      }
      for (const [x, y] of points) {
        const top = document.elementFromPoint(x, y)
        if (top === null || top.matches('.map-3d-canvas, [data-clearing-id]')) {
          continue
        }
        if (top.closest(dockSelector) !== null) {
          found.dock = true
          continue
        }
        const name = `${top.tagName.toLowerCase()}.${top.className.toString().split(' ')[0]}`
        if (!found.others.includes(name)) found.others.push(name)
      }
      return found
    },
    [
      box.x + box.width / 2,
      box.y + box.height / 2,
      box.width / 2,
      DOCK_SELECTOR,
      RIM_POINT_COUNT,
    ],
  )
}

/**
 * Nothing that stays on screen may lie over a clearing; the action dock may,
 * as long as folding it gives the clearing back.
 * @param {import('playwright').Page} page
 * @param {(name: string) => Promise<void>} shoot
 */
async function checkOverlaysAtOpeningView(page, shoot) {
  const underDock = []
  for (let clearingId = 0; clearingId < CLEARING_COUNT; clearingId += 1) {
    const overlays = await overlaysOnClearing(page, clearingId)
    if (overlays.others.length > 0) {
      report(
        `opening view: clearing ${String(clearingId)} is under ${overlays.others.join(', ')}`,
      )
    }
    if (overlays.dock) underDock.push(clearingId)
  }
  console.log(`  clearings under the open dock: ${JSON.stringify(underDock)}`)
  await caption(page, 'A click on its phase tab folds the dock: the clearing under it shows')
  await page.locator(DOCK_FOLD_SELECTOR).click()
  await page.waitForTimeout(LOOK_MS)
  await shoot('01b-dock-folded')
  for (const clearingId of underDock) {
    if ((await overlaysOnClearing(page, clearingId)).dock) {
      report(`folded dock still lies over clearing ${String(clearingId)}`)
    }
  }
  await page.locator(DOCK_FOLD_SELECTOR).click()
  await page.waitForTimeout(600)
}

/**
 * Clicks a clearing the way a player does: where it is drawn. A clearing
 * under the HUD or off the screen is a problem of the layout, and is reported.
 * @param {import('playwright').Page} page
 * @param {number} clearingId
 */
async function clickClearing(page, clearingId) {
  const center = await clearingCenter(page, clearingId)
  if (await isUnderHud(page, center)) {
    report(
      `clearing ${String(clearingId)} cannot be clicked at ${String(Math.round(center.x))},${String(Math.round(center.y))}: covered or off screen`,
    )
  }
  await page
    .getByRole('button', { name: `Clearing ${String(clearingId)}`, exact: true })
    .click({ force: true })
  await page.waitForTimeout(500)
}

/**
 * @param {import('playwright').Page} page
 * @param {string} name
 */
async function clickButton(page, name) {
  await page.getByRole('button', { name, exact: true }).first().click()
  await page.waitForTimeout(400)
}

/**
 * @param {import('playwright').Page} page
 * @param {string} name
 * @returns {Promise<boolean>}
 */
async function buttonShows(page, name) {
  return page
    .getByRole('button', { name, exact: true })
    .first()
    .isVisible()
    .catch(() => false)
}

/**
 * The banner asks the count as one chip per count, or as a stepper.
 * @param {import('playwright').Page} page
 * @param {number} count
 */
async function pickWarriorCount(page, count) {
  const chip = `${String(count)} x warriors`
  if (await buttonShows(page, chip)) {
    await clickButton(page, chip)
    return
  }
  for (let step = 1; step < count; step += 1) {
    await clickButton(page, '>')
  }
  await clickButton(page, 'OK')
}

/** Clearings the banner lets the player pick right now. */
async function pickableClearingIds(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-clearing-id].cursor-root-pointer')].map(
      (button) => Number(button.getAttribute('data-clearing-id')),
    ),
  )
}

/** @returns {Promise<object>} */
async function gameState() {
  const response = await fetch(`${apiUrl}/game`)
  return (await response.json()).state
}

function countPieces(state, clearingId, owner, kind) {
  return state.clearings[clearingId].pieces.filter(
    (piece) => piece.kind === kind && piece.owner === owner,
  ).length
}

/**
 * @param {string} label
 * @param {number | string} actual
 * @param {number | string} expected
 */
function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    report(`${label} = ${String(actual)}, expected ${String(expected)}`)
  } else {
    console.log(`  ok: ${label} = ${String(actual)}`)
  }
}

/** Swaps the game on the server, then reloads: the page re-enters the game. */
async function loadSnapshot(page, snapshotPath) {
  const snapshot = await readFile(path.join(rootDirectory, snapshotPath), 'utf8')
  const response = await fetch(`${apiUrl}/game/snapshot?replace=1`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: snapshot,
  })
  if (!response.ok) throw new Error(`load ${snapshotPath}: ${String(response.status)}`)
  await page.reload()
  // The map choice is page state: a reload starts on the 3D map again.
  await page.waitForSelector(MAP_3D_READY_SELECTOR, { timeout: 30_000 })
  await page.waitForTimeout(2500)
}

/**
 * @param {import('playwright').Page} page
 * @param {(name: string) => Promise<void>} shoot
 */
async function driveMarquise(page, shoot) {
  await page.goto(`${reactUiUrl}/?qaSnapshot=${BUILDINGS_SNAPSHOT_PATH}`)
  await page.getByRole('button', { name: 'QA: Continue loaded game' }).click()
  await page.waitForSelector(MAP_3D_READY_SELECTOR, { timeout: 30_000 })
  await caption(page, 'The game opens on the 3D map: seen from above, pieces are 2D icons')
  await page.waitForTimeout(LOOK_MS + 1200)
  await shoot('01-3d-overview')

  await checkOverlaysAtOpeningView(page, shoot)

  await caption(page, '2D map toggle: the flat board')
  await page.locator('.map-view-toggle').click()
  await page.waitForTimeout(LOOK_MS)
  await shoot('02-flat-map')
  await caption(page, '… and back to the 3D map')
  await page.locator('.map-view-toggle').click()
  await page.waitForSelector(MAP_3D_READY_SELECTOR, { timeout: 30_000 })
  await page.waitForTimeout(LOOK_MS)

  await caption(page, 'Zoom in: the camera tilts, 3D models rise, icons and suits shrink')
  const origin = await clearingCenter(page, MARCH_ORIGIN_CLEARING_ID)
  const destination = await clearingCenter(page, MARCH_DESTINATION_CLEARING_ID)
  await slowZoom(
    page,
    { x: (origin.x + destination.x) / 2, y: (origin.y + destination.y) / 2 + 40 },
    -650,
  )
  await page.waitForTimeout(LOOK_MS)
  await shoot('03-zoomed-keep-and-recruiters')

  const beforeRecruit = await gameState()
  await caption(page, 'Recruit: the recruits walk up to the warriors they join, then the count grows')
  await clickButton(page, 'recruit')
  await page.waitForTimeout(700)
  await shoot('04-recruits-walking')
  await page.waitForTimeout(LOOK_MS + 800)
  await shoot('05-recruits-joined')
  const afterRecruit = await gameState()
  expectEqual(
    'Cat warriors on the recruiter clearing after recruit',
    countPieces(afterRecruit, MARCH_DESTINATION_CLEARING_ID, MARQUISE_SEAT, 'warrior'),
    countPieces(beforeRecruit, MARCH_DESTINATION_CLEARING_ID, MARQUISE_SEAT, 'warrior') + 1,
  )

  await caption(page, 'March: aura marks on the clearings to pick; no finger on the others')
  await clickButton(page, 'march')
  await shoot('06-march-pick-origin')
  const notPickable = [...Array(12).keys()].find(
    (clearingId) => clearingId !== MARCH_ORIGIN_CLEARING_ID,
  )
  const pickable = await pickableClearingIds(page)
  console.log(`  pickable origins: ${JSON.stringify(pickable)}`)
  if (!pickable.includes(MARCH_ORIGIN_CLEARING_ID)) {
    report(`march: clearing ${String(MARCH_ORIGIN_CLEARING_ID)} is not offered as origin`)
  }
  if (notPickable !== undefined && pickable.length === 12) {
    report('march: every clearing shows the finger cursor')
  }
  await clickClearing(page, MARCH_ORIGIN_CLEARING_ID)
  await shoot('07-march-pick-destination')
  await clickClearing(page, MARCH_DESTINATION_CLEARING_ID)
  await caption(page, 'Three warriors walk in a line on orange footsteps, in behind the ones standing there')
  await pickWarriorCount(page, MARCH_WARRIOR_COUNT)
  // The march has a second move: confirmed without it, then the warriors walk.
  await clickButton(page, 'OK')
  const footsteps = await page
    .locator(FOOTSTEP_SELECTOR)
    .first()
    .waitFor({ timeout: 2500 })
    .then(() => true)
    .catch(() => false)
  if (!footsteps) report('march: no footsteps drawn')
  await page.waitForTimeout(300)
  await shoot('08-march-walking-a')
  await page.waitForTimeout(700)
  await shoot('09-march-walking-b')
  await page.waitForTimeout(WALK_MS)
  await shoot('10-march-arrived')
  const afterMarch = await gameState()
  expectEqual(
    'Cat warriors left on the keep clearing',
    countPieces(afterMarch, MARCH_ORIGIN_CLEARING_ID, MARQUISE_SEAT, 'warrior'),
    countPieces(afterRecruit, MARCH_ORIGIN_CLEARING_ID, MARQUISE_SEAT, 'warrior') -
      MARCH_WARRIOR_COUNT,
  )
  expectEqual(
    'Cat warriors on the destination',
    countPieces(afterMarch, MARCH_DESTINATION_CLEARING_ID, MARQUISE_SEAT, 'warrior'),
    countPieces(afterRecruit, MARCH_DESTINATION_CLEARING_ID, MARQUISE_SEAT, 'warrior') +
      MARCH_WARRIOR_COUNT,
  )

  if (await buttonShows(page, 'build')) {
    await caption(page, 'Build: the new building rises out of a dust cloud, on its drawn slot')
    await clickButton(page, 'build')
    const buildSites = await pickableClearingIds(page)
    console.log(`  build sites: ${JSON.stringify(buildSites)}`)
    await shoot('11-build-pick')
    const buildSite = buildSites.includes(MARCH_DESTINATION_CLEARING_ID)
      ? MARCH_DESTINATION_CLEARING_ID
      : buildSites.includes(MARCH_ORIGIN_CLEARING_ID)
        ? MARCH_ORIGIN_CLEARING_ID
        : buildSites[0]
    if (buildSite === undefined) {
      report('build: no clearing offered')
    } else {
      const buildingsBefore = countPieces(afterMarch, buildSite, MARQUISE_SEAT, 'building')
      await clickClearing(page, buildSite)
      await page.waitForTimeout(500)
      await shoot('12-build-prompt')
      // A building type is asked when more than one can go up.
      for (const buildingName of ['sawmill', 'workshop', 'recruiter']) {
        if (await buttonShows(page, buildingName)) {
          await clickButton(page, buildingName)
          break
        }
      }
      await page.waitForTimeout(450)
      await shoot('13-building-rising')
      await page.waitForTimeout(LOOK_MS + 600)
      await shoot('14-building-stands')
      expectEqual(
        `Cat buildings on clearing ${String(buildSite)}`,
        countPieces(await gameState(), buildSite, MARQUISE_SEAT, 'building'),
        buildingsBefore + 1,
      )
    }
  } else {
    report('build is not offered after the march')
  }

}

/**
 * @param {import('playwright').Page} page
 * @param {(name: string) => Promise<void>} shoot
 */
async function driveVagabond(page, shoot) {
  await loadSnapshot(page, CROWDED_SNAPSHOT_PATH)
  await caption(page, 'A very crowded four-faction board, Vagabond daylight')
  await page.waitForTimeout(LOOK_MS)
  await shoot('16-crowded-overview')

  await caption(page, 'The fullest clearing: 3 slots taken, 3 armies, wood, sympathy, the Vagabond')
  await slowZoom(page, await clearingCenter(page, CROWDED_CLEARING_ID), -2300)
  await page.waitForTimeout(LOOK_MS)
  await shoot('17-crowded-clearing')

  await caption(page, 'End Phase → evening: moonlit forest, burning campfires, the pawn holds a torch')
  await clickButton(page, 'end phase')
  await page.waitForTimeout(LOOK_MS + 1800)
  await shoot('18-evening-crowded-clearing')
  await caption(page, 'Closer: the torch of the Vagabond pawn')
  await slowZoom(page, await clearingCenter(page, CROWDED_CLEARING_ID), -1200)
  await page.waitForTimeout(LOOK_MS)
  await shoot('18b-vagabond-torch')
  const evening = await gameState()
  expectEqual('Vagabond phase after End Phase', evening.phase, 'evening')
  expectEqual('seat in the evening', evening.currentSeat, VAGABOND_SEAT)

  await slowZoom(page, await clearingCenter(page, CROWDED_CLEARING_ID), 1200)
  await caption(page, 'Drag to pan — over to the keep, the old fortress ruins on the way')
  // Drags towards the top left corner, until the keep is well in view.
  for (let leg = 0; leg < 5; leg += 1) {
    const keepNow = await clearingCenter(page, KEEP_CLEARING_ID)
    console.log(`  pan leg ${String(leg)}: keep at ${String(Math.round(keepNow.x))},${String(Math.round(keepNow.y))}`)
    if (keepNow.x > VIEWPORT.width * 0.35) break
    const from = { x: VIEWPORT.width * 0.42, y: VIEWPORT.height * 0.4 }
    await slowDrag(page, from, { x: from.x + 420, y: from.y + 250 }, 70)
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(LOOK_MS)
  await shoot('19-keep-in-the-evening')

  await caption(page, 'Zoom back out: icons again, over the dark woodland')
  await slowZoom(page, { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 }, 2600)
  await page.waitForTimeout(LOOK_MS)
  await shoot('20-evening-overview')
}

/**
 * @param {import('playwright').Page} page
 * @param {(name: string) => Promise<void>} shoot
 */
async function driveBirdsong(page, shoot) {
  await loadSnapshot(page, BIRDSONG_SNAPSHOT_PATH)
  await caption(page, 'Birdsong: orange dawn sun over the woodland')
  await page.waitForTimeout(LOOK_MS + 800)
  await shoot('21-birdsong')
  expectEqual('phase of the birdsong game', (await gameState()).phase, 'birdsong')

  if (await buttonShows(page, 'slip')) {
    await caption(page, 'Slip: aura marks on the clearings and the forests the pawn can reach')
    await clickButton(page, 'slip')
    await page.waitForTimeout(LOOK_MS + 600)
    await shoot('22-slip-aura-marks')
    if (await buttonShows(page, 'X')) await clickButton(page, 'X')
  } else {
    report('slip is not offered in the Vagabond birdsong')
  }

  await caption(page, 'Back to the flat map')
  await page.locator('.map-view-toggle').click()
  await page.waitForTimeout(LOOK_MS)
  await shoot('23-flat-map-birdsong')
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const videoName = await pickUnusedVideoName(artifactsDirectory, VIDEO_NAME)
  const shotsDirectory = path.join(artifactsDirectory, `${videoName}-shots`)
  await mkdir(shotsDirectory, { recursive: true })
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
    report(`page error: ${error.message}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      report(`HTTP ${String(response.status())} ${response.url()}`)
    }
  })
  await installAutonomousClickHighlight(page)
  const shoot = async (name) => {
    await page.screenshot({ path: path.join(shotsDirectory, `${name}.png`) })
  }
  try {
    await driveMarquise(page, shoot)
    await driveVagabond(page, shoot)
    await driveBirdsong(page, shoot)
  } catch (error) {
    report(`demo stopped: ${error.message.split('\n')[0]}`)
    await shoot('99-stopped')
  } finally {
    await context.close()
    await browser.close()
  }

  const recordedFiles = (await readdir(staging)).filter((name) =>
    name.endsWith('.webm'),
  )
  if (recordedFiles.length === 0) throw new Error('no video recorded')
  const webmPath = path.join(artifactsDirectory, `${videoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${videoName}.mp4`)
  await copyFile(path.join(staging, recordedFiles[0]), webmPath)
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-n', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { encoding: 'utf8' },
  )
  if (ffmpeg.status !== 0) console.error(ffmpeg.stderr)
  console.log(`shots: ${shotsDirectory}`)
  console.log(`video: ${mp4Path}`)
  console.log(`problems: ${String(problems.length)}`)
  for (const problem of problems) console.log(` - ${problem}`)
}

await main()
