/**
 * Frontend QA: many Alliance / Vagabond scenarios → videos under tmp/artifacts.
 *
 * Usage (web :3000 + react :5173):
 *   ROOT_REACT_URL=http://localhost:5173 node .cursor/skills/QA/record-fe-qa-scenarios.mjs
 *   ROOT_REACT_URL=http://localhost:5173 node .cursor/skills/QA/record-fe-qa-scenarios.mjs alliance-spread
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { mkdir, readdir, copyFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts')
const snapshotsDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const reactUiUrl =
  process.env.ROOT_REACT_URL ??
  process.env.ROOT_PHASER_URL ??
  'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'

/**
 * @typedef {{
 *   id: string
 *   snapshot: string
 *   videoName: string
 *   rule: string
 *   drive: (page: import('playwright').Page) => Promise<void>
 * }} Scenario
 */

async function loadSnapshot(snapshotName) {
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

async function fetchGame() {
  const response = await fetch(`${apiUrl}/game`)
  if (!response.ok) {
    throw new Error(`GET /game ${String(response.status)}`)
  }
  return response.json()
}

async function fetchActions() {
  const response = await fetch(`${apiUrl}/game/actions`)
  if (!response.ok) {
    throw new Error(`GET /game/actions ${String(response.status)}`)
  }
  const body = await response.json()
  return body.actions ?? []
}

/** @param {import('playwright').Page} page */
async function qaContinue(page) {
  await page
    .getByRole('button', { name: 'QA: Continue loaded game' })
    .waitFor({ timeout: 20_000 })
  await page.getByRole('button', { name: 'QA: Continue loaded game' }).click()
  await page.waitForTimeout(2000)
}

/**
 * @param {import('playwright').Page} page
 * @param {string} factionSubstring
 */
async function openFactionBoard(page, factionSubstring) {
  await page
    .locator('button')
    .filter({ hasText: new RegExp(factionSubstring, 'i') })
    .first()
    .click()
  await page.waitForSelector('.faction-board-modal', { timeout: 10_000 })
  await page.waitForTimeout(1000)
}

/** @param {import('playwright').Page} page */
async function closeFactionBoard(page) {
  const close = page.locator('.faction-board-modal__close')
  if ((await close.count()) > 0) {
    await close.click()
    await page.waitForTimeout(500)
  }
}

/**
 * Click tray button by visible label substring.
 * @param {import('playwright').Page} page
 * @param {RegExp|string} label
 */
async function clickTrayAction(page, label) {
  const pattern = typeof label === 'string' ? new RegExp(label, 'i') : label
  const button = page.locator('button.root-button').filter({ hasText: pattern })
  await button.first().waitFor({ timeout: 10_000 })
  await button.first().click()
  await page.waitForTimeout(900)
}

/** @param {import('playwright').Page} page */
async function confirmBanner(page) {
  const confirm = page.getByRole('button', { name: /confirm/i })
  if ((await confirm.count()) > 0) {
    await confirm.first().click()
    await page.waitForTimeout(800)
  }
}

/** @type {Scenario[]} */
const SCENARIOS = [
  {
    id: 'alliance-board',
    snapshot: 'alliance-vagabond-boards.json',
    videoName: 'qa-alliance-board',
    rule: '8.3 setup board + 8.2.3 supporters inspect',
    drive: async (page) => {
      await openFactionBoard(page, 'alliance')
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-alliance-board-03-modal.png'),
      })
      await page.waitForTimeout(800)
      const supporters = page.locator('.faction-board-modal__supporters-hit')
      if ((await supporters.count()) > 0) {
        await supporters.click()
        await page.waitForSelector('.card-gallery-modal', { timeout: 8000 })
        await page.waitForTimeout(1200)
        await page.screenshot({
          path: path.join(
            artifactsDirectory,
            'qa-alliance-board-03b-supporters.png',
          ),
        })
        await page.locator('.card-gallery-modal__close').click()
        await page.waitForTimeout(500)
      }
      await closeFactionBoard(page)
    },
  },
  {
    id: 'vagabond-board',
    snapshot: 'alliance-vagabond-boards.json',
    videoName: 'qa-vagabond-board',
    rule: '9.3.5 Thief items + 9.2.5 satchel/tracks',
    drive: async (page) => {
      await openFactionBoard(page, 'vagabond')
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-board-03-modal.png'),
      })
      await page.waitForTimeout(2200)
      await closeFactionBoard(page)
    },
  },
  {
    id: 'alliance-spread',
    snapshot: 'alliance-birdsong-spread.json',
    videoName: 'qa-alliance-spread',
    rule: '8.4.2 Spread Sympathy tray',
    drive: async (page) => {
      await page.waitForTimeout(600)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-alliance-spread-03-tray.png'),
      })
      await clickTrayAction(page, 'spread sympathy')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-alliance-spread-03b-prompt.png'),
      })
      await confirmBanner(page)
    },
  },
  {
    id: 'alliance-revolt',
    snapshot: 'alliance-birdsong-revolt.json',
    videoName: 'qa-alliance-revolt',
    rule: '8.4.1 Revolt tray',
    drive: async (page) => {
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-alliance-revolt-03-tray.png'),
      })
      await clickTrayAction(page, 'revolt')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-alliance-revolt-03b-prompt.png'),
      })
      await confirmBanner(page)
    },
  },
  {
    id: 'alliance-mobilize',
    snapshot: 'alliance-daylight-mobilize.json',
    videoName: 'qa-alliance-mobilize',
    rule: '8.5.2 Mobilize tray',
    drive: async (page) => {
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-alliance-mobilize-03-tray.png'),
      })
      await clickTrayAction(page, 'mobilize')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(
          artifactsDirectory,
          'qa-alliance-mobilize-03b-prompt.png',
        ),
      })
      // Pick a hand card if highlighted, then confirm
      const handCard = page.locator('.card-hand__card').first()
      if ((await handCard.count()) > 0) {
        await handCard.click()
        await page.waitForTimeout(500)
      }
      await confirmBanner(page)
    },
  },
  {
    id: 'alliance-military',
    snapshot: 'alliance-evening-military.json',
    videoName: 'qa-alliance-military',
    rule: '8.6.1 Military Operations tray',
    drive: async (page) => {
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-alliance-military-03-tray.png'),
      })
      await clickTrayAction(page, 'op:')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(
          artifactsDirectory,
          'qa-alliance-military-03b-prompt.png',
        ),
      })
    },
  },
  {
    id: 'vagabond-slip',
    snapshot: 'vagabond-birdsong-slip.json',
    videoName: 'qa-vagabond-slip',
    rule: '9.4.2 Slip tray',
    drive: async (page) => {
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-slip-03-tray.png'),
      })
      await clickTrayAction(page, 'slip')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-slip-03b-prompt.png'),
      })
    },
  },
  {
    id: 'vagabond-move',
    snapshot: 'vagabond-daylight-move.json',
    videoName: 'qa-vagabond-move',
    rule: '9.5.1 Move (exhaust boot)',
    drive: async (page) => {
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-move-03-tray.png'),
      })
      await clickTrayAction(page, /^move$/i)
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-move-03b-prompt.png'),
      })
    },
  },
  {
    id: 'vagabond-steal',
    snapshot: 'vagabond-daylight-steal.json',
    videoName: 'qa-vagabond-steal',
    rule: '9.5.9 Thief Steal (exhaust torch)',
    drive: async (page) => {
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-steal-03-tray.png'),
      })
      await clickTrayAction(page, 'steal')
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-steal-03b-prompt.png'),
      })
      await confirmBanner(page)
    },
  },
  {
    id: 'vagabond-explore',
    snapshot: 'vagabond-daylight-explore.json',
    videoName: 'qa-vagabond-explore',
    rule: '9.5.3 Explore (exhaust torch)',
    drive: async (page) => {
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-explore-03-tray.png'),
      })
      await clickTrayAction(page, 'explore')
      await page.waitForTimeout(1200)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-vagabond-explore-03b-after.png'),
      })
    },
  },
  {
    id: 'discard-pile',
    snapshot: 'alliance-vagabond-boards.json',
    videoName: 'qa-discard-pile',
    rule: 'HUD discard gallery',
    drive: async (page) => {
      const discard = page.getByRole('button', { name: /Discard/i })
      await discard.click()
      await page.waitForSelector('.card-gallery-modal', { timeout: 8000 })
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-discard-pile-03-open.png'),
      })
      await page.locator('.card-gallery-modal__close').click()
      await page.waitForTimeout(500)
    },
  },
  {
    id: 'crafted-cards',
    snapshot: 'alliance-vagabond-boards.json',
    videoName: 'qa-crafted-cards-rail',
    rule: 'PlayerRail crafted cards button',
    drive: async (page) => {
      const cards = page.getByRole('button', { name: /^cards$/i }).first()
      await cards.click()
      await page.waitForSelector('.card-gallery-modal', { timeout: 8000 })
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(artifactsDirectory, 'qa-crafted-cards-rail-03-open.png'),
      })
      await page.locator('.card-gallery-modal__close').click()
      await page.waitForTimeout(500)
    },
  },
]

/**
 * @param {Scenario} scenario
 */
async function recordScenario(scenario) {
  const staging = path.join(artifactsDirectory, `video-raw-${scenario.id}`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })

  await loadSnapshot(scenario.snapshot)
  const actions = await fetchActions()
  console.log(
    scenario.id,
    'rule=',
    scenario.rule,
    'legal=',
    actions.map((action) => action.type).join(','),
  )

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: staging,
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

  await installAutonomousClickHighlight(page)
  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  await page.screenshot({
    path: path.join(artifactsDirectory, `${scenario.videoName}-01-menu.png`),
  })
  await qaContinue(page)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${scenario.videoName}-02-game.png`),
  })

  await scenario.drive(page)

  await page.waitForTimeout(800)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${scenario.videoName}-04-after.png`),
  })

  const gameAfter = await fetchGame()
  await context.close()
  await browser.close()

  const recordedFiles = (await readdir(staging)).filter((name) =>
    name.endsWith('.webm'),
  )
  if (recordedFiles.length === 0) {
    throw new Error(`no webm for ${scenario.id}`)
  }
  const webmPath = path.join(artifactsDirectory, `${scenario.videoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${scenario.videoName}.mp4`)
  await copyFile(path.join(staging, recordedFiles[0]), webmPath)

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

  const result = {
    id: scenario.id,
    rule: scenario.rule,
    ok: consoleErrors.length === 0,
    videoMp4: mp4Path,
    phaseAfter: `${gameAfter.state.phase}/${gameAfter.state.step}`,
    seatAfter: gameAfter.state.currentSeat,
    consoleErrors: consoleErrors.slice(0, 6),
  }
  console.log(JSON.stringify(result, null, 2))
  return result
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })

  const make = spawnSync(
    'pnpm',
    ['exec', 'tsx', '../.cursor/skills/QA/make-fe-qa-snapshots.ts'],
    { cwd: path.join(rootDirectory, 'lib'), encoding: 'utf8' },
  )
  if (make.status !== 0) {
    throw new Error(`make snapshots failed:\n${make.stdout}\n${make.stderr}`)
  }
  console.log(make.stdout.trim())

  const only = process.argv[2]
  const selected =
    only === undefined
      ? SCENARIOS
      : SCENARIOS.filter((scenario) => scenario.id === only)
  if (selected.length === 0) {
    console.error(
      'usage: node record-fe-qa-scenarios.mjs [' +
        SCENARIOS.map((scenario) => scenario.id).join('|') +
        ']',
    )
    process.exit(1)
  }

  const results = []
  for (const scenario of selected) {
    try {
      results.push(await recordScenario(scenario))
    } catch (error) {
      console.error(`FAIL ${scenario.id}`, error)
      results.push({
        id: scenario.id,
        ok: false,
        error: String(error),
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        passed: results.filter((result) => result.ok === true).length,
        failed: results.filter((result) => result.ok !== true).length,
        results,
      },
      null,
      2,
    ),
  )
  if (results.some((result) => result.ok !== true)) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
