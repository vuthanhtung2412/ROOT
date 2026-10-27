/**
 * Demo: solo mode — one player against Mechanical Marquise and Electric Eyrie,
 * played in the browser with no game server.
 *
 * Vite only, its API proxy pointed at a dead port (proves no backend):
 *   ROOT_DEV_API=http://127.0.0.1:9 pnpm --filter @root/react exec vite --port 5199 --strictPort
 *   ROOT_REACT_URL=http://localhost:5199 node .cursor/skills/QA/record-solo-vs-bots.mjs
 *
 * Output: tmp/artifacts/solo-vs-bots/qa-solo-vs-bots.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  flashPageClick,
  installAutonomousClickHighlight,
} from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/solo-vs-bots')
const VIDEO_NAME = 'qa-solo-vs-bots'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5199'
/** Rootbotics 3.3 demo: `BOT_DIFFICULTY=nightmare ALL_TRAITS=1` picks them in the menu. */
const botDifficulty = process.env.BOT_DIFFICULTY ?? null
const isEveryTraitOn = process.env.ALL_TRAITS === '1'
const showsBotSettings = botDifficulty !== null || isEveryTraitOn
const isHeaded = process.env.HEADED === '1'
const VIEWPORT = { width: 1440, height: 900 }
const LOOK_MS = 1800
const SETTLE_MS = 900
const SOLO_SAVE_KEY = 'root.react.soloGame'
const CLEARING_COUNT = 12
const BOT_ROUNDS = 3
const MAX_TURN_STEPS = 30

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
      turn: snapshot.state.turn,
      seat: snapshot.state.currentSeat,
      step: `${snapshot.state.phase}/${snapshot.state.step}`,
      victoryPoints: snapshot.state.players.map(
        (player) => `${player.faction}=${player.vp}`,
      ),
    }
  }, SOLO_SAVE_KEY)
}

/** @param {import('playwright').Page} page */
async function bannerText(page) {
  return page.evaluate(() => document.body.innerText.split('\n')[0] ?? '')
}

/** @param {import('playwright').Page} page @param {string | RegExp} name */
async function clickButton(page, name) {
  const button = page.getByRole('button', { name, exact: typeof name === 'string' })
  await button.first().click()
  await page.waitForTimeout(SETTLE_MS)
}

/** @param {import('playwright').Page} page @param {string | RegExp} name */
async function hasButton(page, name) {
  return (
    (await page
      .getByRole('button', { name, exact: typeof name === 'string' })
      .count()) > 0
  )
}

/**
 * Spread Sympathy: the first clearing the composer takes. A clearing it
 * refuses changes nothing, so try them in turn and blink only the taken one.
 * @param {import('playwright').Page} page
 */
async function pickSympathyClearing(page) {
  const prompt = await bannerText(page)
  for (let clearingId = 0; clearingId < CLEARING_COUNT; clearingId += 1) {
    const button = page.locator(`button[data-clearing-id="${clearingId}"]`)
    const box = await button.boundingBox()
    await button.evaluate((element) => element.click())
    await page.waitForTimeout(250)
    if ((await bannerText(page)) !== prompt) {
      if (box !== null) {
        await flashPageClick(page, box.x + box.width / 2, box.y + box.height / 2)
      }
      return clearingId
    }
  }
  return null
}

/** @param {import('playwright').Page} page */
async function spreadSympathy(page) {
  await clickButton(page, 'spread sympathy')
  const clearingId = await pickSympathyClearing(page)
  if (clearingId === null) {
    await clickButton(page, 'X')
    return false
  }
  await page.waitForTimeout(SETTLE_MS)
  const supporterHeading = page.getByRole('heading', { name: /supporter/i })
  if ((await supporterHeading.count()) > 0) {
    // Pick supporters until the composer offers OK (cards of other suits do nothing).
    const supporters = await supporterHeading.locator('xpath=..').getByRole('button').all()
    for (const supporter of supporters) {
      if (await hasButton(page, 'OK')) break
      await supporter.click()
      await page.waitForTimeout(SETTLE_MS / 2)
    }
    if (!(await hasButton(page, 'OK'))) {
      await clickButton(page, 'X')
      return false
    }
    await clickButton(page, 'OK')
  }
  return true
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
 * Play the human turn out (one Spread Sympathy when offered), then let both
 * bots take theirs. Returns once the human acts again.
 * @param {import('playwright').Page} page
 */
async function playRound(page) {
  const startTurn = (await readSoloState(page))?.turn ?? 0
  let spread = false
  for (let step = 0; step < MAX_TURN_STEPS; step += 1) {
    const state = await readSoloState(page)
    if (state === null || state.status === 'finished') return
    if (state.turn > startTurn && state.seat === 0 && state.step.startsWith('birdsong')) {
      return
    }
    if (await hasButton(page, 'Dismiss battle result')) {
      await page.waitForTimeout(LOOK_MS)
      await clickButton(page, 'Dismiss battle result')
      continue
    }
    // The difficulty / traits demo keeps the human passive: the bots are the subject.
    if (!spread && !showsBotSettings && (await hasButton(page, 'spread sympathy'))) {
      spread = true
      if (await spreadSympathy(page)) continue
    }
    if (await hasButton(page, 'discard')) {
      await discardDown(page)
      continue
    }
    if (await hasButton(page, 'end phase')) {
      await clickButton(page, 'end phase')
      continue
    }
    await page.waitForTimeout(SETTLE_MS)
  }
}

/**
 * Rootbotics 3.3 in the solo menu: each bot's difficulty, then every trait
 * card of both bots (the modal shows every card text).
 * @param {import('playwright').Page} page
 */
async function pickBotSettings(page) {
  await caption(page, `Bots: ${botDifficulty ?? 'default'} difficulty${isEveryTraitOn ? ', every trait card' : ''}`)
  const solo = page.locator('.menu-solo')
  // ⚙ on each bot tile opens a modal with its difficulty and trait cards.
  for (const settingsButton of await solo.locator('.menu-solo-bot-settings').all()) {
    await settingsButton.click()
    await page.waitForTimeout(SETTLE_MS / 2)
    const modal = page.locator('.menu-bot-settings-modal')
    if (botDifficulty !== null) {
      await modal.locator(`.menu-bot-difficulty-${botDifficulty}`).click()
      await page.waitForTimeout(SETTLE_MS / 2)
    }
    if (isEveryTraitOn) {
      for (const trait of await modal.locator('.menu-bot-trait').all()) {
        await trait.click()
        await page.waitForTimeout(250)
      }
    }
    await page.waitForTimeout(LOOK_MS)
    await modal.locator('.menu-bot-settings-done').click()
  }
}

/** @param {import('playwright').Page} page @param {RegExp} railName */
async function showBoard(page, railName) {
  await page.getByRole('button', { name: railName }).first().click()
  await page.waitForTimeout(LOOK_MS * 1.5)
  // Difficulty and trait chips sit in the strip under the board.
  const settings = page.locator('.bot-board-settings')
  if (showsBotSettings && (await settings.count()) > 0) {
    await settings.scrollIntoViewIfNeeded()
    await page.waitForTimeout(LOOK_MS * 1.5)
  }
  await page.locator('.faction-board-modal__close').click()
  await page.waitForTimeout(SETTLE_MS)
}

async function convertWebmToMp4(webmPath, mp4Path) {
  const result = spawnSync(
    'ffmpeg',
    ['-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4Path],
    { encoding: 'utf8' },
  )
  return result.status === 0
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const videoName = await pickUnusedVideoName(
    artifactsDirectory,
    showsBotSettings ? `${VIDEO_NAME}-difficulty-traits` : VIDEO_NAME,
  )
  const temporaryVideoDirectory = path.join(artifactsDirectory, `${videoName}-pw`)
  await mkdir(temporaryVideoDirectory, { recursive: true })

  const browser = await chromium.launch({ headless: !isHeaded })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: temporaryVideoDirectory, size: VIEWPORT },
  })
  const page = await context.newPage()
  await installAutonomousClickHighlight(page)
  const serverRequests = []
  page.on('response', (response) => {
    if (response.url().includes('/game') && response.status() >= 500) {
      serverRequests.push(`${response.status()} ${response.url()}`)
    }
  })

  await page.goto(reactUiUrl, { waitUntil: 'load' })
  await page.locator('.menu-solo-run').waitFor({ timeout: 30_000 })
  await caption(page, 'Solo run vs bots — no game server running')
  await page.waitForTimeout(LOOK_MS)
  await page.locator('.menu-solo-run').click()
  await page.locator('.menu-start-solo').waitFor({ timeout: 15_000 })
  await page.locator('.menu-solo .menu-faction-choice[data-faction="alliance"]').click()
  await page.waitForTimeout(SETTLE_MS)
  if (showsBotSettings) await pickBotSettings(page)
  await page.locator('.menu-start-solo').click()
  await page.getByRole('button', { name: 'Clearing 0' }).waitFor({ timeout: 30_000 })
  await caption(page, 'Woodland Alliance vs Mechanical Marquise + Electric Eyrie')
  await page.waitForTimeout(LOOK_MS * 1.5)

  for (let round = 1; round <= BOT_ROUNDS; round += 1) {
    await caption(page, `Round ${round}: your turn, then both bots play`)
    await playRound(page)
    const state = await readSoloState(page)
    console.log(`round ${round}:`, JSON.stringify(state))
    await caption(page, `After round ${round}: ${state?.victoryPoints.join(' · ')}`)
    await page.waitForTimeout(LOOK_MS)
    if (round === 1) {
      await caption(page, 'Mechanical Marquise board: order card, Buildings tracks')
      await showBoard(page, /^mechanicalMarquise/)
      await caption(page, 'Electric Eyrie board: Decree, Roosts track')
      await showBoard(page, /^electricEyrie/)
      await caption(page, 'Game log: the bots name their steps')
      await clickButton(page, 'Log')
      await page.waitForTimeout(LOOK_MS * 1.5)
      await clickButton(page, 'Log')
    }
  }

  const beforeReload = await readSoloState(page)
  await caption(page, 'Page reload: the saved solo game comes back')
  await page.waitForTimeout(SETTLE_MS)
  await page.reload({ waitUntil: 'load' })
  await page.getByRole('button', { name: 'Clearing 0' }).waitFor({ timeout: 30_000 })
  const afterReload = await readSoloState(page)
  await caption(page, `Resumed at turn ${afterReload?.turn} (was ${beforeReload?.turn})`)
  await page.waitForTimeout(LOOK_MS * 1.5)
  if (afterReload?.turn !== beforeReload?.turn) {
    throw new Error('reload did not resume the solo game')
  }

  await caption(page, 'End game: back to the menu')
  await clickButton(page, 'End game')
  await clickButton(page, 'Yes, end the game')
  // Back on the menu: the solo run screen stays open if it was.
  await page.locator('.menu-solo-run, .menu-start-solo').first().waitFor({ timeout: 15_000 })
  await page.waitForTimeout(LOOK_MS)

  await context.close()
  await browser.close()
  console.log(`server errors seen (menu polling only expected): ${serverRequests.length}`)

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
