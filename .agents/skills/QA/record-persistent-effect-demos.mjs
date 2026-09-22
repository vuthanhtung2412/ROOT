/**
 * Frontend QA: video demos of persistent card EFFECTS (not board chrome).
 *
 * Usage:
 *   ROOT_PHASER_URL=http://localhost:5173 node .cursor/skills/QA/record-persistent-effect-demos.mjs
 *   ROOT_PHASER_URL=http://localhost:5173 node .cursor/skills/QA/record-persistent-effect-demos.mjs boat-builders
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { mkdir, readFile, writeFile, readdir, copyFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight, flashGameClick } from './click-highlight.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/persistent-effects')
const snapshotsDirectory = path.join(rootDirectory, 'tmp/qa/snapshots')
const phaserUrl = process.env.ROOT_PHASER_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_API ?? 'http://localhost:3000'
const onlySlug = process.argv[2]

/** @type {Record<string, (game: any) => boolean>} */
const ASSERTS = {
  'boat-builders': (g) =>
    g.state.clearings[6].pieces.some((p) => p.kind === 'warrior' && p.owner === 0),
  'charm-offensive': (g) =>
    g.state.turnScratch.charmOffensiveUsed === true && g.state.players[1].vp >= 1,
  'coffin-makers': (g) => g.state.players[0].vp === 2,
  'corvid-planners': (g) =>
    g.state.clearings[5].pieces.some((p) => p.kind === 'warrior' && p.owner === 0),
  'eyrie-emigre': (g) =>
    g.state.turnScratch.eyrieEmigreCompleted === true &&
    g.state.pending.some((e) => e.type === 'battle'),
  'false-orders': (g) =>
    g.state.clearings[2].pieces.filter((p) => p.owner === 1).length === 1 &&
    g.state.clearings[5].pieces.filter((p) => p.owner === 1).length === 2,
  informants: (g) =>
    g.state.players[0].hand.some((c) => c.id === 'ROOT-200#demo') &&
    !g.state.deck.discard.some((c) => c.id === 'ROOT-200#demo'),
  'league-mice': (g) =>
    g.state.players[0].craftedItems[0]?.exhausted === true &&
    g.state.turnScratch.leagueUsed === true,
  'master-engravers': (g) => g.state.players[0].vp >= 3,
  'murine-broker': (g) =>
    g.state.players[1].hand.some((c) => c.id === 'ROOT-209#draw'),
  'propaganda-bureau': (g) =>
    !g.state.clearings[0].pieces.some((p) => p.id === 'enemy-w') &&
    g.state.turnScratch.propagandaUsed === true,
  saboteurs: (g) =>
    !g.state.players[0].playArea.some((c) => c.defId === 'ROOT-93') &&
    !g.state.players[1].playArea.some((c) => c.id === 'ROOT-57#enemy'),
  'soup-kitchens': (g) => g.state.pending.some((e) => e.type === 'battle'),
  'swap-meet': (g) =>
    g.state.players[0].hand.some((c) => c.id === 'ROOT-211#take') &&
    g.state.turnScratch.swapMeetUsed === true,
  tunnels: (g) =>
    g.state.clearings[2].pieces.filter((p) => p.kind === 'warrior' && p.owner === 0)
      .length >= 2,
}

async function loadSnapshot(relativePath) {
  const snapshotPath = path.join(snapshotsDirectory, relativePath)
  const load = spawnSync(
    'pnpm',
    ['--filter', '@root/cli', 'start', '--', 'load', snapshotPath],
    {
      cwd: rootDirectory,
      env: { ...process.env, ROOT_API: apiUrl },
      encoding: 'utf8',
    },
  )
  if (load.status !== 0) {
    throw new Error(`cli load failed:\n${load.stdout}\n${load.stderr}`)
  }
  console.log(load.stdout.trim())
}

async function cliAct(action) {
  const act = spawnSync(
    'pnpm',
    ['--filter', '@root/cli', 'start', '--', 'act', JSON.stringify(action)],
    {
      cwd: rootDirectory,
      env: { ...process.env, ROOT_API: apiUrl },
      encoding: 'utf8',
    },
  )
  if (act.status !== 0) {
    throw new Error(`cli act failed:\n${act.stdout}\n${act.stderr}`)
  }
  console.log(act.stdout.trim())
}

async function fetchGame() {
  const response = await fetch(`${apiUrl}/game`)
  if (!response.ok) throw new Error(`GET /game ${response.status}`)
  return response.json()
}

async function fetchActions() {
  const response = await fetch(`${apiUrl}/game/actions`)
  if (!response.ok) throw new Error(`GET /game/actions ${response.status}`)
  const body = await response.json()
  return body.actions
}

async function clickGame(page, canvas, gameX, gameY) {
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('canvas missing')
  await page.mouse.click(
    box.x + gameX * (box.width / 1280),
    box.y + gameY * (box.height / 720),
  )
}

async function qaContinue(page, canvas) {
  await clickGame(page, canvas, 640, 720 * 0.6)
  await page.waitForTimeout(2500)
}

async function waitForGame(predicate, label, timeoutMs = 15_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const game = await fetchGame()
    if (predicate(game)) return game
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`timeout waiting for ${label}`)
}

async function waitForPhaser(page, predicate, label, timeoutMs = 12_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await page.evaluate(predicate)
    if (value) return value
    await page.waitForTimeout(200)
  }
  throw new Error(`timeout Phaser ${label}`)
}

/** Click tray button by action type index among actor 0 actions. */
async function clickTrayAction(page, canvas, actionType) {
  const actions = await fetchActions()
  const actorActions = actions.filter((a) => a.actor === 0)
  const index = actorActions.findIndex((a) => a.type === actionType)
  if (index < 0) {
    console.log(`tray miss ${actionType}; have ${actorActions.map((a) => a.type).join(',')}`)
    return false
  }
  const trayX = 1280 - 160
  const trayY = 56 + 28 + index * 34 + 10
  await clickGame(page, canvas, trayX, trayY)
  await flashGameClick(page, canvas, trayX, trayY)
  await page.waitForTimeout(600)
  return true
}

async function submitViaPhaser(page, action) {
  return page.evaluate(async (payload) => {
    const scene = window.__ROOT_PHASER_GAME__?.scene.getScene('GameScene')
    if (!scene?.session) return { ok: false, reason: 'no session' }
    try {
      await scene.session.submitAction(payload)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: String(error) }
    }
  }, action)
}

async function advanceToNextBirdsongSeat0() {
  // Full Marquise turn skip until birdsong returns (coffin score).
  for (let guard = 0; guard < 80; guard++) {
    const game = await fetchGame()
    if (
      game.state.phase === 'birdsong' &&
      game.state.currentSeat === 0 &&
      game.state.turn > 1
    ) {
      return game
    }
    while (true) {
      const pending = (await fetchGame()).state.pending[0]
      if (!pending) break
      if (pending.type === 'battle') {
        const actions = await fetchActions()
        const decline = actions.find(
          (a) => a.type === 'resolveEvent' && a.params?.decline,
        )
        if (decline) {
          await cliAct({ type: 'resolveEvent', decline: true })
          continue
        }
        break
      }
      if (pending.type === 'fieldHospital') {
        await cliAct({ type: 'resolveEvent', decline: true })
        continue
      }
      break
    }
    const actions = await fetchActions()
    const addToDecree = actions.find((a) => a.type === 'addToDecree')
    if (addToDecree?.params?.options?.length > 0) {
      const option = addToDecree.params.options[0]
      await cliAct({
        type: 'addToDecree',
        cards: [{ cardId: option.cardId, column: option.column }],
      })
      continue
    }
    const decreeAction = actions.find(
      (a) =>
        a.type === 'recruit' ||
        a.type === 'move' ||
        a.type === 'battle' ||
        a.type === 'build',
    )
    // Prefer ending phases over resolving full Eyrie decree when possible.
    if (actions.some((a) => a.type === 'endPhase')) {
      await cliAct({ type: 'endPhase' })
      continue
    }
    if (actions.some((a) => a.type === 'eveningDraw')) {
      await cliAct({ type: 'eveningDraw' })
      continue
    }
    if (actions.some((a) => a.type === 'eveningScore')) {
      await cliAct({ type: 'eveningScore' })
      continue
    }
    if (actions.some((a) => a.type === 'birdsongWood')) {
      await cliAct({ type: 'birdsongWood' })
      continue
    }
    if (decreeAction) {
      // Last resort: cannot end — stuck on mandatory decree step
      console.log(
        'advance stuck decree',
        game.state.phase,
        game.state.step,
        game.state.currentSeat,
        actions.map((a) => a.type),
      )
      break
    }
    console.log(
      'advance stuck',
      game.state.phase,
      game.state.step,
      game.state.currentSeat,
      actions.map((a) => a.type),
    )
    break
  }
  return fetchGame()
}

async function convertVideo(stagingDir, slug) {
  const recorded = (await readdir(stagingDir)).filter((n) => n.endsWith('.webm'))
  if (recorded.length === 0) throw new Error(`no webm for ${slug}`)
  const webmPath = path.join(artifactsDirectory, `${slug}.webm`)
  const mp4Path = path.join(artifactsDirectory, `${slug}.mp4`)
  await copyFile(path.join(stagingDir, recorded[0]), webmPath)
  const ffmpeg = spawnSync(
    'ffmpeg',
    ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { encoding: 'utf8' },
  )
  if (ffmpeg.status !== 0) {
    console.error(ffmpeg.stderr)
  }
  return { webmPath, mp4Path }
}

async function recordOne(entry, browser) {
  const staging = path.join(artifactsDirectory, `video-raw-${entry.slug}`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })

  await loadSnapshot(entry.snapshot)
  const before = await fetchGame()
  console.log(
    `${entry.slug}: BEFORE vp=${before.state.players[0].vp} phase=${before.state.phase}/${before.state.step}`,
  )

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: staging, size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push(String(e)))
  await installAutonomousClickHighlight(page)

  await page.goto(phaserUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('canvas', { timeout: 20_000 })
  await page.waitForTimeout(1000)
  const canvas = page.locator('canvas').first()

  await qaContinue(page, canvas)
  await waitForPhaser(
    page,
    () => {
      const active = window.__ROOT_PHASER_GAME__?.scene
        .getScenes(true)
        .map((s) => s.scene.key)
      return active?.includes('GameScene') ? true : null
    },
    'GameScene',
  )
  await page.waitForTimeout(800)

  // Visual: try tray click for the primary action type
  const primaryType = entry.action.type
  await clickTrayAction(page, canvas, primaryType)
  await page.waitForTimeout(500)

  // Submit complete effect action (composer often unsupported — session submit shows effect live)
  const phaser = await submitViaPhaser(page, entry.action)
  if (!phaser.ok) {
    console.log(`Phaser submit fail (${phaser.reason}) — CLI act`)
    await cliAct(entry.action)
  }

  const assertFn = ASSERTS[entry.slug]
  if (!assertFn) throw new Error(`no assert for ${entry.slug}`)
  const after = await waitForGame(assertFn, `${entry.slug} effect`, 20_000)
  console.log(
    `${entry.slug}: AFTER vp=${after.state.players[0].vp} pending=${after.state.pending.map((p) => p.type).join(',')}`,
  )

  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(artifactsDirectory, `${entry.slug}-after.png`),
  })

  await context.close()
  const videos = await convertVideo(staging, entry.slug)
  await rm(staging, { recursive: true, force: true })

  return {
    slug: entry.slug,
    name: entry.name,
    effect: entry.effect,
    ok: true,
    consoleErrors,
    ...videos,
  }
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const manifest = JSON.parse(
    await readFile(path.join(snapshotsDirectory, 'persistent-effects/manifest.json'), 'utf8'),
  )
  const entries = onlySlug
    ? manifest.filter((e) => e.slug === onlySlug)
    : manifest

  const browser = await chromium.launch({ headless: true })
  const reports = []
  for (const entry of entries) {
    try {
      reports.push(await recordOne(entry, browser))
    } catch (error) {
      console.error(`FAIL ${entry.slug}:`, error)
      reports.push({
        slug: entry.slug,
        name: entry.name,
        effect: entry.effect,
        ok: false,
        error: String(error),
      })
    }
  }
  await browser.close()

  const lines = [
    '# Persistent card EFFECT demos (Frontend QA)',
    '',
    `Phaser: ${phaserUrl}`,
    `Captured: ${new Date().toISOString()}`,
    '',
    '| Card | Effect | Video | Still | Status |',
    '|------|--------|-------|-------|--------|',
  ]
  for (const r of reports) {
    if (!r.ok) {
      lines.push(`| ${r.name} | ${r.effect} | — | — | FAIL: ${r.error} |`)
      continue
    }
    lines.push(
      `| **${r.name}** | ${r.effect} | [mp4](./${r.slug}.mp4) · [webm](./${r.slug}.webm) | [after](./${r.slug}-after.png) | pass |`,
    )
  }
  lines.push('')
  lines.push('Each video: Continue loaded snapshot → trigger effect → board/state updates.')
  lines.push('')

  await writeFile(path.join(artifactsDirectory, 'REVIEW.md'), `${lines.join('\n')}\n`)
  await writeFile(
    path.join(artifactsDirectory, 'reports.json'),
    `${JSON.stringify(reports, null, 2)}\n`,
  )
  console.log(`review → ${path.join(artifactsDirectory, 'REVIEW.md')}`)
  const failed = reports.filter((r) => !r.ok)
  if (failed.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
