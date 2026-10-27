/**
 * Demo: solo mode — Marquise de Cat against the Automated Alliance and the
 * Vagabot (Rootbotics ch. 6–7), played in the browser with no game server.
 *
 * Vite only, its API proxy pointed at a dead port (proves no backend):
 *   ROOT_DEV_API=http://127.0.0.1:9 pnpm --filter @root/react exec vite --port 5199 --strictPort
 *   ROOT_REACT_URL=http://localhost:5199 node .agents/skills/QA/record-solo-vs-woodland-bots.mjs
 * `BOT_ROUNDS=12` plays on until a bot wins (default 3 rounds).
 *
 * Output: tmp/artifacts/solo-vs-woodland-bots/qa-solo-vs-woodland-bots.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/solo-vs-woodland-bots')
const VIDEO_NAME = 'qa-solo-vs-woodland-bots'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5199'
const botRounds = Number(process.env.BOT_ROUNDS ?? 3)
const isHeaded = process.env.HEADED === '1'
const VIEWPORT = { width: 1440, height: 900 }
/**
 * Headless Chromium draws WebGL in software (SwiftShader, ~2 fps on the 3D
 * map): use the real GPU through Metal so the video is smooth.
 */
const GPU_ARGUMENTS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
const VIDEO_FRAMES_PER_SECOND = 24
const LOOK_MS = 1800
const SETTLE_MS = 900
const SOLO_SAVE_KEY = 'root.react.soloGame'
/** Bot pace (botPace.ts): 2 s per bot action keeps the toasts readable. */
const BOT_PACE_STORAGE_KEY = 'root.react.botStepDelaySeconds'
const BOT_PACE_SECONDS = '2'
const VAGABOT_CHARACTER = 'ranger'
/** Marquise setup (Law of Root 6.3): keep corner, then sawmill, workshop, recruiter. */
const KEEP_CLEARING = 0
const SETUP_BUILDING_CLEARINGS = [0, 4, 8]
const MAX_TURN_STEPS = 80
/** Prompts the passive human answers with no. */
const DECLINE_BUTTON_NAME = /^(decline|skip|no|pass|don't)/i

/** @param {import('playwright').Page} page @param {string} text */
async function caption(page, text) {
  await page.evaluate((captionText) => {
    let element = document.getElementById('qa-caption')
    if (element === null) {
      element = document.createElement('div')
      element.id = 'qa-caption'
      element.style.cssText =
        'position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:2147483646;' +
        'background:rgba(20,16,10,.85);color:#f4e8c8;font:600 22px Georgia,serif;' +
        'padding:10px 20px;border-radius:8px;pointer-events:none;max-width:80vw;text-align:center'
      document.body.appendChild(element)
    }
    element.textContent = captionText
  }, text)
  console.log(`· ${text}`)
}

/** @param {import('playwright').Page} page */
async function readSoloState(page) {
  return page.evaluate((key) => {
    const saved = localStorage.getItem(key)
    if (saved === null) return null
    const snapshot = JSON.parse(saved)
    return {
      status: snapshot.state.status,
      winner: snapshot.state.winner ?? null,
      turn: snapshot.state.turn,
      seat: snapshot.state.currentSeat,
      step: `${snapshot.state.phase}/${snapshot.state.step}`,
      victoryPoints: snapshot.state.players.map(
        (player) => `${player.faction}=${player.vp}`,
      ),
    }
  }, SOLO_SAVE_KEY)
}

/** @param {import('playwright').Page} page @param {string | RegExp} name */
async function clickButton(page, name) {
  const button = page.getByRole('button', { name, exact: typeof name === 'string' })
  await button.first().click()
  await page.waitForTimeout(SETTLE_MS)
}

/** @param {import('playwright').Page} page @param {string | RegExp} name */
async function hasButton(page, name) {
  const buttons = page.getByRole('button', { name, exact: typeof name === 'string' })
  return (await buttons.count()) > 0 && (await buttons.first().isEnabled())
}

/** @param {import('playwright').Page} page @param {string} faction */
async function pickTrackFaction(page, faction) {
  await page.locator(`.menu-solo .menu-faction-choice[data-faction="${faction}"]`).click()
  await page.waitForTimeout(SETTLE_MS)
}

/**
 * Bots first (Mechanical Marquise holds the cat pieces), then the player:
 * the Automated Alliance needs the Woodland Alliance off the player seat.
 * @param {import('playwright').Page} page
 */
async function seatTable(page) {
  await caption(page, 'Swap the bots: Vagabot and Automated Alliance')
  await clickButton(page, 'Mechanical Marquise. Swap the bot')
  await pickTrackFaction(page, 'vagabot')
  await clickButton(page, 'You, Woodland Alliance. Change faction')
  await pickTrackFaction(page, 'marquise')
  await clickButton(page, 'Electric Eyrie. Swap the bot')
  await pickTrackFaction(page, 'automatedAlliance')
  await page.waitForTimeout(LOOK_MS)
}

/** @param {import('playwright').Page} page */
async function pickVagabotCharacter(page) {
  await caption(page, 'Vagabot settings: difficulty, traits, and its Character card')
  await clickButton(page, 'Difficulty and traits of Vagabot')
  const modal = page.locator('.menu-bot-settings-modal')
  await page.waitForTimeout(LOOK_MS)
  const characterSection = modal.locator('section[aria-label="Character"]')
  await characterSection.scrollIntoViewIfNeeded()
  await caption(page, 'Rootbotics 7.3.1: one Character — the sheet scrolls inside its paper')
  await page.waitForTimeout(LOOK_MS)
  await modal.locator(`.menu-bot-character-${VAGABOT_CHARACTER}`).click()
  await caption(page, `Character picked: ${VAGABOT_CHARACTER}`)
  await page.waitForTimeout(LOOK_MS)
  await modal.locator('.menu-bot-settings-done').click()
  await page.waitForTimeout(SETTLE_MS)
}

/** @param {import('playwright').Page} page */
async function showAutomatedAllianceSettings(page) {
  await caption(page, 'Automated Alliance settings: its own difficulty and trait cards')
  await clickButton(page, 'Difficulty and traits of Automated Alliance')
  await page.waitForTimeout(LOOK_MS * 1.5)
  await page.locator('.menu-bot-settings-modal .menu-bot-settings-done').click()
  await page.waitForTimeout(SETTLE_MS)
}

/** @param {import('playwright').Page} page */
async function setUpMarquise(page) {
  await caption(page, 'Your setup: keep, sawmill, workshop, recruiter')
  for (const clearingId of [KEEP_CLEARING, ...SETUP_BUILDING_CLEARINGS]) {
    await clickButton(page, `Clearing ${clearingId}`)
  }
}

/** Discard down to the hand limit: the last card in hand. */
async function discardDown(page) {
  await clickButton(page, 'discard')
  const cards = page.locator('button:has(img[alt^="ROOT-"])')
  await cards.last().click()
  await page.waitForTimeout(400)
  await clickButton(page, 'OK')
}

/**
 * The human passes their turn, then both bots take theirs. Returns once the
 * human acts again, or the game is over.
 * @param {import('playwright').Page} page
 */
async function playRound(page) {
  const startTurn = (await readSoloState(page))?.turn ?? 0
  for (let step = 0; step < MAX_TURN_STEPS; step += 1) {
    const state = await readSoloState(page)
    if (state === null || state.status === 'finished') return
    if (state.turn > startTurn && state.seat === 0 && state.step.startsWith('birdsong')) {
      return
    }
    if (await hasButton(page, 'Dismiss battle result')) {
      await page.waitForTimeout(LOOK_MS)
      // The overlay may close itself while we look.
      await page
        .getByRole('button', { name: 'Dismiss battle result' })
        .first()
        .click({ timeout: SETTLE_MS })
        .catch(() => {})
      continue
    }
    if (await hasButton(page, 'discard')) {
      await discardDown(page)
      continue
    }
    if (await hasButton(page, 'end phase')) {
      await clickButton(page, 'end phase')
      continue
    }
    if (await hasButton(page, DECLINE_BUTTON_NAME)) {
      await clickButton(page, DECLINE_BUTTON_NAME)
      continue
    }
    await page.waitForTimeout(SETTLE_MS)
  }
  console.log('round step cap hit:', JSON.stringify(await readSoloState(page)))
}

/** @param {import('playwright').Page} page @param {RegExp} railName */
async function showBoard(page, railName) {
  await page.getByRole('button', { name: railName }).first().click()
  await page.waitForTimeout(LOOK_MS * 2)
  const settings = page.locator('.bot-board-settings')
  if ((await settings.count()) > 0) {
    await settings.scrollIntoViewIfNeeded()
    await page.waitForTimeout(LOOK_MS)
  }
  await page.locator('.faction-board-modal__close').click()
  await page.waitForTimeout(SETTLE_MS)
}

/** @param {import('playwright').Page} page */
async function showBothBoards(page) {
  await caption(page, 'Automated Alliance board: order card, sympathy track, bases, supply')
  await showBoard(page, /^automatedAlliance/)
  await caption(page, 'Vagabot board: Character, items, quest, battle track')
  await showBoard(page, /^vagabot/)
}

async function convertWebmToMp4(webmPath, mp4Path) {
  const result = spawnSync(
    'ffmpeg',
    [
      '-n',
      '-i',
      webmPath,
      '-vf',
      `fps=${String(VIDEO_FRAMES_PER_SECOND)}`,
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
  return result.status === 0
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const videoName = await pickUnusedVideoName(artifactsDirectory, VIDEO_NAME)
  const temporaryVideoDirectory = path.join(artifactsDirectory, `${videoName}-pw`)
  await mkdir(temporaryVideoDirectory, { recursive: true })

  const browser = await chromium.launch({ headless: !isHeaded, args: GPU_ARGUMENTS })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: temporaryVideoDirectory, size: VIEWPORT },
  })
  await context.addInitScript(
    ([key, seconds]) => {
      localStorage.setItem(key, seconds)
    },
    [BOT_PACE_STORAGE_KEY, BOT_PACE_SECONDS],
  )
  const page = await context.newPage()
  await installAutonomousClickHighlight(page)
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().split('\n')[0])
  })

  await page.goto(reactUiUrl, { waitUntil: 'load' })
  await page.locator('.menu-solo-run').waitFor({ timeout: 30_000 })
  await caption(page, 'Solo run vs the Automated Alliance and the Vagabot — no game server')
  await page.waitForTimeout(LOOK_MS)
  await page.locator('.menu-solo-run').click()
  await page.locator('.menu-solo').waitFor({ timeout: 15_000 })
  await page.waitForTimeout(SETTLE_MS)
  await seatTable(page)
  await pickVagabotCharacter(page)
  await showAutomatedAllianceSettings(page)
  await page.locator('.menu-start-solo').click()
  await page.getByRole('button', { name: 'Clearing 0' }).waitFor({ timeout: 30_000 })
  await caption(page, 'Marquise de Cat vs Automated Alliance + Vagabot')
  await page.waitForTimeout(LOOK_MS)
  await setUpMarquise(page)
  await showBothBoards(page)

  for (let round = 1; round <= botRounds; round += 1) {
    await caption(page, `Round ${round}: you pass, then both bots play`)
    await playRound(page)
    const state = await readSoloState(page)
    console.log(`round ${round}:`, JSON.stringify(state))
    await caption(page, `After round ${round}: ${state?.victoryPoints.join(' · ')}`)
    await page.waitForTimeout(LOOK_MS)
    if (state?.status === 'finished') {
      await caption(page, `Game over — winner seat ${state.winner}`)
      await page.waitForTimeout(LOOK_MS * 3)
      break
    }
    if (round === 1) {
      await caption(page, 'Game log: each bot names its steps')
      await clickButton(page, 'Log')
      await page.waitForTimeout(LOOK_MS * 2)
      await clickButton(page, 'Log')
    }
  }
  if ((await readSoloState(page))?.status !== 'finished') await showBothBoards(page)

  await context.close()
  await browser.close()
  console.log(`console errors: ${consoleErrors.length}`)
  for (const error of new Set(consoleErrors)) console.log(`  ${error}`)

  const recorded = (await readdir(temporaryVideoDirectory)).find((name) =>
    name.endsWith('.webm'),
  )
  if (recorded === undefined) throw new Error('playwright left no webm')
  const webmPath = path.join(artifactsDirectory, `${videoName}.webm`)
  await copyFile(path.join(temporaryVideoDirectory, recorded), webmPath)
  await rm(temporaryVideoDirectory, { recursive: true, force: true })
  const mp4Path = path.join(artifactsDirectory, `${videoName}.mp4`)
  console.log(`video: ${webmPath}`)
  if (await convertWebmToMp4(webmPath, mp4Path)) console.log(`video: ${mp4Path}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
