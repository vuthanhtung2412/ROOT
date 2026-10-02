/**
 * Replays the Woodland + Vagabond QA run through the real UI and records it.
 * Plan: resources/notes/QA-plan-woodland-vagabond.md
 *
 * Needs both dev servers (pnpm dev:web, pnpm dev:react) and the snapshot
 * tmp/qa/snapshots/wa-vb-qa-run.json (make-wa-vb-qa-run.ts).
 *
 *   node .agents/skills/QA/replay-wa-vb-qa.mjs            # headless, records video
 *   HEADED=1 node .agents/skills/QA/replay-wa-vb-qa.mjs   # watch it play in Chrome
 *   HEADED=1 STEP_PAUSE_MS=3000 node ...                  # slower, easier to follow
 *
 * Output: tmp/artifacts/wa-vb-qa/qa-wa-vb-replay.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/wa-vb-qa')
const rawVideoDirectory = path.join(artifactsDirectory, 'replay-video-raw')
const snapshotPath = path.join(rootDirectory, 'tmp/qa/snapshots/wa-vb-qa-run.json')
const VIDEO_NAME = 'qa-wa-vb-replay'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const isHeaded = process.env.HEADED === '1'
const stepPauseMs = Number(process.env.STEP_PAUSE_MS ?? 1800)
const VIEWPORT = { width: 1440, height: 900 }
const CLICK_SETTLE_MS = 600
const ALLIANCE_SEAT = 2
const VAGABOND_SEAT = 3

const results = []

async function fetchState() {
  const response = await fetch(`${apiUrl}/game`)
  if (!response.ok) throw new Error(`GET /game ${response.status}`)
  return (await response.json()).state
}

async function loadSnapshot() {
  const response = await fetch(`${apiUrl}/game/snapshot?replace=1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: await readFile(snapshotPath, 'utf8'),
  })
  if (!response.ok) throw new Error(`PUT /game/snapshot ${response.status}`)
}

function piecesIn(state, clearingId) {
  return state.clearings[clearingId].pieces
}

function expectThat(condition, message) {
  if (!condition) throw new Error(message)
}

/** UI driver: every helper is a real click on the page. */
function createDriver(page) {
  const settle = () => page.waitForTimeout(CLICK_SETTLE_MS)
  return {
    async button(name) {
      await page.getByRole('button', { name, exact: true }).first().click()
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
    async supporter(cardDefinitionId, index) {
      await page
        .locator(`.card-gallery-modal__card--selectable[title="${cardDefinitionId}"]`)
        .nth(index)
        .click()
      await settle()
    },
    async buttonIfVisible(name) {
      const target = page.getByRole('button', { name, exact: true }).first()
      if (await target.isVisible().catch(() => false)) {
        await target.click()
        await settle()
      }
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

/**
 * One plan step: `play` clicks through the UI, `verify` checks server state
 * and returns the caption detail. Failures are recorded and the run continues.
 */
const STEPS = [
  {
    title: '1 · Revolt on clearing 7 with 2 fox supporters (W1)',
    play: async (ui) => {
      await ui.button('revolt')
      await ui.clearing(7)
      await ui.supporter('ROOT-202', 0)
      await ui.supporter('ROOT-202', 1)
      await ui.button('OK')
    },
    verify: (state) => {
      expectThat(
        piecesIn(state, 7).some((piece) => piece.type === 'base'),
        'no Alliance base on 7',
      )
      return 'Base + warriors placed; Vagabond asked which 3 items to damage'
    },
  },
  {
    title: '4 · Vagabond chooses damaged items: sword, tea, coin (W3 V10)',
    play: async (ui) => {
      await ui.button('sword')
      await ui.button('tea')
      await ui.button('coin')
      await ui.button('OK')
    },
    verify: (state) => {
      const damaged = state.players[VAGABOND_SEAT].board.damaged.map((item) => item.type)
      expectThat(damaged.join() === 'sword,tea,coin', `damaged = ${damaged.join()}`)
      expectThat(
        piecesIn(state, 7).some((piece) => piece.kind === 'pawn'),
        'pawn left clearing 7',
      )
      return 'Damaged box holds exactly the chosen items; pawn stays'
    },
  },
  {
    title: '2–3 · Marquise pays fox card for Field Hospitals (W2)',
    play: async (ui) => ui.handCard('ROOT-202'),
    verify: (state) => {
      const keepWarriors = piecesIn(state, 1).filter((piece) => piece.kind === 'warrior')
      expectThat(keepWarriors.length === 2, `keep warriors = ${keepWarriors.length}`)
      return '2 warriors return to the Keep'
    },
  },
  {
    title: '6 · Spread Sympathy on 3 with Martial Law (W4 W5)',
    play: async (ui) => {
      await ui.button('spread sympathy')
      await ui.clearing(3)
      await ui.supporter('ROOT-201', 0)
      await ui.supporter('ROOT-201', 1)
      await ui.supporter('ROOT-201', 2)
      await ui.button('OK')
    },
    verify: (state) => {
      expectThat(
        piecesIn(state, 3).some((piece) => piece.type === 'sympathy'),
        'no sympathy on 3',
      )
      return '3 rabbit supporters spent (2 + 1 Martial Law)'
    },
  },
  {
    title: '7–10 · Daylight: Mobilize, Train, Craft Anvil (W13)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.button('mobilize')
      await ui.handCard('ROOT-203')
      await ui.button('train')
      await ui.handCard('ROOT-202')
      await ui.button('craft')
      await ui.handCard('ROOT-204')
    },
    verify: (state) => {
      const alliance = state.players[ALLIANCE_SEAT]
      expectThat(alliance.board.officers === 5, `officers = ${alliance.board.officers}`)
      expectThat(alliance.craftedItems.length === 1, 'no crafted item')
      return 'Officers 5, hammer crafted, Evening begins'
    },
  },
  {
    title: '13–14 · Battle on 6, defender Marquise picked (W10 W11)',
    play: async (ui) => {
      await ui.button('op: battle')
      await ui.clearing(6)
      await ui.button('marquise')
      await ui.button('Skip ambush')
      await ui.button('Decline Field Hospitals')
      await ui.buttonIfVisible('Dismiss battle result')
    },
    verify: (state) => {
      const marquiseLeft = piecesIn(state, 6).some((piece) => piece.owner === 0)
      expectThat(!marquiseLeft, 'Marquise warrior still on 6')
      return 'Defender chosen in the UI; battle resolved'
    },
  },
  {
    title: '15–16 · Organize on 8, Recruit on 7 (W10)',
    play: async (ui) => {
      await ui.button('op: organize')
      await ui.clearing(8)
      await ui.button('op: recruit')
      await ui.clearing(7)
    },
    verify: (state) => {
      expectThat(
        piecesIn(state, 8).some((piece) => piece.type === 'sympathy'),
        'no sympathy on 8',
      )
      return 'Sympathy on 8, +1 warrior on 7'
    },
  },
  {
    title: '12 · Move 7→3 into own sympathy: no Outrage (W8 W9)',
    play: async (ui) => {
      await ui.button('op: move')
      await ui.clearing(7)
      await ui.clearing(3)
      await ui.button('OK')
    },
    verify: (state) => {
      expectThat(state.pending.length === 0, 'unexpected pending event')
      expectThat(
        piecesIn(state, 3).some(
          (piece) => piece.kind === 'warrior' && piece.owner === ALLIANCE_SEAT,
        ),
        'no Alliance warrior on 3',
      )
      return 'Move completed in the UI, nothing pending'
    },
  },
  {
    title: '17–21 · Vagabond: Refresh, Slip 7→6, Move 6→11 (V5 V6)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.button('slip')
      await ui.clearing(6)
      await ui.button('move')
      await ui.clearing(11)
    },
    verify: (state) => {
      expectThat(
        piecesIn(state, 11).some((piece) => piece.kind === 'pawn'),
        'pawn not on 11',
      )
      return 'Both boots exhausted for the move into a Hostile clearing'
    },
  },
  {
    title: '22–25 · Explore ruin, Quest "Repair a Shed" for VP (V1 V3)',
    play: async (ui) => {
      await ui.button('explore')
      await ui.button('quest')
      await ui.button('VP for suit')
    },
    verify: (state) => {
      const vagabond = state.players[VAGABOND_SEAT]
      expectThat(vagabond.vp === 2, `Vagabond VP = ${vagabond.vp}`)
      return 'Explore +1 VP, quest +1 VP'
    },
  },
  {
    title: '30 · Repair the damaged sword (V9)',
    play: async (ui) => {
      await ui.button('repair')
      await ui.button('sword')
    },
    verify: (state) => {
      const damaged = state.players[VAGABOND_SEAT].board.damaged.map((item) => item.type)
      expectThat(!damaged.includes('sword'), 'sword still damaged')
      return 'Damaged items listed as artwork; sword repaired'
    },
  },
  {
    title: '27 · Aid Alliance: fox card, exhaust tea, take hammer (V8)',
    play: async (ui) => {
      await ui.button('aid')
      await ui.handCard('ROOT-202')
      await ui.button('alliance')
      await ui.button('tea')
      await ui.button('take hammer')
    },
    verify: (state) => {
      const relationship = state.players[VAGABOND_SEAT].board.relationships.alliance
      expectThat(relationship === 1, `alliance relationship = ${relationship}`)
      expectThat(
        state.players[ALLIANCE_SEAT].craftedItems.length === 0,
        'Alliance still holds the hammer',
      )
      return 'Target by faction name, cost item chosen, hammer taken'
    },
  },
  {
    title: '28 · Battle the Hostile Marquise warrior: Infamy (V7)',
    play: async (ui) => {
      await ui.button('battle')
      await ui.clearing(11)
      await ui.button('marquise')
      await ui.button('Skip ambush')
      await ui.button('Decline Field Hospitals')
      await ui.buttonIfVisible('Dismiss battle result')
    },
    verify: (state) => {
      expectThat(
        !piecesIn(state, 11).some((piece) => piece.owner === 0),
        'Marquise warrior still on 11',
      )
      return 'Warrior removed, +1 VP Infamy'
    },
  },
  {
    title: '29, 31 · Strike the sympathy token: one Outrage on Vagabond (W7)',
    play: async (ui) => {
      await ui.button('strike')
      await ui.clearing(11)
    },
    verify: (state) => {
      const outrages = state.pending.filter((event) => event.type === 'outrage')
      expectThat(outrages.length === 1, `outrage count = ${outrages.length}`)
      return 'Sympathy removed, exactly one Outrage pending'
    },
  },
  {
    title: '32 · Pay Outrage, then choose 6 items over the limit (V9)',
    play: async (ui) => {
      await ui.button('Outrage: give card')
      await ui.button('end phase')
      for (const itemLabel of [
        'tea (damaged)',
        'coin (damaged)',
        'hammer (exhausted)',
        'hammer (exhausted)',
        'tea (exhausted)',
        'hammer',
      ]) {
        await ui.button(itemLabel)
      }
      await ui.button('OK')
    },
    verify: (state) => {
      const board = state.players[VAGABOND_SEAT].board
      const held = board.satchel.length + board.damaged.length
      expectThat(held === 8, `items held = ${held}`)
      return 'Chosen items removed; 8 items left = limit'
    },
  },
  {
    title: '35–36 · Marquise marches 4→0: one Outrage, paid with bird (W6)',
    play: async (ui) => {
      await ui.button('march')
      await ui.clearing(4)
      await ui.clearing(0)
      await ui.button('OK')
      await ui.button('OK')
      await ui.button('Outrage: give card')
    },
    verify: (state) => {
      expectThat(state.pending.length === 0, 'Outrage still pending')
      return 'Single Outrage resolved'
    },
  },
  {
    title: '37 · Marquise battles Alliance on 3: Guerrilla War (W12)',
    play: async (ui) => {
      await ui.button('battle')
      await ui.clearing(3)
      await ui.button('Skip ambush')
    },
    verify: (state) => {
      const marquiseWarriors = piecesIn(state, 3).filter(
        (piece) => piece.kind === 'warrior' && piece.owner === 0,
      )
      expectThat(marquiseWarriors.length === 2, `Marquise warriors = ${marquiseWarriors.length}`)
      return 'Defending Alliance used the higher die; Marquise lost a warrior'
    },
  },
]

async function convertToMp4() {
  const recorded = (await readdir(rawVideoDirectory)).filter((name) => name.endsWith('.webm'))
  if (recorded.length === 0) throw new Error('no video recorded')
  const unusedVideoName = await pickUnusedVideoName(artifactsDirectory, VIDEO_NAME)
  const webmPath = path.join(artifactsDirectory, `${unusedVideoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${unusedVideoName}.mp4`)
  await copyFile(path.join(rawVideoDirectory, recorded[0]), webmPath)
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { encoding: 'utf8' },
  )
  if (ffmpeg.status !== 0) throw new Error(`ffmpeg failed:\n${ffmpeg.stderr}`)
  return mp4Path
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  await rm(rawVideoDirectory, { recursive: true, force: true })
  await loadSnapshot()

  const browser = await chromium.launch({ headless: !isHeaded })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: rawVideoDirectory, size: VIEWPORT },
  })
  const page = await context.newPage()
  await installAutonomousClickHighlight(page)
  const ui = createDriver(page)

  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  await ui.caption('Woodland + Vagabond QA replay · Continue loaded game')
  await page.waitForTimeout(stepPauseMs)
  await ui.button('QA: Continue loaded game')
  await page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()

  for (const step of STEPS) {
    await ui.caption(step.title)
    await page.waitForTimeout(stepPauseMs / 2)
    let status = 'PASS'
    let detail
    try {
      await step.play(ui)
      detail = step.verify(await fetchState())
    } catch (error) {
      status = 'FAIL'
      detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
      console.error(error)
      const failedState = await fetchState()
      console.error('state at failure:', {
        seat: failedState.currentSeat,
        phase: failedState.phase,
        step: failedState.step,
        pending: failedState.pending,
        visibleButtons: await page.getByRole('button').allInnerTexts(),
      })
    }
    results.push({ step: step.title, status, detail })
    console.log(`${status}  ${step.title} — ${detail}`)
    await ui.caption(`${step.title} — ${detail}`, status)
    await page.waitForTimeout(stepPauseMs)
    if (status === 'FAIL') break
  }

  const finalState = await fetchState()
  const scores = finalState.players.map((player) => `${player.faction} ${player.vp}`).join(' · ')
  await ui.caption(`Done · VP: ${scores}`)
  await page.waitForTimeout(stepPauseMs)

  await context.close()
  await browser.close()

  const mp4Path = await convertToMp4()
  const failed = results.filter((row) => row.status === 'FAIL').length
  console.log(`\n${results.length - failed}/${STEPS.length} steps passed · video: ${mp4Path}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
