/**
 * Online multiplayer check: two separate browsers, one seat each.
 * Host creates an online lobby, guest joins, host starts, both play setup.
 * Verifies hidden hands, turn ownership in the UI, and server seat checks.
 *
 * Needs both dev servers (pnpm dev:web, pnpm dev:react). Replaces the game
 * slot on the server.
 *
 *   node .agents/skills/QA/replay-online-two-players.mjs
 *   HEADED=1 STEP_PAUSE_MS=2500 node .agents/skills/QA/replay-online-two-players.mjs
 *
 * Output: tmp/artifacts/online-two-players/{host,guest}.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/online-two-players')

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const isHeaded = process.env.HEADED === '1'
const stepPauseMs = Number(process.env.STEP_PAUSE_MS ?? 1500)
const VIEWPORT = { width: 1280, height: 800 }
const CLICK_SETTLE_MS = 700
const PLAYER_ID_HEADER = 'X-Player-Id'
const IDENTITY_STORAGE_KEY = 'root.react.playerIdentity'
const HOST_SEAT = 0
const GUEST_SEAT = 1
const TRAY_ACTION_LABELS = ['march', 'battle', 'recruit', 'build', 'craft', 'end phase']

const results = []

function expectThat(condition, message) {
  if (!condition) throw new Error(message)
}

async function apiRequest(method, route, options = {}) {
  const response = await fetch(`${apiUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(options.playerId ? { [PLAYER_ID_HEADER]: options.playerId } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  const text = await response.text()
  return { status: response.status, body: text.length > 0 ? JSON.parse(text) : null }
}

/** One player = one isolated browser context with its own video. */
async function openPlayer(browser, name) {
  const videoDirectory = path.join(artifactsDirectory, `${name}-raw`)
  await rm(videoDirectory, { recursive: true, force: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoDirectory, size: VIEWPORT },
  })
  const page = await context.newPage()
  await installAutonomousClickHighlight(page)
  await page.goto(reactUiUrl, { waitUntil: 'networkidle' })
  const settle = () => page.waitForTimeout(CLICK_SETTLE_MS)
  return {
    name,
    page,
    context,
    videoDirectory,
    async button(label) {
      await page.getByRole('button', { name: label, exact: true }).first().click()
      await settle()
    },
    async clearing(clearingId) {
      await page
        .getByRole('button', { name: `Clearing ${clearingId}`, exact: true })
        .click({ force: true })
      await settle()
    },
    async playerId() {
      const raw = await page.evaluate(
        (storageKey) => sessionStorage.getItem(storageKey),
        IDENTITY_STORAGE_KEY,
      )
      return raw === null ? null : JSON.parse(raw).playerId
    },
    async bannerText() {
      return (await page.locator('p.font-display').allInnerTexts()).join(' | ')
    },
    async visibleHandCardCount() {
      return page
        .locator('button:not(.card-gallery-modal__card):has(> img[alt^="ROOT-"])')
        .count()
    },
    async hasTrayActions() {
      for (const label of TRAY_ACTION_LABELS) {
        const visible = await page
          .getByRole('button', { name: label, exact: true })
          .first()
          .isVisible()
          .catch(() => false)
        if (visible) return true
      }
      return false
    },
    async caption(text, status) {
      await page.evaluate(
        ({ captionText, captionStatus, playerName }) => {
          const colors = { PASS: '#15803d', FAIL: '#b91c1c' }
          let caption = document.getElementById('root-qa-caption')
          if (caption === null) {
            caption = document.createElement('div')
            caption.id = 'root-qa-caption'
            document.body.appendChild(caption)
          }
          caption.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;left:12px;bottom:70px;width:320px;background:${colors[captionStatus] ?? '#1f2937'};color:#fff;font:600 16px/1.3 system-ui;padding:10px 12px;border-radius:8px;box-shadow:0 2px 8px #0008`
          caption.textContent = `${playerName.toUpperCase()} · ${captionStatus ? `[${captionStatus}] ` : ''}${captionText}`
        },
        { captionText: text, captionStatus: status ?? null, playerName: name },
      )
    },
  }
}

async function runStep(title, players, play) {
  for (const player of players) await player.caption(title)
  let status = 'PASS'
  let detail
  try {
    detail = await play()
  } catch (error) {
    status = 'FAIL'
    detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
    console.error(error)
  }
  results.push({ title, status, detail })
  console.log(`${status}  ${title} — ${detail}`)
  for (const player of players) await player.caption(`${title} — ${detail}`, status)
  await players[0].page.waitForTimeout(stepPauseMs)
  return status === 'PASS'
}

/** First legal clearing the caller may pick for the pending setup choice. */
async function firstLegalClearing(playerId) {
  const legal = await apiRequest('GET', '/game/actions', { playerId })
  const clearings = legal.body.actions[0]?.params?.clearing ?? []
  expectThat(clearings.length > 0, 'no legal clearing offered')
  return clearings[0]
}

async function saveVideo(player) {
  await player.context.close()
  const recorded = (await readdir(player.videoDirectory)).filter((file) => file.endsWith('.webm'))
  if (recorded.length === 0) return null
  const webmPath = path.join(artifactsDirectory, `${player.name}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${player.name}.mp4`)
  await copyFile(path.join(player.videoDirectory, recorded[0]), webmPath)
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { encoding: 'utf8' },
  )
  return ffmpeg.status === 0 ? mp4Path : webmPath
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  await apiRequest('DELETE', '/game')

  const browser = await chromium.launch({ headless: !isHeaded })
  const host = await openPlayer(browser, 'host')
  const guest = await openPlayer(browser, 'guest')
  const both = [host, guest]
  let hostPlayerId = null
  let guestPlayerId = null

  const steps = [
    [
      'Host creates an online lobby',
      async () => {
        await host.button('Host online game')
        await host.page.getByRole('button', { name: 'Start online game' }).waitFor()
        hostPlayerId = await host.playerId()
        expectThat(hostPlayerId !== null, 'host has no stored join id')
        const startEnabled = await host.page
          .getByRole('button', { name: 'Start online game' })
          .isEnabled()
        expectThat(!startEnabled, 'Start enabled before the lobby is full')
        return 'Lobby shown, Start disabled until seats fill'
      },
    ],
    [
      'Guest joins from a second browser',
      async () => {
        await guest.button('Join online game')
        await guest.page.getByText('Waiting for the host to start').waitFor()
        guestPlayerId = await guest.playerId()
        expectThat(guestPlayerId !== null && guestPlayerId !== hostPlayerId, 'bad guest join id')
        await host.page.getByRole('button', { name: 'Start online game' }).waitFor()
        await host.page.waitForFunction(() => {
          const start = [...document.querySelectorAll('button')].find(
            (button) => button.textContent?.trim() === 'Start online game',
          )
          return start !== undefined && !start.disabled
        })
        return 'Guest seated, host Start enabled'
      },
    ],
    [
      'Server: guest may not start the game',
      async () => {
        const guestStart = await apiRequest('POST', '/game/start', { playerId: guestPlayerId })
        expectThat(guestStart.status === 403, `guest start status ${guestStart.status}`)
        return '403 NOT_YOUR_SEAT'
      },
    ],
    [
      'Host starts; both browsers enter the game',
      async () => {
        await host.button('Start online game')
        await host.page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()
        await guest.page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()
        return 'Board visible in both browsers'
      },
    ],
    [
      'Each browser sees only its own hand',
      async () => {
        const hostView = await apiRequest('GET', '/game', { playerId: hostPlayerId })
        const guestView = await apiRequest('GET', '/game', { playerId: guestPlayerId })
        const hostSeesOwn = hostView.body.state.players[HOST_SEAT].hand.length
        const hostSeesGuest = hostView.body.state.players[GUEST_SEAT].hand.length
        const guestSeesOwn = guestView.body.state.players[GUEST_SEAT].hand.length
        const guestSeesHost = guestView.body.state.players[HOST_SEAT].hand.length
        expectThat(hostSeesOwn > 0 && guestSeesOwn > 0, 'own hand missing')
        expectThat(hostSeesGuest === 0 && guestSeesHost === 0, 'opponent hand leaked')
        expectThat(
          !JSON.stringify(guestView.body).includes(hostPlayerId),
          'host join id leaked to guest',
        )
        expectThat((await host.visibleHandCardCount()) === hostSeesOwn, 'host UI hand mismatch')
        expectThat((await guest.visibleHandCardCount()) === guestSeesOwn, 'guest UI hand mismatch')
        const dump = await apiRequest('GET', '/game/snapshot', { playerId: guestPlayerId })
        expectThat(dump.status === 403, `snapshot status ${dump.status}`)
        return `Own hands ${hostSeesOwn}/${guestSeesOwn} cards, opponent hands hidden, no id leak`
      },
    ],
    [
      'Server: guest cannot act on the Marquise setup choice',
      async () => {
        const clearing = await firstLegalClearing(hostPlayerId)
        const rejected = await apiRequest('POST', '/game/actions', {
          playerId: guestPlayerId,
          body: { type: 'resolveEvent', clearing },
        })
        expectThat(rejected.status === 403, `guest action status ${rejected.status}`)
        const anonymous = await apiRequest('POST', '/game/actions', {
          body: { type: 'resolveEvent', clearing },
        })
        expectThat(anonymous.status === 403, `anonymous action status ${anonymous.status}`)
        return 'Guest and anonymous requests rejected with 403'
      },
    ],
    [
      'Host (Marquise) places keep and starting buildings',
      async () => {
        for (let choice = 0; choice < 4; choice += 1) {
          await host.clearing(await firstLegalClearing(hostPlayerId))
        }
        await guest.page.getByText('Choose Eyrie leader').first().waitFor()
        return 'Setup passes to the guest (Eyrie leader)'
      },
    ],
    [
      'Guest (Eyrie) picks a leader in its own browser',
      async () => {
        // Exact match = the leader card overlay title, not the banner sentence.
        const hostHasLeaderOverlay = await host.page
          .getByText('Choose Eyrie leader', { exact: true })
          .first()
          .isVisible()
          .catch(() => false)
        expectThat(!hostHasLeaderOverlay, 'host was offered the Eyrie leader choice')
        await guest.page
          .getByText('Choose Eyrie leader', { exact: true })
          .first()
          .locator('..')
          .getByRole('button')
          .first()
          .click()
        await guest.page.waitForTimeout(1200)
        const view = await apiRequest('GET', '/game', { playerId: hostPlayerId })
        expectThat(view.body.state.status === 'playing', `status ${view.body.state.status}`)
        return 'Game is playing; Marquise turn 1'
      },
    ],
    [
      'Turn ownership: only the Marquise browser has actions',
      async () => {
        await host.page.waitForTimeout(800)
        const guestActions = await apiRequest('GET', '/game/actions', { playerId: guestPlayerId })
        expectThat(guestActions.body.actions.length === 0, 'guest was sent legal actions')
        expectThat(!(await guest.hasTrayActions()), 'guest sees an action tray off-turn')
        const hostActions = await apiRequest('GET', '/game/actions', { playerId: hostPlayerId })
        expectThat(hostActions.body.actions.length > 0, 'host has no legal actions')
        return `Host: ${hostActions.body.actions.length} legal actions · Guest: none, no tray`
      },
    ],
    [
      'Reload keeps the seat',
      async () => {
        await guest.page.reload({ waitUntil: 'networkidle' })
        await guest.page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()
        expectThat((await guest.playerId()) === guestPlayerId, 'guest join id changed')
        expectThat((await guest.visibleHandCardCount()) > 0, 'guest hand missing after reload')
        return 'Guest reloaded straight back into its seat'
      },
    ],
  ]

  for (const [title, play] of steps) {
    const passed = await runStep(title, both, play)
    if (!passed) break
  }

  const videos = [await saveVideo(host), await saveVideo(guest)]
  await browser.close()
  await apiRequest('DELETE', '/game')

  const failed = results.filter((row) => row.status === 'FAIL').length
  console.log(`\n${results.length - failed}/${steps.length} steps passed · videos: ${videos.join(', ')}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
