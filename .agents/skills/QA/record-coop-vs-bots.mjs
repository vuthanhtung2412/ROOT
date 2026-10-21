/**
 * Online co-op vs bots (Rootbotics 3.5.1): host + guest, each in its own
 * browser. Host switches the lobby to co-op, adds both bots, tunes one,
 * starts; both play setup; bots run on the server at the host's pace; the
 * host speeds the pace up, the guest sees it locked. Last: the co-op end
 * screen from a crafted finished snapshot (both humans at 30).
 *
 * Needs both dev servers (pnpm dev:web, pnpm dev:react). Replaces the game slot.
 *
 *   node .agents/skills/QA/record-coop-vs-bots.mjs
 *   HEADED=1 STEP_PAUSE_MS=2500 node .agents/skills/QA/record-coop-vs-bots.mjs
 *
 * Output: tmp/artifacts/coop-vs-bots/<name>.{webm,mp4} (host, guest, end
 * screen) + side-by-side host|guest mp4.
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/coop-vs-bots')
const END_SCREEN_SNAPSHOT_NAME = 'coop-vs-bots-woodland-holds.json'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const isHeaded = process.env.HEADED === '1'
const stepPauseMs = Number(process.env.STEP_PAUSE_MS ?? 1500)
const VIEWPORT = { width: 1280, height: 800 }
const CLICK_SETTLE_MS = 700
const SETUP_CHOICE_LIMIT = 30
const ROUND_ACTION_LIMIT = 600
const BOT_WAIT_POLL_MS = 500
const BOT_TURN_TIMEOUT_MS = 180_000
const GUEST_PACE_FOLLOW_TIMEOUT_MS = 6_000
const PACE_POLL_MS = 100
const PLAYER_ID_HEADER = 'X-Player-Id'
const IDENTITY_STORAGE_KEY = 'root.react.playerIdentity'
const HUMAN_FACTIONS = ['alliance', 'vagabond']
const BOT_FACTIONS = ['mechanicalMarquise', 'electricEyrie']
const LOCKED_PACE_PREFIX = 'Bot pace, set by the host'
const HOST_PACE_PREFIX = 'Bot pace, click for faster'

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
    joinId: null,
    seat: null,
    async button(label) {
      await page.getByRole('button', { name: label, exact: true }).first().click()
      await settle()
    },
    async pickFaction(factionId) {
      await page.locator(`[data-faction="${factionId}"]`).first().click()
      await settle()
    },
    async boardButton(label) {
      await page.getByRole('button', { name: label, exact: true }).click({ force: true })
      await settle()
    },
    async waitForBoard() {
      await page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()
    },
    async storedJoinId() {
      const raw = await page.evaluate(
        (storageKey) => sessionStorage.getItem(storageKey),
        IDENTITY_STORAGE_KEY,
      )
      return raw === null ? null : JSON.parse(raw).playerId
    },
    async paceButtonLabel() {
      // The banner re-renders on every bot step: read the DOM in one go.
      return page.evaluate(() => {
        const pace = document.querySelector('button[aria-label^="Bot pace"]')
        return pace === null ? null : `${pace.getAttribute('aria-label')}${pace.disabled ? ' [disabled]' : ''}`
      })
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
          caption.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;left:12px;bottom:70px;width:340px;background:${colors[captionStatus] ?? '#1f2937'};color:#fff;font:600 16px/1.3 system-ui;padding:10px 12px;border-radius:8px;box-shadow:0 2px 8px #0008`
          caption.textContent = `${playerName.toUpperCase()} · ${captionStatus ? `[${captionStatus}] ` : ''}${captionText}`
        },
        { captionText: text, captionStatus: status ?? null, playerName: name },
      )
    },
  }
}

async function runStep(title, players, play) {
  for (const player of players) await player.caption(title).catch(() => undefined)
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
  for (const player of players) {
    await player.caption(`${title} — ${detail}`, status).catch(() => undefined)
  }
  await players[0].page.waitForTimeout(stepPauseMs)
  return status === 'PASS'
}

async function viewFor(player) {
  return (await apiRequest('GET', '/game', { playerId: player.joinId })).body
}

async function legalActionsFor(player) {
  return (await apiRequest('GET', '/game/actions', { playerId: player.joinId })).body?.actions ?? []
}

/** First legal answer for a setup choice, sent over the API (UI path unknown). */
function firstSetupAnswer(params) {
  if (params.characters) return { type: 'resolveEvent', character: params.characters[0] }
  if (params.forests) return { type: 'resolveEvent', forest: params.forests[0] }
  if (params.clearing) return { type: 'resolveEvent', clearing: params.clearing[0] }
  if (params.leaders) return { type: 'resolveEvent', leader: params.leaders[0] }
  return null
}

/**
 * Setup is a chain of pending choices. Humans answer in their own browser
 * (board button when it is a clearing / forest), bots answer on the server.
 */
async function playSetup(players) {
  const answeredBy = []
  const deadline = Date.now() + BOT_TURN_TIMEOUT_MS
  while (Date.now() < deadline && answeredBy.length < SETUP_CHOICE_LIMIT) {
    const status = (await viewFor(players[0])).state.status
    if (status === 'playing') return answeredBy
    let answered = false
    for (const player of players) {
      const spec = (await legalActionsFor(player))[0]
      if (spec === undefined) continue
      const params = spec.params ?? {}
      if (params.clearing !== undefined) {
        await player.boardButton(`Clearing ${params.clearing[0]}`)
      } else if (params.forests !== undefined) {
        await player.boardButton(`Forest ${params.forests[0]}`)
      } else {
        const answer = firstSetupAnswer(params) ?? { type: spec.type }
        const sent = await apiRequest('POST', '/game/actions', {
          playerId: player.joinId,
          body: answer,
        })
        expectThat(sent.status === 200, `${player.name} setup ${JSON.stringify(answer)} → ${JSON.stringify(sent.body)}`)
        await player.page.waitForTimeout(CLICK_SETTLE_MS)
      }
      answeredBy.push(`${player.name}:${spec.type}`)
      answered = true
      break
    }
    if (!answered) await players[0].page.waitForTimeout(BOT_WAIT_POLL_MS)
  }
  throw new Error(`setup did not finish (${answeredBy.join(', ')})`)
}

/** Smallest legal action that moves the turn forward for a human seat. */
function turnAdvancingAction(legalActions) {
  const byType = (type) => legalActions.find((spec) => spec.type === type)
  if (byType('endPhase')) return { type: 'endPhase' }
  const discard = byType('discard')
  if (discard) return { type: 'discard', cardIds: [discard.params.cardIds[0]] }
  const declinable = legalActions.find(
    (spec) => spec.type === 'resolveEvent' && spec.params?.decline,
  )
  if (declinable) return { type: 'resolveEvent', decline: true }
  const eventParams = byType('resolveEvent')?.params
  if (eventParams?.pieceIds) return { type: 'resolveEvent', pieceIds: eventParams.pieceIds }
  if (eventParams?.cardIds) return { type: 'resolveEvent', cardId: eventParams.cardIds[0] }
  if (eventParams?.vagabondItems) {
    return { type: 'resolveEvent', items: eventParams.vagabondItems.slice(0, eventParams.itemCount[0]) }
  }
  if (eventParams?.useEffect) return { type: 'resolveEvent', useEffect: false }
  if (eventParams?.clearing) return { type: 'resolveEvent', clearing: eventParams.clearing[0] }
  if (eventParams) throw new Error(`unhandled pending event ${JSON.stringify(eventParams)}`)
  const parameterless = legalActions.find((spec) => spec.params === undefined)
  if (parameterless) return { type: parameterless.type }
  throw new Error(`no simple action among ${legalActions.map((spec) => spec.type).join(', ')}`)
}

async function isBotSeatActing(player) {
  const state = (await viewFor(player)).state
  const current = state.players.find((candidate) => candidate.seat === state.currentSeat)
  return { state, isBot: BOT_FACTIONS.includes(current?.faction) }
}

/**
 * Humans end their phases over the API; bots play on the server. While a bot
 * acts, `onBotTurn` runs once per bot seat (pace checks live there).
 */
async function playOneRound(players, onBotTurn) {
  const turnOrder = []
  const deadline = Date.now() + BOT_TURN_TIMEOUT_MS * 2
  for (let action = 0; action < ROUND_ACTION_LIMIT && Date.now() < deadline; action += 1) {
    const { state, isBot } = await isBotSeatActing(players[0])
    if (state.status !== 'playing') return turnOrder
    const isBackToHost = turnOrder.length > 1 && state.currentSeat === players[0].seat
    if (isBackToHost) return turnOrder
    const seatLabel = state.players.find((candidate) => candidate.seat === state.currentSeat).faction
    if (turnOrder[turnOrder.length - 1] !== seatLabel) {
      turnOrder.push(seatLabel)
      if (isBot) await onBotTurn(seatLabel)
    }
    if (isBot) {
      await players[0].page.waitForTimeout(BOT_WAIT_POLL_MS)
      continue
    }
    let acted = false
    for (const player of players) {
      const legalActions = await legalActionsFor(player)
      if (legalActions.length === 0) continue
      const chosenAction = turnAdvancingAction(legalActions)
      const sent = await apiRequest('POST', '/game/actions', { playerId: player.joinId, body: chosenAction })
      const lostRaceToBrowser = sent.status !== 200 && chosenAction.type === 'endPhase'
      expectThat(
        sent.status === 200 || lostRaceToBrowser,
        `${player.name} ${JSON.stringify(chosenAction)} failed: ${JSON.stringify(sent.body)}`,
      )
      await player.page.waitForTimeout(CLICK_SETTLE_MS)
      acted = true
      break
    }
    if (!acted) await players[0].page.waitForTimeout(BOT_WAIT_POLL_MS)
  }
  throw new Error(`round did not come back to the host: ${turnOrder.join(' → ')}`)
}

async function saveVideo(player) {
  await player.context.close()
  const recorded = (await readdir(player.videoDirectory)).filter((file) => file.endsWith('.webm'))
  if (recorded.length === 0) return null
  const unusedVideoName = await pickUnusedVideoName(artifactsDirectory, player.name)
  const webmPath = path.join(artifactsDirectory, `${unusedVideoName}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${unusedVideoName}.mp4`)
  await copyFile(path.join(player.videoDirectory, recorded[0]), webmPath)
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { encoding: 'utf8' },
  )
  return ffmpeg.status === 0 ? mp4Path : webmPath
}

/** Host | guest side by side, scaled to one 1280-wide review video. */
async function saveSideBySide(hostVideo, guestVideo) {
  const unusedVideoName = await pickUnusedVideoName(artifactsDirectory, 'host-guest-side-by-side')
  const outputPath = path.join(artifactsDirectory, `${unusedVideoName}.mp4`)
  const ffmpeg = spawnSync(
    'ffmpeg',
    [
      '-i', hostVideo, '-i', guestVideo,
      '-filter_complex', '[0:v]scale=960:-2[left];[1:v]scale=960:-2[right];[left][right]hstack=inputs=2:shortest=0',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath,
    ],
    { encoding: 'utf8' },
  )
  return ffmpeg.status === 0 ? outputPath : null
}

/** Co-op game with both humans at 30 VP (make-coop-end-screen-snapshot.ts). */
function writeEndScreenSnapshot() {
  const maker = spawnSync(
    'pnpm',
    ['exec', 'tsx', path.join(skillDirectory, 'make-coop-end-screen-snapshot.ts')],
    { cwd: path.join(rootDirectory, 'lib'), encoding: 'utf8' },
  )
  expectThat(maker.status === 0, `snapshot maker failed: ${maker.stderr}`)
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const cleared = await apiRequest('DELETE', '/game')
  expectThat(cleared.status === 204 || cleared.status === 404, `cannot clear the game slot (${cleared.status})`)

  const browser = await chromium.launch({ headless: !isHeaded })
  const host = await openPlayer(browser, 'host')
  const guest = await openPlayer(browser, 'guest')
  const players = [host, guest]
  const paceSeen = { host: [], guest: [] }

  /**
   * During a bot turn: host pace button live, guest's locked. Until the pace
   * is 1 s, the host clicks it once and the guest's label must follow. A bot
   * turn may end first (banner gone): then the next bot turn tries again.
   */
  async function speedUpPaceDuringBotTurn(botFaction) {
    const shown = await host.page
      .waitForFunction(() => document.querySelector('button[aria-label^="Bot pace"]') !== null, null, { timeout: 20_000 })
      .then(() => true, () => false)
    if (!shown) return
    await host.page.waitForTimeout(stepPauseMs)
    const hostLabel = await host.paceButtonLabel()
    const guestLabel = await guest.paceButtonLabel()
    if (hostLabel === null || guestLabel === null) return
    paceSeen.host.push(`${botFaction}: ${hostLabel}`)
    paceSeen.guest.push(`${botFaction}: ${guestLabel}`)
    expectThat(hostLabel.startsWith(HOST_PACE_PREFIX) && !hostLabel.includes('[disabled]'), `host pace label: ${hostLabel}`)
    expectThat(guestLabel.startsWith(LOCKED_PACE_PREFIX) && guestLabel.includes('[disabled]'), `guest pace label: ${guestLabel}`)
    if (hostLabel.includes('(1 s')) return
    // The banner never settles for Playwright's click checks: click its spot.
    const paceCenter = await host.page.evaluate(() => {
      const pace = document.querySelector('button[aria-label^="Bot pace"]')
      if (pace === null) return null
      const box = pace.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    })
    if (paceCenter === null) return
    await host.page.mouse.click(paceCenter.x, paceCenter.y)
    const clickedAt = Date.now()
    let hostAfter = await host.paceButtonLabel()
    while (hostAfter === hostLabel && Date.now() - clickedAt < GUEST_PACE_FOLLOW_TIMEOUT_MS) {
      await host.page.waitForTimeout(PACE_POLL_MS)
      hostAfter = await host.paceButtonLabel()
    }
    paceSeen.host.push(`host label changed (+${Date.now() - clickedAt} ms): ${hostAfter}`)
    let guestAfter = await guest.paceButtonLabel()
    while (guestAfter === guestLabel && Date.now() - clickedAt < GUEST_PACE_FOLLOW_TIMEOUT_MS) {
      await guest.page.waitForTimeout(PACE_POLL_MS)
      guestAfter = await guest.paceButtonLabel()
    }
    if (guestAfter === null) return
    paceSeen.guest.push(`after host click (+${Date.now() - clickedAt} ms): ${guestAfter}`)
    expectThat(guestAfter !== guestLabel, `guest pace did not follow the host: ${paceSeen.guest.join(' | ')}`)
  }

  const steps = [
    [
      'Host creates the game and switches to Co-op vs bots',
      async () => {
        await host.button('Create game')
        await host.pickFaction(HUMAN_FACTIONS[0])
        await host.page.locator('[data-play-mode="cooperative"]').click()
        await host.page.locator('[data-play-mode="cooperative"][aria-pressed="true"]').waitFor()
        await host.page.waitForTimeout(CLICK_SETTLE_MS)
        host.joinId = await host.storedJoinId()
        expectThat(host.joinId !== null, 'host has no stored join id')
        await host.page.getByRole('button', { name: 'Start co-op game' }).hover({ force: true })
        await host.page.getByText('Needs 2 human players').first().waitFor()
        await host.page.waitForTimeout(stepPauseMs)
        const start = host.page.getByRole('button', { name: 'Start co-op game' })
        expectThat(await start.isDisabled(), 'Start enabled with one human')
        return 'Co-op on, host seated, Start disabled: "Needs 2 human players"'
      },
    ],
    [
      'Host adds Mechanical Marquise and Electric Eyrie from the bot picker',
      async () => {
        for (const bot of BOT_FACTIONS) {
          await host.page.getByRole('button', { name: 'Add a bot', exact: true }).click()
          await host.page.waitForTimeout(CLICK_SETTLE_MS)
          await host.pickFaction(bot)
        }
        const factions = (await viewFor(host)).state.players.map((player) => player.faction)
        expectThat(BOT_FACTIONS.every((bot) => factions.includes(bot)), `bots missing: ${factions}`)
        return `Seats: ${factions.join(', ')}`
      },
    ],
    [
      'Host tunes Electric Eyrie (difficulty Challenging)',
      async () => {
        await host.page.getByRole('button', { name: /Difficulty and traits of Electric Eyrie/ }).first().click()
        await host.page.waitForTimeout(CLICK_SETTLE_MS)
        const dialog = host.page.getByRole('dialog', { name: /difficulty and traits/ })
        await dialog.getByRole('button', { name: /^Challenging/ }).click()
        await host.page.waitForTimeout(CLICK_SETTLE_MS)
        await dialog.getByRole('button', { name: 'Done', exact: true }).click()
        await host.page.waitForTimeout(CLICK_SETTLE_MS)
        return 'Settings modal opened, difficulty changed, closed'
      },
    ],
    [
      'Guest joins: mode switch locked, takes the 2nd Woodland seat',
      async () => {
        await guest.button('Join game')
        const guestCoopButton = guest.page.locator('[data-play-mode="cooperative"]')
        expectThat(await guestCoopButton.isDisabled(), 'guest can change the play mode')
        const guestAddBot = await guest.page.getByRole('button', { name: 'Add a bot', exact: true }).count()
        expectThat(guestAddBot === 0, 'guest sees "Add a bot"')
        const guestRemoveBot = await guest.page.getByRole('button', { name: /^Remove (Mechanical Marquise|Electric Eyrie)/ }).count()
        expectThat(guestRemoveBot === 0, 'guest can remove a bot')
        await guest.pickFaction(HUMAN_FACTIONS[1])
        guest.joinId = await guest.storedJoinId()
        await host.page.waitForFunction(() => {
          const start = [...document.querySelectorAll('button')].find(
            (button) => button.textContent?.trim() === 'Start co-op game',
          )
          return start !== undefined && !start.disabled
        })
        return 'Guest seated; mode locked; no add / remove bot; host Start enabled'
      },
    ],
    [
      'Guest opens bot settings: read-only',
      async () => {
        await guest.page.getByRole('button', { name: /Difficulty and traits of Electric Eyrie/ }).first().click()
        await guest.page.waitForTimeout(CLICK_SETTLE_MS)
        const dialog = guest.page.getByRole('dialog', { name: /difficulty and traits/ })
        // Disabled through the parent <fieldset>: ask Playwright, not the attribute.
        const choices = await dialog.locator('section button').all()
        let enabledChoices = 0
        for (const choice of choices) if (await choice.isEnabled()) enabledChoices += 1
        await guest.page.waitForTimeout(stepPauseMs)
        await dialog.getByRole('button', { name: 'Done', exact: true }).click()
        await guest.page.waitForTimeout(CLICK_SETTLE_MS)
        expectThat(enabledChoices === 0, `${enabledChoices} enabled choices for a guest`)
        return 'Every difficulty / trait choice disabled for the guest'
      },
    ],
    [
      'Server: guest may not change mode, add a bot or set the pace',
      async () => {
        const mode = await apiRequest('PUT', '/game/play-mode', { playerId: guest.joinId, body: { playMode: 'freeForAll' } })
        const removeBot = await apiRequest('DELETE', '/game/players/3', { playerId: guest.joinId })
        const pace = await apiRequest('PUT', '/game/bot-pace', { playerId: guest.joinId, body: { botStepDelaySeconds: 1 } })
        const twin = await apiRequest('POST', '/game/bots', { playerId: host.joinId, body: { faction: 'mechanicalMarquise' } })
        expectThat(mode.status === 403, `mode ${mode.status}`)
        expectThat(removeBot.status === 403, `remove bot ${removeBot.status}`)
        expectThat(pace.status === 403, `pace ${pace.status}`)
        expectThat(twin.status >= 400, `duplicate bot ${twin.status}`)
        return `mode/remove/pace → 403; duplicate bot → ${twin.status}`
      },
    ],
    [
      'Host starts; both browsers enter the game',
      async () => {
        await host.button('Start co-op game')
        for (const player of players) await player.waitForBoard()
        const state = (await viewFor(host)).state
        host.seat = state.players.find((player) => player.faction === HUMAN_FACTIONS[0]).seat
        guest.seat = state.players.find((player) => player.faction === HUMAN_FACTIONS[1]).seat
        expectThat(state.cooperative === true, 'state.cooperative not set')
        return `cooperative=true · seats ${state.players.map((player) => `${player.seat}:${player.faction}`).join(' ')}`
      },
    ],
    [
      'Setup: humans answer in their browser, bots on the server',
      async () => {
        const answeredBy = await playSetup(players)
        return `${answeredBy.length} choices (${answeredBy.join(', ')}) → playing`
      },
    ],
    [
      'Round 1: bots play paced; host speeds up 5 → 2 → 1 s, guest sees it locked',
      async () => {
        const turnOrder = await playOneRound(players, speedUpPaceDuringBotTurn)
        expectThat(paceSeen.guest.some((seen) => seen.startsWith('after host click')), 'no pace change seen by the guest')
        return `${turnOrder.join(' → ')} · host pace: ${paceSeen.host.join(' | ')} · guest pace: ${paceSeen.guest.join(' | ')}`
      },
    ],
    [
      'Rounds 2–3: bots keep the host pace',
      async () => {
        const turnOrder = [
          ...(await playOneRound(players, speedUpPaceDuringBotTurn)),
          ...(await playOneRound(players, speedUpPaceDuringBotTurn)),
        ]
        const view = await viewFor(host)
        const scores = view.state.players
          .map((player) => `${player.faction} ${player.vp}`)
          .join(' · ')
        return `${turnOrder.join(' → ')} · ${scores} · pace ${await host.paceButtonLabel() ?? paceSeen.host.at(-1)}`
      },
    ],
    [
      'Co-op: bots never battle each other (log check)',
      async () => {
        const log = (await apiRequest('GET', '/game/log', { playerId: host.joinId })).body
        const entries = log.log
        const botSeats = (await viewFor(host)).state.players
          .filter((player) => BOT_FACTIONS.includes(player.faction))
          .map((player) => player.seat)
        const battleEntries = entries.filter(
          (entry) => entry.t === 'action' && /battle/i.test(entry.action.type),
        )
        const botOnBot = battleEntries.filter(
          (entry) => botSeats.includes(entry.actor) && botSeats.includes(entry.action.defender),
        )
        expectThat(botOnBot.length === 0, `bot vs bot battles: ${JSON.stringify(botOnBot)}`)
        const battles = battleEntries.length
        return `${entries.length} log entries, ${battles} battles, none bot vs bot`
      },
    ],
  ]

  for (const [title, play] of steps) {
    const passed = await runStep(title, players, play)
    if (!passed) break
  }

  const hostVideo = await saveVideo(host)
  const guestVideo = await saveVideo(guest)
  await apiRequest('DELETE', '/game', { playerId: host.joinId })
  const sideBySide = hostVideo && guestVideo ? await saveSideBySide(hostVideo, guestVideo) : null

  // End screen: crafted finished co-op snapshot, autoloaded in one browser.
  writeEndScreenSnapshot()
  const endScreen = await openPlayer(browser, 'end-screen')
  const endStepTitle = 'Co-op end screen: "The Woodland holds" with both teams\' scores'
  await runStep(endStepTitle, [endScreen], async () => {
    await endScreen.page.goto(
      `${reactUiUrl}/?qaSnapshot=tmp/qa/snapshots/${END_SCREEN_SNAPSHOT_NAME}`,
      { waitUntil: 'networkidle' },
    )
    await endScreen.page.getByRole('button', { name: 'QA: Continue loaded game' }).click()
    await endScreen.page.getByText('The Woodland holds').first().waitFor({ timeout: 15_000 })
    const scoreLine = await endScreen.page.getByText(/ — Mechanical Marquise/).first().textContent()
    await endScreen.page.waitForTimeout(stepPauseMs * 2)
    return `Title shown · ${scoreLine?.trim()}`
  })
  const endVideo = await saveVideo(endScreen)
  await browser.close()
  await apiRequest('DELETE', '/game')

  const failed = results.filter((row) => row.status === 'FAIL').length
  console.log(`\n${results.length - failed}/${steps.length + 1} steps passed · videos:\n  ${[hostVideo, guestVideo, sideBySide, endVideo].join('\n  ')}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
