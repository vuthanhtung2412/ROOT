/**
 * Demo: Marquise build → pick clearing → spend wood (greedy preselect) → confirm.
 *
 *   cd lib && pnpm exec tsx ../.cursor/skills/QA/make-wood-spend-demo-snapshot.ts
 *   ROOT_GAME_STORE_FILE=off PORT=3100 pnpm --filter @root/web dev
 *   ROOT_DEV_API=http://localhost:3100 pnpm --filter @root/react exec vite --port 5180 --strictPort
 *   ROOT_DEV_API=http://localhost:3100 ROOT_REACT_URL=http://localhost:5180 \
 *     node .cursor/skills/QA/record-wood-spend-demo.mjs
 *
 * Output: tmp/artifacts/wood-spend-demo/qa-wood-spend-demo.{webm,mp4}
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
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/wood-spend-demo')
const snapshotPath = path.join(rootDirectory, 'tmp/qa/snapshots/wood-spend-demo.json')
const VIDEO_NAME = 'qa-wood-spend-demo'
const INTRO =
  'Last sawmill (cost 4) · steppers on connected wood · disconnected wood ignored'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const isHeaded = process.env.HEADED === '1'
const stepPauseMs = Number(process.env.STEP_PAUSE_MS ?? 1600)
const VIEWPORT = { width: 1440, height: 900 }
const BUILD_CLEARING = 4
const MARGIN_ONE_CLEARING = 5
const MARGIN_TWO_CLEARING = 8
const MARGIN_THREE_CLEARING = 9
const DISCONNECTED_WOOD_CLEARING = 2
const WOOD_COST = 4
const EXPECTED_STEPPER_COUNT = 4
const ACTION_TIMEOUT_MS = 12_000
const LOOK_MS = 1800

async function loadSnapshot() {
  const response = await fetch(`${apiUrl}/game/snapshot?replace=1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: await readFile(snapshotPath, 'utf8'),
  })
  if (!response.ok) throw new Error(`PUT /game/snapshot ${response.status}`)
}

async function fetchGame() {
  const response = await fetch(`${apiUrl}/game`)
  if (!response.ok) throw new Error(`GET /game ${response.status}`)
  return response.json()
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 */
async function caption(page, text) {
  await page.evaluate((captionText) => {
    let element = document.getElementById('root-qa-caption')
    if (element === null) {
      element = document.createElement('div')
      element.id = 'root-qa-caption'
      document.body.appendChild(element)
    }
    element.style.cssText =
      'position:fixed;z-index:2147483646;pointer-events:none;left:12px;bottom:130px;max-width:420px;background:#1f2937;color:#fff;font:600 17px/1.35 system-ui;padding:10px 12px;border-radius:8px;box-shadow:0 2px 8px #0008'
    element.textContent = captionText
  }, text)
}

/**
 * @param {import('playwright').Page} page
 * @param {string} name
 */
async function clickButton(page, name) {
  await page.getByRole('button', { name, exact: true }).first().click()
  await page.waitForTimeout(500)
}

/**
 * @param {import('playwright').Page} page
 * @param {number} clearingId
 */
async function clickClearing(page, clearingId) {
  await page
    .getByRole('button', { name: `Clearing ${String(clearingId)}`, exact: true })
    .click({ force: true })
  await page.waitForTimeout(600)
}

/**
 * @param {import('playwright').Page} page
 * @param {string} name
 */
async function buttonShows(page, name) {
  return page
    .getByRole('button', { name, exact: true })
    .first()
    .isVisible()
    .catch(() => false)
}

/** @param {import('playwright').Page} page */
async function bannerText(page) {
  const prompt = page.getByText(/Build —/).first()
  if ((await prompt.count()) === 0) return ''
  return prompt.innerText()
}

async function convertToMp4(rawVideoDirectory) {
  const recorded = (await readdir(rawVideoDirectory)).filter((name) =>
    name.endsWith('.webm'),
  )
  if (recorded.length === 0) throw new Error('no video recorded')
  const unusedVideoName = await pickUnusedVideoName(artifactsDirectory, VIDEO_NAME)
  const webmPath = path.join(artifactsDirectory, `${unusedVideoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${unusedVideoName}.mp4`)
  await copyFile(path.join(rawVideoDirectory, recorded[0]), webmPath)
  const ffmpeg = spawnSync(
    'ffmpeg',
    [
      '-n',
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
  if (ffmpeg.status !== 0) throw new Error(`ffmpeg failed:\n${ffmpeg.stderr}`)
  return { webmPath, mp4Path, name: unusedVideoName }
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const rawVideoDirectory = path.join(artifactsDirectory, `${VIDEO_NAME}-raw`)
  await rm(rawVideoDirectory, { recursive: true, force: true })
  await loadSnapshot()

  const browser = await chromium.launch({ headless: !isHeaded })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: rawVideoDirectory, size: VIEWPORT },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(ACTION_TIMEOUT_MS)
  await installAutonomousClickHighlight(page)

  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  await caption(page, INTRO)
  await page.waitForTimeout(stepPauseMs)
  await clickButton(page, 'QA: Continue loaded game')
  await page
    .getByRole('button', { name: `Clearing ${String(BUILD_CLEARING)}`, exact: true })
    .waitFor({ timeout: 20_000 })
  await page.waitForTimeout(LOOK_MS)

  await caption(
    page,
    `Daylight — last sawmill costs ${String(WOOD_COST)} wood (Law column)`,
  )
  await clickButton(page, 'build')
  await page.waitForTimeout(LOOK_MS)

  await caption(page, `Pick clearing ${String(BUILD_CLEARING)} to build`)
  await clickClearing(page, BUILD_CLEARING)
  await page.waitForTimeout(700)

  // Multiple building types may be offered; pick sawmill if asked.
  if (await buttonShows(page, 'sawmill')) {
    await caption(page, 'Pick last sawmill')
    await clickButton(page, 'sawmill')
    await page.waitForTimeout(700)
  }

  const spendPrompt = await bannerText(page)
  console.log('banner after building pick:', spendPrompt.replace(/\s+/g, ' ').trim())
  if (!/spend wood/i.test(spendPrompt)) {
    throw new Error(`expected wood spend prompt, got: ${spendPrompt}`)
  }
  await caption(
    page,
    `Preselect lowest margin first: C${String(MARGIN_ONE_CLEARING)} → C${String(BUILD_CLEARING)} → C${String(MARGIN_TWO_CLEARING)}`,
  )
  await page.waitForTimeout(LOOK_MS + 400)
  if (!new RegExp(`${String(WOOD_COST)}/${String(WOOD_COST)}`).test(await bannerText(page))) {
    throw new Error(
      `expected preselect ${String(WOOD_COST)}/${String(WOOD_COST)}, got: ${await bannerText(page)}`,
    )
  }

  await page
    .locator('.clearing-wood-stepper')
    .first()
    .waitFor({ timeout: 5000 })
  const stepperCount = await page.locator('.clearing-wood-stepper').count()
  console.log(`wood steppers on map: ${String(stepperCount)}`)
  if (stepperCount !== EXPECTED_STEPPER_COUNT) {
    throw new Error(
      `expected ${String(EXPECTED_STEPPER_COUNT)} wood steppers, got ${String(stepperCount)}`,
    )
  }
  await caption(
    page,
    `C${String(DISCONNECTED_WOOD_CLEARING)} wood is eyrie-ruled — no stepper`,
  )
  await page.waitForTimeout(LOOK_MS)

  await caption(
    page,
    `Swap via stepper: − on build C${String(BUILD_CLEARING)}, + on margin-3 C${String(MARGIN_THREE_CLEARING)}`,
  )
  await page
    .getByRole('button', {
      name: `Less wood from clearing ${String(BUILD_CLEARING)}`,
      exact: true,
    })
    .click()
  await page.waitForTimeout(900)
  if (!new RegExp(`${String(WOOD_COST - 1)}/${String(WOOD_COST)}`).test(await bannerText(page))) {
    throw new Error(
      `expected ${String(WOOD_COST - 1)}/${String(WOOD_COST)} after remove, got: ${await bannerText(page)}`,
    )
  }
  await page
    .getByRole('button', {
      name: `More wood from clearing ${String(MARGIN_THREE_CLEARING)}`,
      exact: true,
    })
    .click()
  await page.waitForTimeout(LOOK_MS)

  const beforeConfirm = await bannerText(page)
  console.log('banner before confirm:', beforeConfirm.replace(/\s+/g, ' ').trim())
  if (!new RegExp(`${String(WOOD_COST)}/${String(WOOD_COST)}`).test(beforeConfirm)) {
    throw new Error(
      `expected ${String(WOOD_COST)}/${String(WOOD_COST)} wood selected, got: ${beforeConfirm}`,
    )
  }

  await caption(page, 'Confirm wood spend → last sawmill placed')
  // Turn banner confirm control is labelled OK (checkmark tile).
  await clickButton(page, 'OK')
  await page.waitForTimeout(LOOK_MS + 800)

  const state = (await fetchGame()).state
  const woodLeft = (clearingId) =>
    state.clearings[clearingId].pieces.filter(
      (piece) => piece.kind === 'token' && piece.type === 'wood',
    ).length
  const buildingsOnBuild = state.clearings[BUILD_CLEARING].pieces.filter(
    (piece) =>
      piece.kind === 'building' &&
      piece.type === 'sawmill' &&
      piece.owner === MARQUISE,
  ).length
  const left = {
    build: woodLeft(BUILD_CLEARING),
    marginOne: woodLeft(MARGIN_ONE_CLEARING),
    marginTwo: woodLeft(MARGIN_TWO_CLEARING),
    marginThree: woodLeft(MARGIN_THREE_CLEARING),
    disconnected: woodLeft(DISCONNECTED_WOOD_CLEARING),
  }
  console.log({ buildingsOnBuild, left })
  if (buildingsOnBuild < 1) throw new Error('sawmill not placed')
  // Spent: C5×1, C4×1, C8×1, C9×1 → left 0,1,1,0; disconnected untouched.
  if (left.marginOne !== 0) throw new Error(`C5 wood left ${String(left.marginOne)}`)
  if (left.build !== 1) throw new Error(`C4 wood left ${String(left.build)}`)
  if (left.marginTwo !== 1) throw new Error(`C8 wood left ${String(left.marginTwo)}`)
  if (left.marginThree !== 0) throw new Error(`C9 wood left ${String(left.marginThree)}`)
  if (left.disconnected !== 1) {
    throw new Error(`disconnected wood should stay, got ${String(left.disconnected)}`)
  }

  await caption(page, 'Done — last sawmill paid from chosen clearings')
  await page.waitForTimeout(stepPauseMs)

  await context.close()
  await browser.close()

  const video = await convertToMp4(rawVideoDirectory)
  console.log(`\nvideo: ${video.mp4Path}\n`)
}

const MARQUISE = 0

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
