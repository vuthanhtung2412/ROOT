/**
 * Demo of the action dock branch, played through the real UI and recorded.
 * Plan: resources/notes/QA-plan-action-dock.md
 *
 * Needs both dev servers and the snapshot
 * tmp/qa/snapshots/action-dock-qa-run.json (make-action-dock-qa-run.ts).
 * The snapshot replaces the game of the API it is loaded into: point the
 * script at a spare pair of servers to leave a game in progress alone
 * (ROOT_GAME_STORE_FILE=off keeps the spare backend off the saved game file
 * the main backend restores from)
 *
 *   ROOT_GAME_STORE_FILE=off PORT=3100 pnpm --filter @root/web dev
 *   ROOT_DEV_API=http://localhost:3100 pnpm --filter @root/react exec vite --port 5180 --strictPort
 *   ROOT_DEV_API=http://localhost:3100 ROOT_REACT_URL=http://localhost:5180 \
 *     node .agents/skills/QA/replay-action-dock-qa.mjs
 *
 *   HEADED=1 STEP_PAUSE_MS=3000 node ...   # watch it play in Chrome
 *   DRY_RUN=1 STEP_PAUSE_MS=0 node ...     # fast check, no video kept
 *
 * Output: tmp/artifacts/action-dock-qa/qa-action-dock-demo.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'
import { ACTION_DOCK_STEPS, ANIMATION_START_WAIT_MS } from './action-dock-qa-steps.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/action-dock-qa')
const snapshotPath = path.join(rootDirectory, 'tmp/qa/snapshots/action-dock-qa-run.json')
const VIDEO_NAME = 'qa-action-dock-demo'
const INTRO = 'Action dock demo · Marquise + Eyrie + Woodland Alliance'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const isHeaded = process.env.HEADED === '1'
/** Script check without evidence: plays the steps but keeps no video. */
const isDryRun = process.env.DRY_RUN === '1'
const stepPauseMs = Number(process.env.STEP_PAUSE_MS ?? 1800)
/** Optional folder for one screenshot per step (script debugging). */
const screenshotDirectory = process.env.SCREENSHOT_DIRECTORY ?? null
const VIEWPORT = { width: 1440, height: 900 }
const CLICK_SETTLE_MS = 600
const ACTION_TIMEOUT_MS = 8000
const OPTIONAL_BUTTON_WAIT_MS = 1500
const STATE_POLL_MS = 150
/** A drag is walked in small moves, slow enough to be watched. */
const DRAG_STEPS = 24
const DRAG_STEP_MS = 30
const DRAG_HOLD_MS = 700

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

/** `#c45c26` for a computed `rgb(196, 92, 38)`; other CSS colours as they are. */
function hexColor(cssColor) {
  const channels = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(cssColor.trim())
  if (channels === null) return cssColor.trim().toLowerCase()
  return `#${channels
    .slice(1)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

/** UI driver: every helper is a real click or hover on the page, or a look at it. */
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
    /** Wait for the dock to show `name`: the UI auto-ends phases with nothing to do. */
    async waitForButton(name) {
      await namedButton(name).waitFor()
      await settle()
    },
    async waitFor(selector) {
      await page.locator(selector).first().waitFor()
      await settle()
    },
    /** Wait until the server state answers `predicate`. */
    async waitForState(predicate) {
      const deadline = Date.now() + ACTION_TIMEOUT_MS
      while (Date.now() < deadline) {
        if (predicate(await fetchState())) {
          await settle()
          return
        }
        await page.waitForTimeout(STATE_POLL_MS)
      }
      throw new Error(`state never matched ${String(predicate)}`)
    },
    seesButton: (name) => appears(namedButton(name), ANIMATION_START_WAIT_MS),
    seesText: (text) =>
      appears(page.getByText(text, { exact: true }).last(), ANIMATION_START_WAIT_MS),
    /** True once `selector` is on the page (an animation that just started). */
    sees: (selector) => appears(page.locator(selector).first(), ANIMATION_START_WAIT_MS),
    count: (selector) => page.locator(selector).count(),
    textsOf: (selector) => page.locator(selector).allInnerTexts(),
    async textOfSelector(selector) {
      const target = page.locator(selector).first()
      return (await target.count()) === 0 ? '' : target.innerText()
    },
    async click(selector) {
      await page.locator(selector).first().click()
      await settle()
    },
    async clickText(selector, text) {
      await page.locator(selector).filter({ hasText: text }).first().click()
      await settle()
    },
    hover: (selector) => page.locator(selector).first().hover(),
    hoverButton: (name) => namedButton(name).hover(),
    async clearing(clearingId) {
      await page
        .getByRole('button', { name: `Clearing ${clearingId}`, exact: true })
        .click({ force: true })
      await settle()
    },
    /** Click the clearing when the banner asks for one (a single target is sent alone). */
    async clearingIfAsked(clearingId, promptText) {
      if (await appears(page.getByText(promptText).first(), OPTIONAL_BUTTON_WAIT_MS)) {
        await this.clearing(clearingId)
      }
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
    /**
     * Press on `fromSelector`, carry it to `destination` (a selector, or a
     * point of the page) and let go. Returns what was drawn just before the drop.
     */
    async drag(fromSelector, destination) {
      const centerOf = async (selector) => {
        const bounds = await page.locator(selector).first().boundingBox()
        if (bounds === null) throw new Error(`nothing to drag at ${selector}`)
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      }
      const from = await centerOf(fromSelector)
      const to = typeof destination === 'string' ? await centerOf(destination) : destination
      await page.mouse.move(from.x, from.y)
      await page.waitForTimeout(DRAG_STEP_MS)
      await page.mouse.down()
      for (let step = 1; step <= DRAG_STEPS; step++) {
        const progress = step / DRAG_STEPS
        await page.mouse.move(
          from.x + (to.x - from.x) * progress,
          from.y + (to.y - from.y) * progress,
        )
        await page.waitForTimeout(DRAG_STEP_MS)
      }
      const seen = {
        ghost: (await page.locator('.decree-drag-ghost').count()) > 0,
        slotLit: (await page.locator('.decree-panel__slot.shadow-gold-ring').count()) > 0,
      }
      await page.waitForTimeout(DRAG_HOLD_MS)
      await page.mouse.up()
      await settle()
      return seen
    },
    /** The dock as drawn: frame colour, phase tab text, size, place, tile columns. */
    async dockLook() {
      const look = await page.locator('.action-dock').first().evaluate((dock) => {
        const bounds = dock.getBoundingClientRect()
        const grid = dock.querySelector(':scope > .grid')
        return {
          color: getComputedStyle(dock).getPropertyValue('--root-paper-color'),
          tab: dock.firstElementChild?.firstElementChild?.textContent ?? '',
          width: Math.round(bounds.width),
          fromRight: Math.round(window.innerWidth - bounds.right),
          fromBottom: Math.round(window.innerHeight - bounds.bottom),
          gridColumns:
            grid === null ? 0 : getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          gridWidth: grid === null ? 0 : Math.round(grid.getBoundingClientRect().width),
          gridTiles:
            grid === null
              ? []
              : [...grid.querySelectorAll('button')].map((tile) => tile.textContent),
        }
      })
      return { ...look, color: hexColor(look.color) }
    },
    /** How far the parent of `selector` sits from the top right corner. */
    cornerOf: (selector) =>
      page.locator(selector).first().evaluate((element) => {
        const bounds = (element.parentElement ?? element).getBoundingClientRect()
        return {
          fromRight: Math.round(window.innerWidth - bounds.right),
          fromTop: Math.round(bounds.top),
        }
      }),
    /** First rule text cut by its two-line clamp, with the hover title it carries. */
    clampedRule: (selector) =>
      page.locator(selector).evaluateAll((rules) => {
        const clamped = rules.find((rule) => rule.scrollHeight > rule.clientHeight)
        const rule = clamped ?? rules[0]
        return {
          isClamped: clamped !== undefined,
          title: rule?.getAttribute('title') ?? '',
          fullText: rule?.textContent ?? '',
        }
      }),
    /** Icon drawing of each named dock tile, to tell the icons apart. */
    tileIcons: (names) =>
      Promise.all(
        names.map((name) =>
          namedButton(name).evaluate((tile) => tile.querySelector('svg')?.innerHTML ?? ''),
        ),
      ),
    /** Fill colour of the footsteps a move is treading right now. */
    async footstepColor() {
      const fill = page.locator('.board-effects svg.overflow-visible [fill]:not([fill="none"])').first()
      if ((await fill.count()) === 0) return ''
      return hexColor(await fill.evaluate((shape) => getComputedStyle(shape).fill))
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
      turnScratch: failedState.turnScratch,
      buttonNames: await page
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent),
        ),
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
  for (const [stepIndex, step] of ACTION_DOCK_STEPS.entries()) {
    await ui.caption(step.title)
    await page.waitForTimeout(stepPauseMs / 2)
    const { status, detail } = await runStep(step, page, ui)
    console.log(`${status}  ${step.title} — ${detail}`)
    await ui.caption(`${step.title} — ${detail}`, status)
    if (screenshotDirectory !== null) {
      await page.screenshot({
        path: path.join(screenshotDirectory, `step-${String(stepIndex + 1)}.png`),
      })
    }
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

  const passed = failed === 0 ? ACTION_DOCK_STEPS.length : 'not all'
  const video = isDryRun ? 'none (DRY_RUN)' : await convertToMp4(rawVideoDirectory)
  console.log(`\n${VIDEO_NAME}: ${passed} of ${ACTION_DOCK_STEPS.length} steps passed · video: ${video}\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
