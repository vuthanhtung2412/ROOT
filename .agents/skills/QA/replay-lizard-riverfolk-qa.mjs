/**
 * Replays the Lizard Cult + Riverfolk Company QA run through the real UI and records it.
 * Plan: resources/notes/QA-plan-lizard-riverfolk.md
 *
 * Needs both dev servers (pnpm dev:web, pnpm dev:react) and the snapshot
 * tmp/qa/snapshots/lizard-riverfolk-qa-run.json (make-lizard-riverfolk-qa-run.ts).
 *
 *   node .agents/skills/QA/replay-lizard-riverfolk-qa.mjs            # both scenarios, headless
 *   node .agents/skills/QA/replay-lizard-riverfolk-qa.mjs replay     # Parts 1–5 only
 *   node .agents/skills/QA/replay-lizard-riverfolk-qa.mjs setup      # Part 0 only
 *   HEADED=1 STEP_PAUSE_MS=3000 node ...                             # watch it play in Chrome
 *   DRY_RUN=1 STEP_PAUSE_MS=0 node ...                               # fast check, no video kept
 *
 * Output: tmp/artifacts/lizard-riverfolk-qa/qa-lizard-riverfolk-{replay,setup}.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'
import { RIVERFOLK_TURN_TO_CULT_DAYLIGHT_STEPS } from './lizard-riverfolk-qa-steps.mjs'
import {
  CULT_EVENING_TO_SECOND_ROUND_STEPS,
  SETUP_STEPS,
} from './lizard-riverfolk-qa-later-steps.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/lizard-riverfolk-qa')
const snapshotPath = path.join(rootDirectory, 'tmp/qa/snapshots/lizard-riverfolk-qa-run.json')

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
const BOARD_LOOK_MS = 1500
const THREE_PLAYERS = '3'

async function fetchJson(route) {
  const response = await fetch(`${apiUrl}${route}`)
  if (!response.ok) throw new Error(`GET ${route} ${response.status}`)
  return response.json()
}

const fetchState = async () => (await fetchJson('/game')).state
const fetchLegalActions = async () => (await fetchJson('/game/actions')).actions

async function loadSnapshot() {
  const response = await fetch(`${apiUrl}/game/snapshot?replace=1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: await readFile(snapshotPath, 'utf8'),
  })
  if (!response.ok) throw new Error(`PUT /game/snapshot ${response.status}`)
}

/** UI driver: every helper is a real click on the page. */
function createDriver(page) {
  const settle = () => page.waitForTimeout(CLICK_SETTLE_MS)
  const namedButton = (name) => page.getByRole('button', { name, exact: true }).first()
  const driver = {
    fetchState,
    fetchLegalActions,
    async button(name) {
      await namedButton(name).click()
      await settle()
    },
    async buttonIfVisible(name) {
      const target = namedButton(name)
      const appeared = await target
        .waitFor({ timeout: OPTIONAL_BUTTON_WAIT_MS })
        .then(() => true, () => false)
      if (appeared) {
        await target.click()
        await settle()
      }
    },
    /** Wait for the tray to show `name`: the UI auto-ends phases with nothing to do. */
    async waitForButton(name) {
      await namedButton(name).waitFor()
      await settle()
    },
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
    /**
     * Battle prompts in the order a player meets them. The result strip is
     * dismissed before Field Hospitals on purpose: that order once left the
     * Field Hospitals prompt stuck on screen.
     */
    async resolveBattle({ fieldHospitals }) {
      await driver.button('Skip ambush')
      await driver.buttonIfVisible('Dismiss battle result')
      if (fieldHospitals) {
        await driver.button('Decline Field Hospitals')
        await driver.buttonIfVisible('Dismiss battle result')
      }
    },
    /** Open a faction board, read what `read` needs from the page, close it. */
    async lookAtBoard(faction, read) {
      await page.locator(`button:has(> img[alt="${faction}"])`).first().click()
      await page.locator('.faction-board-modal').waitFor()
      await page.waitForTimeout(BOARD_LOOK_MS)
      const seen = await read(page)
      await page.locator('.faction-board-modal__close').click()
      await settle()
      return seen
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
  return driver
}

const SCENARIOS = {
  replay: {
    videoName: 'qa-lizard-riverfolk-replay',
    intro: 'Lizard Cult + Riverfolk QA replay · Continue loaded game',
    steps: [...RIVERFOLK_TURN_TO_CULT_DAYLIGHT_STEPS, ...CULT_EVENING_TO_SECOND_ROUND_STEPS],
    prepare: loadSnapshot,
    enter: async (page, ui) => {
      await ui.button('QA: Continue loaded game')
    },
  },
  setup: {
    videoName: 'qa-lizard-riverfolk-setup',
    intro: 'Part 0 · New Game: Marquise + Riverfolk + Lizard Cult',
    steps: SETUP_STEPS,
    prepare: async () => {},
    enter: async (page, ui) => {
      await ui.button(THREE_PLAYERS)
      await page.getByLabel('Faction for seat 2').selectOption('riverfolk')
      await page.getByLabel('Faction for seat 3').selectOption('lizard')
      await ui.button('Start game')
    },
  },
}

async function convertToMp4(rawVideoDirectory, videoName) {
  const recorded = (await readdir(rawVideoDirectory)).filter((name) => name.endsWith('.webm'))
  if (recorded.length === 0) throw new Error('no video recorded')
  const unusedVideoName = await pickUnusedVideoName(artifactsDirectory, videoName)
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

async function runScenario(scenario) {
  const rawVideoDirectory = path.join(artifactsDirectory, `${scenario.videoName}-raw`)
  await rm(rawVideoDirectory, { recursive: true, force: true })
  await scenario.prepare()

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
  await ui.caption(scenario.intro)
  await page.waitForTimeout(stepPauseMs)
  await scenario.enter(page, ui)
  await page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()

  let failed = 0
  for (const step of scenario.steps) {
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

  const finalState = await fetchState()
  const scores = finalState.players.map((player) => `${player.faction} ${player.vp}`).join(' · ')
  await ui.caption(`Done · VP: ${scores}`)
  await page.waitForTimeout(stepPauseMs)
  await context.close()
  await browser.close()

  const passed = failed === 0 ? scenario.steps.length : 'not all'
  const video = isDryRun ? 'none (DRY_RUN)' : await convertToMp4(rawVideoDirectory, scenario.videoName)
  console.log(`\n${scenario.videoName}: ${passed} of ${scenario.steps.length} steps passed · video: ${video}\n`)
  return failed
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const requested = process.argv[2]
  const scenarioNames = requested === undefined ? Object.keys(SCENARIOS) : [requested]
  let failed = 0
  for (const scenarioName of scenarioNames) {
    const scenario = SCENARIOS[scenarioName]
    if (scenario === undefined) throw new Error(`unknown scenario ${scenarioName}`)
    failed += await runScenario(scenario)
  }
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
