/**
 * Online multiplayer check: one separate browser per player (2–4 players).
 * Host creates an online lobby, guests join, host starts, everyone plays setup.
 * Verifies hidden information, turn ownership in the UI, server seat checks,
 * leaving / rejoining and reload.
 *
 * Needs both dev servers (pnpm dev:web, pnpm dev:react). Replaces the game
 * slot on the server (a live online game left by someone else blocks this:
 * its host must end it first).
 *
 *   node .agents/skills/QA/replay-online-two-players.mjs
 *   PLAYERS=4 node .agents/skills/QA/replay-online-two-players.mjs
 *   HEADED=1 STEP_PAUSE_MS=2500 PLAYERS=4 node .agents/skills/QA/replay-online-two-players.mjs
 *
 * Output: tmp/artifacts/online-players/<name>.{webm,mp4} (one per player)
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/online-players')

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const isHeaded = process.env.HEADED === '1'
const stepPauseMs = Number(process.env.STEP_PAUSE_MS ?? 1500)
const playerCount = Number(process.env.PLAYERS ?? 2)
const VIEWPORT = { width: 1280, height: 800 }
const CLICK_SETTLE_MS = 700
const SETUP_CHOICE_LIMIT = 20
const ROUND_ACTION_LIMIT = 80
const PLAYER_ID_HEADER = 'X-Player-Id'
const IDENTITY_STORAGE_KEY = 'root.react.playerIdentity'
const HIDDEN_CARD_DEFINITION_ID = 'HIDDEN'
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
async function openPlayer(browser, name, seat) {
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
  const player = {
    name,
    seat,
    page,
    context,
    videoDirectory,
    joinId: null,
    async button(label) {
      await page.getByRole('button', { name: label, exact: true }).first().click()
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
  return player
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

async function viewFor(player) {
  return (await apiRequest('GET', '/game', { playerId: player.joinId })).body
}

async function legalActionsFor(player) {
  return (await apiRequest('GET', '/game/actions', { playerId: player.joinId })).body.actions
}

/**
 * Setup is a chain of pending choices, each owned by one seat. Whoever is
 * offered legal actions answers in their own browser until play begins.
 */
async function playSetupThroughUi(players) {
  const answeredBy = []
  for (let choice = 0; choice < SETUP_CHOICE_LIMIT; choice += 1) {
    const status = (await viewFor(players[0])).state.status
    if (status === 'playing') return answeredBy
    let answered = false
    for (const player of players) {
      const params = (await legalActionsFor(player))[0]?.params
      if (params === undefined) continue
      if (params.clearing !== undefined) {
        await player.boardButton(`Clearing ${params.clearing[0]}`)
      } else if (params.forests !== undefined) {
        await player.boardButton(`Forest ${params.forests[0]}`)
      } else if (params.leaders !== undefined) {
        // Exact match = the leader card overlay title, not the banner sentence.
        await player.page
          .getByText('Choose Eyrie leader', { exact: true })
          .first()
          .locator('..')
          .getByRole('button')
          .first()
          .click()
        await player.page.waitForTimeout(CLICK_SETTLE_MS)
      } else {
        throw new Error(`unknown setup choice ${JSON.stringify(params)}`)
      }
      answeredBy.push(player.name)
      answered = true
      break
    }
    expectThat(answered, 'setup is stuck: no player was offered a choice')
  }
  throw new Error('setup did not finish')
}

/** Smallest legal action that moves the turn forward for the acting seat. */
function turnAdvancingAction(legalActions) {
  const byType = (type) => legalActions.find((spec) => spec.type === type)
  if (byType('endPhase')) return { type: 'endPhase' }
  const addToDecree = byType('addToDecree')
  if (addToDecree) return { type: 'addToDecree', cards: [addToDecree.params.options[0]] }
  const decree = byType('decree')
  if (decree) {
    // Eyrie must resolve its Decree: take the first legal choice for the card.
    const params = decree.params
    const target = params.targets?.[0]
    const decreeClearings = params.clearing ?? params.clearings
    return {
      type: 'decree',
      column: params.column[0],
      cardId: params.cardIds[0],
      ...(decreeClearings ? { clearing: decreeClearings[0] } : {}),
      ...(params.moves ? { moves: [params.moves[0]] } : {}),
      ...(target ? { clearing: target.clearing, defender: target.defender } : {}),
    }
  }
  const discard = byType('discard')
  if (discard) return { type: 'discard', cardIds: [discard.params.cardIds[0]] }
  // Pending event: prefer declining, else the first offered answer.
  const declinable = legalActions.find(
    (spec) => spec.type === 'resolveEvent' && spec.params?.decline,
  )
  if (declinable) return { type: 'resolveEvent', decline: true }
  const eventParams = byType('resolveEvent')?.params
  if (eventParams?.pieceIds) return { type: 'resolveEvent', pieceIds: eventParams.pieceIds }
  if (eventParams?.cardIds) return { type: 'resolveEvent', cardId: eventParams.cardIds[0] }
  if (eventParams?.vagabondItems) {
    return {
      type: 'resolveEvent',
      items: eventParams.vagabondItems.slice(0, eventParams.itemCount[0]),
    }
  }
  if (eventParams?.order) return { type: 'resolveEvent', order: eventParams.order[0] }
  if (eventParams?.useEffect) return { type: 'resolveEvent', useEffect: false }
  if (eventParams?.leaders) return { type: 'resolveEvent', leader: eventParams.leaders[0] }
  if (eventParams?.clearing) return { type: 'resolveEvent', clearing: eventParams.clearing[0] }
  if (eventParams?.forests) return { type: 'resolveEvent', forest: eventParams.forests[0] }
  if (eventParams) throw new Error(`unhandled pending event ${JSON.stringify(eventParams)}`)
  const parameterless = legalActions.find((spec) => spec.params === undefined)
  if (parameterless) return { type: parameterless.type }
  throw new Error(`no simple action among ${legalActions.map((spec) => spec.type).join(', ')}`)
}

/**
 * Each seat takes its turn with its own join id until the turn comes back to
 * the host. While a seat acts, only that browser may show an action tray.
 */
async function playOneRound(players) {
  const turnOrder = []
  for (let action = 0; action < ROUND_ACTION_LIMIT; action += 1) {
    const state = (await viewFor(players[0])).state
    if (state.turn > 1 && state.currentSeat === players[0].seat) return turnOrder
    let actor = null
    for (const player of players) {
      const legalActions = await legalActionsFor(player)
      if (legalActions.length === 0) continue
      actor = player
      if (turnOrder[turnOrder.length - 1] !== player.name) {
        turnOrder.push(player.name)
        await player.page.waitForTimeout(CLICK_SETTLE_MS)
        for (const other of players) {
          if (other === player) continue
          expectThat(
            !(await other.hasTrayActions()),
            `${other.name} sees a tray during ${player.name}'s turn`,
          )
        }
      }
      const chosenAction = turnAdvancingAction(legalActions)
      const sent = await apiRequest('POST', '/game/actions', {
        playerId: player.joinId,
        body: chosenAction,
      })
      // The player's own browser auto-ends a phase when that is the only
      // legal action, so it can beat this request: a rejected endPhase just
      // means the state already moved on. Re-read and carry on.
      const lostRaceToBrowser = sent.status !== 200 && chosenAction.type === 'endPhase'
      expectThat(
        sent.status === 200 || lostRaceToBrowser,
        `${player.name} ${JSON.stringify(chosenAction)} failed: ${JSON.stringify(sent.body)}`,
      )
      break
    }
    expectThat(actor !== null, 'round is stuck: no player has legal actions')
  }
  throw new Error('round did not come back to the host')
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
  expectThat(playerCount >= 2 && playerCount <= 4, 'PLAYERS must be 2, 3 or 4')
  await mkdir(artifactsDirectory, { recursive: true })
  const cleared = await apiRequest('DELETE', '/game')
  expectThat(
    cleared.status === 204,
    `cannot clear the game slot (${cleared.status}): a live online game is running; its host must end it`,
  )

  const browser = await chromium.launch({ headless: !isHeaded })
  const players = []
  for (let seat = 0; seat < playerCount; seat += 1) {
    players.push(await openPlayer(browser, seat === 0 ? 'host' : `guest${seat}`, seat))
  }
  const host = players[0]
  const guests = players.slice(1)
  const lastGuest = guests[guests.length - 1]

  const steps = [
    [
      `Host creates an online lobby for ${playerCount} players`,
      async () => {
        await host.button(String(playerCount))
        await host.button('Host online game')
        await host.page.getByRole('button', { name: 'Start online game' }).waitFor()
        host.joinId = await host.storedJoinId()
        expectThat(host.joinId !== null, 'host has no stored join id')
        const startEnabled = await host.page
          .getByRole('button', { name: 'Start online game' })
          .isEnabled()
        expectThat(!startEnabled, 'Start enabled before the lobby is full')
        return 'Lobby shown, Start disabled until seats fill'
      },
    ],
    [
      'Each guest joins from its own browser',
      async () => {
        for (const guest of guests) {
          await guest.button('Join online game')
          await guest.page.getByText('Waiting for the host to start').waitFor()
          guest.joinId = await guest.storedJoinId()
        }
        const joinIds = new Set(players.map((player) => player.joinId))
        expectThat(joinIds.size === playerCount && !joinIds.has(null), 'join ids not unique')
        await host.page.waitForFunction(() => {
          const start = [...document.querySelectorAll('button')].find(
            (button) => button.textContent?.trim() === 'Start online game',
          )
          return start !== undefined && !start.disabled
        })
        return `${guests.length} guest(s) seated, host Start enabled`
      },
    ],
    [
      'Server: a guest may not start, replace or delete the game',
      async () => {
        const guestStart = await apiRequest('POST', '/game/start', { playerId: lastGuest.joinId })
        expectThat(guestStart.status === 403, `guest start status ${guestStart.status}`)
        const guestDelete = await apiRequest('DELETE', '/game', { playerId: lastGuest.joinId })
        expectThat(guestDelete.status === 403, `guest delete status ${guestDelete.status}`)
        const strangerReplace = await apiRequest('POST', '/game?replace=1', {
          body: { factions: ['marquise', 'eyrie'] },
        })
        expectThat(strangerReplace.status === 403, `replace status ${strangerReplace.status}`)
        return 'All three rejected with 403'
      },
    ],
    [
      'Host starts; every browser enters the game',
      async () => {
        await host.button('Start online game')
        for (const player of players) await player.waitForBoard()
        return 'Board visible in every browser'
      },
    ],
    [
      'Hidden information: each browser sees only its own secrets',
      async () => {
        const handSizes = []
        for (const viewer of players) {
          const view = await viewFor(viewer)
          const viewText = JSON.stringify(view)
          const log = (await apiRequest('GET', '/game/log', { playerId: viewer.joinId })).body
          const logText = JSON.stringify(log)
          for (const other of players) {
            const hand = view.state.players[other.seat].hand
            if (other === viewer) {
              expectThat(hand.length > 0, `${viewer.name}: own hand missing`)
              handSizes.push(hand.length)
              expectThat(
                (await viewer.visibleHandCardCount()) === hand.length,
                `${viewer.name}: UI hand does not match`,
              )
            } else {
              expectThat(hand.length === 0, `${viewer.name} sees ${other.name}'s hand`)
              expectThat(!viewText.includes(other.joinId), `${other.name} join id leaked in state`)
              expectThat(!logText.includes(other.joinId), `${other.name} join id leaked in log`)
            }
          }
          const drawPile = view.state.deck.draw
          expectThat(drawPile.length > 0, 'draw pile size missing')
          expectThat(
            drawPile.every((card) => card.defId === HIDDEN_CARD_DEFINITION_ID),
            `${viewer.name} can read the draw pile`,
          )
          const dump = await apiRequest('GET', '/game/snapshot', { playerId: viewer.joinId })
          expectThat(dump.status === 403, `snapshot status ${dump.status}`)
        }
        return `Own hands ${handSizes.join('/')} cards; other hands, join ids, draw pile hidden`
      },
    ],
    [
      'Server: a wrong seat cannot answer the Marquise setup choice',
      async () => {
        const clearing = (await legalActionsFor(host))[0].params.clearing[0]
        const rejected = await apiRequest('POST', '/game/actions', {
          playerId: lastGuest.joinId,
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
      'Setup: every choice is answered in the owning player browser',
      async () => {
        const answeredBy = await playSetupThroughUi(players)
        return `${answeredBy.length} choices by ${[...new Set(answeredBy)].join(', ')} → playing`
      },
    ],
    [
      'Turn ownership: only the current player has actions',
      async () => {
        await host.page.waitForTimeout(800)
        const hostActions = await legalActionsFor(host)
        expectThat(hostActions.length > 0, 'host has no legal actions')
        for (const guest of guests) {
          expectThat((await legalActionsFor(guest)).length === 0, `${guest.name} was sent actions`)
          expectThat(!(await guest.hasTrayActions()), `${guest.name} sees a tray off-turn`)
        }
        return `Host: ${hostActions.length} legal actions · guests: none, no tray`
      },
    ],
    [
      'A full round: the turn passes from browser to browser',
      async () => {
        const turnOrder = await playOneRound(players)
        expectThat(
          turnOrder.length >= playerCount,
          `only ${turnOrder.join(' → ')} took a turn`,
        )
        await host.page.waitForTimeout(800)
        expectThat(await host.hasTrayActions(), 'host has no tray when the turn returns')
        return `${turnOrder.join(' → ')} → host (turn 2)`
      },
    ],
    [
      'Guest "End game" only leaves; Join takes the seat back',
      async () => {
        await lastGuest.button('End game')
        await lastGuest.button('Confirm end?')
        await lastGuest.page.getByRole('button', { name: 'Join online game' }).waitFor()
        const stillThere = await viewFor(host)
        expectThat(stillThere.state.status === 'playing', 'game was ended by a guest')
        await lastGuest.button('Join online game')
        await lastGuest.waitForBoard()
        expectThat((await lastGuest.storedJoinId()) === lastGuest.joinId, 'guest got a new seat')
        return 'Game kept running; guest back in the same seat'
      },
    ],
    [
      'Reload keeps the seat',
      async () => {
        await lastGuest.page.reload({ waitUntil: 'networkidle' })
        await lastGuest.waitForBoard()
        expectThat((await lastGuest.storedJoinId()) === lastGuest.joinId, 'join id changed')
        expectThat((await lastGuest.visibleHandCardCount()) > 0, 'hand missing after reload')
        return 'Guest reloaded straight back into its seat'
      },
    ],
  ]

  for (const [title, play] of steps) {
    const passed = await runStep(title, players, play)
    if (!passed) break
  }

  const videos = []
  for (const player of players) videos.push(await saveVideo(player))
  await browser.close()
  // Only the host may remove a live online game.
  await apiRequest('DELETE', '/game', { playerId: host.joinId })

  const failed = results.filter((row) => row.status === 'FAIL').length
  console.log(`\n${results.length - failed}/${steps.length} steps passed · videos:\n  ${videos.join('\n  ')}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
