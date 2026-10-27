/**
 * Demo of the crafted card actions, played through the real UI and recorded.
 * Plan: resources/notes/QA-plan-card-fe-support.md
 *
 * Needs both dev servers (pnpm dev:web, pnpm dev:react) and the snapshot
 * tmp/qa/snapshots/card-fe-support-qa-run.json (make-card-fe-support-qa-run.ts).
 * The snapshot replaces the game of the API it is loaded into: point the
 * script at a spare pair of servers to leave a game in progress alone, e.g.
 *
 *   ROOT_GAME_STORE_FILE=off PORT=3100 pnpm --filter @root/web dev
 *   ROOT_DEV_API=http://localhost:3100 pnpm --filter @root/react exec vite --port 5180 --strictPort
 *   ROOT_DEV_API=http://localhost:3100 ROOT_REACT_URL=http://localhost:5180 \
 *     node .agents/skills/QA/replay-card-fe-support-qa.mjs
 *
 *   HEADED=1 STEP_PAUSE_MS=3000 node ...   # watch it play in Chrome
 *   DRY_RUN=1 STEP_PAUSE_MS=0 node ...     # fast check, no video kept
 *
 * Output: tmp/artifacts/card-fe-support-qa/card-fe-support.qa.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'
import { CARD_FE_SUPPORT_STEPS } from './card-fe-support-qa-steps.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/card-fe-support-qa')
const snapshotPath = path.join(rootDirectory, 'tmp/qa/snapshots/card-fe-support-qa-run.json')
const VIDEO_NAME = 'card-fe-support.qa'
const INTRO = 'Crafted card actions · Marquise + Woodland Alliance'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const isHeaded = process.env.HEADED === '1'
/** Script check without evidence: plays the steps but keeps no video. */
const isDryRun = process.env.DRY_RUN === '1'
const stepPauseMs = Number(process.env.STEP_PAUSE_MS ?? 1800)
const VIEWPORT = { width: 1440, height: 900 }
const CLICK_SETTLE_MS = 600
const ACTION_TIMEOUT_MS = 8000
const OPTIONAL_BUTTON_WAIT_MS = 1500
const BUTTON_LOOK_WAIT_MS = 1200

async function fetchJson(route) {
  const response = await fetch(`${apiUrl}${route}`)
  if (!response.ok) throw new Error(`GET ${route} ${response.status}`)
  return response.json()
}

const fetchState = async () => (await fetchJson('/game')).state

async function loadSnapshot() {
  const response = await fetch(`${apiUrl}/game/snapshot?replace=1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: await readFile(snapshotPath, 'utf8'),
  })
  if (!response.ok) throw new Error(`PUT /game/snapshot ${response.status}`)
}

/** UI driver: every helper is a real click on the page, or a look at it. */
function createDriver(page) {
  const settle = () => page.waitForTimeout(CLICK_SETTLE_MS)
  const namedButton = (name) => page.getByRole('button', { name, exact: true }).first()
  const appears = (locator, timeout) =>
    locator.waitFor({ timeout }).then(
      () => true,
      () => false,
    )
  return {
    fetchState,
    pause: (milliseconds) => page.waitForTimeout(milliseconds),
    async button(name) {
      await namedButton(name).click()
      await settle()
    },
    async buttonIfVisible(name) {
      const target = namedButton(name)
      if (await appears(target, OPTIONAL_BUTTON_WAIT_MS)) {
        await target.click()
        await settle()
      }
    },
    /** Wait for the tray to show `name`: the UI auto-ends phases with nothing to do. */
    async waitForButton(name) {
      await namedButton(name).waitFor()
      await settle()
    },
    /** Wait for a prompt the UI opens by itself (forced card prompts). */
    async waitForText(text) {
      await page.getByText(text, { exact: true }).first().waitFor()
      await settle()
    },
    seesButton: (name) => appears(namedButton(name), BUTTON_LOOK_WAIT_MS),
    async clearing(clearingId) {
      await page
        .getByRole('button', { name: `Clearing ${clearingId}`, exact: true })
        .click({ force: true })
      await settle()
    },
    async handCard(cardDefinitionId) {
      await page
        .locator(
          `button:not(.card-gallery-modal__card):not([aria-pressed]):has(> img[alt="${cardDefinitionId}"])`,
        )
        .first()
        .click()
      await settle()
    },
    async galleryCard(cardDefinitionId) {
      await page
        .locator(`.card-gallery-modal__card--selectable[title="${cardDefinitionId}"]`)
        .first()
        .click()
      await settle()
    },
    async caption(text, status) {
      await page.evaluate(
        ({ captionText, captionStatus }) => {
          const colors = { PASS: '#15803d', FAIL: '#b91c1c' }
          let caption = document.getElementById('root-qa-caption')
          if (caption === null) {
            caption = document.createElement('div')
            caption.id = 'root-qa-caption'
            document.body.appendChild(caption)
          }
          caption.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;left:12px;bottom:130px;width:320px;background:${colors[captionStatus] ?? '#1f2937'};color:#fff;font:600 17px/1.3 system-ui;padding:10px 12px;border-radius:8px;box-shadow:0 2px 8px #0008`
          caption.textContent = captionStatus ? `[${captionStatus}] ${captionText}` : captionText
        },
        { captionText: text, captionStatus: status ?? null },
      )
    },
  }
}

async function convertToMp4(rawVideoDirectory) {
  const recorded = (await readdir(rawVideoDirectory)).filter((name) => name.endsWith('.webm'))
  if (recorded.length === 0) throw new Error('no video recorded')
  const unusedVideoName = await pickUnusedVideoName(artifactsDirectory, VIDEO_NAME)
  const webmPath = path.join(artifactsDirectory, `${unusedVideoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${unusedVideoName}.mp4`)
  await copyFile(path.join(rawVideoDirectory, recorded[0]), webmPath)
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-n', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { encoding: 'utf8' },
  )
  if (ffmpeg.status !== 0) throw new Error(`ffmpeg failed:\n${ffmpeg.stderr}`)
  return mp4Path
}

async function runStep(step, page, ui) {
  try {
    const seen = await step.play(ui)
    return { status: 'PASS', detail: step.verify(await fetchState(), seen) }
  } catch (error) {
    console.error(error)
    const failedState = await fetchState()
    console.error('state at failure:', {
      seat: failedState.currentSeat,
      phase: failedState.phase,
      step: failedState.step,
      pending: failedState.pending,
      visibleButtons: await page.getByRole('button').allInnerTexts(),
    })
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
    return { status: 'FAIL', detail }
  }
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
  const ui = createDriver(page)

  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  await ui.caption(INTRO)
  await page.waitForTimeout(stepPauseMs)
  await ui.button('QA: Continue loaded game')
  await page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()

  let failed = 0
  for (const step of CARD_FE_SUPPORT_STEPS) {
    await ui.caption(step.title)
    await page.waitForTimeout(stepPauseMs / 2)
    const { status, detail } = await runStep(step, page, ui)
    console.log(`${status}  ${step.title} — ${detail}`)
    await ui.caption(`${step.title} — ${detail}`, status)
    await page.waitForTimeout(stepPauseMs)
    if (status === 'FAIL') {
      failed += 1
      break
    }
  }

  await ui.caption(failed === 0 ? 'Done · every step passed' : 'Stopped on a failed step')
  await page.waitForTimeout(stepPauseMs)
  await context.close()
  await browser.close()

  const passed = failed === 0 ? CARD_FE_SUPPORT_STEPS.length : 'not all'
  const video = isDryRun ? 'none (DRY_RUN)' : await convertToMp4(rawVideoDirectory)
  console.log(`\n${VIDEO_NAME}: ${passed} of ${CARD_FE_SUPPORT_STEPS.length} steps passed · video: ${video}\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
