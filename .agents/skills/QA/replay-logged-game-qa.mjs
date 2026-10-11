/**
 * Timelapse of a saved playtest: load the START snapshot, then POST every
 * logged ACT while the React UI watches. Records a video.
 *
 * Default log: logs/10-10-2026-22h03m/game.json (FEEDBACK-10-Oct playtest).
 *
 *   ROOT_GAME_STORE_FILE=off PORT=3100 pnpm --filter @root/web dev
 *   ROOT_DEV_API=http://localhost:3100 pnpm --filter @root/react exec vite --port 5180 --strictPort
 *   ROOT_DEV_API=http://localhost:3100 ROOT_REACT_URL=http://localhost:5180 \
 *     node .agents/skills/QA/replay-logged-game-qa.mjs
 *
 *   LOG_PATH=logs/…/game.json FRAME_MS=200 ACT_STRIDE=1 node …
 *   DRY_RUN=1 FRAME_MS=0 node …   # no video kept
 *
 * Output: tmp/artifacts/logged-game-qa/<name>.{webm,mp4}
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { installAutonomousClickHighlight } from './click-highlight.mjs'
import { pickUnusedVideoName } from './pick-unused-video-name.mjs'

const skillDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(skillDirectory, '../../..')
const artifactsDirectory = path.join(rootDirectory, 'tmp/artifacts/logged-game-qa')
const defaultLogPath = path.join(rootDirectory, 'logs/10-10-2026-22h03m/game.json')
const logPath = path.resolve(rootDirectory, process.env.LOG_PATH ?? defaultLogPath)
const VIDEO_NAME = process.env.VIDEO_NAME ?? 'yesterday-10-10-2026-gameplay'
const INTRO = 'Playtest 10 Oct 2026 · full game replay'

const reactUiUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const apiUrl = process.env.ROOT_DEV_API ?? 'http://localhost:3000'
const isHeaded = process.env.HEADED === '1'
const isDryRun = process.env.DRY_RUN === '1'
const frameMs = Number(process.env.FRAME_MS ?? 180)
const actStride = Math.max(1, Number(process.env.ACT_STRIDE ?? 1))
const VIEWPORT = { width: 1440, height: 900 }
const ACTION_TIMEOUT_MS = 15_000

async function fetchJson(route, init) {
  const response = await fetch(`${apiUrl}${route}`, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${init?.method ?? 'GET'} ${route} ${response.status}: ${body}`)
  }
  return response.json()
}

function buildStartSnapshot(startSeq) {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@root/lib', 'replay:log', logPath, String(startSeq)],
    { cwd: rootDirectory, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(`replay:log failed:\n${result.stderr}\n${result.stdout}`)
  }
  const match = /→ (.+\.json)/.exec(result.stdout)
  if (match === null) {
    throw new Error(`could not parse snapshot path from:\n${result.stdout}`)
  }
  return match[1].trim()
}

async function loadSnapshot(snapshotPath) {
  await fetchJson('/game/snapshot?replace=1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: await readFile(snapshotPath, 'utf8'),
  })
}

async function postAction(action) {
  await fetchJson('/game/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  })
}

function readActFrames() {
  const logged = JSON.parse(
    spawnSync('python3', ['-c', `
import json, sys
log = json.load(open(sys.argv[1]))
start = next(e for e in log["events"] if e["label"] == "START")
acts = []
for e in log["events"]:
    if e["seq"] <= start["seq"]:
        continue
    if e["label"] != "ACT" or "action" not in e:
        continue
    acts.append({
        "seq": e["seq"],
        "action": e["action"],
        "turn": e["state"]["turn"],
        "phase": e["state"]["phase"],
        "seat": e["state"]["currentSeat"],
        "status": e["state"]["status"],
        "winner": e["state"].get("winner"),
    })
json.dump({"startSeq": start["seq"], "acts": acts}, sys.stdout)
`, logPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout,
  )
  return logged
}

async function setCaption(page, text, status) {
  await page.evaluate(
    ({ captionText, captionStatus }) => {
      const colors = { PASS: '#15803d', FAIL: '#b91c1c', INFO: '#1f2937' }
      let caption = document.getElementById('root-qa-caption')
      if (caption === null) {
        caption = document.createElement('div')
        caption.id = 'root-qa-caption'
        document.body.appendChild(caption)
      }
      caption.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;left:12px;bottom:130px;width:360px;background:${colors[captionStatus] ?? colors.INFO};color:#fff;font:600 16px/1.3 system-ui;padding:10px 12px;border-radius:8px;box-shadow:0 2px 8px #0008`
      caption.textContent = captionStatus ? `[${captionStatus}] ${captionText}` : captionText
    },
    { captionText: text, captionStatus: status ?? null },
  )
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

function actionLabel(action) {
  if (action === null || typeof action !== 'object') return '?'
  const type = typeof action.type === 'string' ? action.type : '?'
  if (typeof action.clearing === 'number') return `${type} C${String(action.clearing)}`
  return type
}

async function main() {
  await mkdir(artifactsDirectory, { recursive: true })
  const rawVideoDirectory = path.join(artifactsDirectory, `${VIDEO_NAME}-raw`)
  await rm(rawVideoDirectory, { recursive: true, force: true })

  console.log(`log: ${logPath}`)
  const { startSeq, acts } = readActFrames()
  const startSnapshotPath = buildStartSnapshot(startSeq)
  console.log(`START snapshot: ${startSnapshotPath}`)
  console.log(
    `ACT count: ${String(acts.length)} · pause every ${String(actStride)} · ${String(frameMs)}ms`,
  )

  await loadSnapshot(startSnapshotPath)

  const browser = await chromium.launch({ headless: !isHeaded })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: isDryRun ? undefined : { dir: rawVideoDirectory, size: VIEWPORT },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(ACTION_TIMEOUT_MS)
  await installAutonomousClickHighlight(page)

  await page.addInitScript(() => {
    window.__ROOT_QA_DISABLE_AUTO__ = true
  })
  await page.goto(`${reactUiUrl}?qaLogReplay=1`, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    window.__ROOT_QA_DISABLE_AUTO__ = true
  })
  await setCaption(page, INTRO)
  await page.waitForTimeout(Math.max(frameMs, 800))
  await page.getByRole('button', { name: 'QA: Continue loaded game' }).click()
  await page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()
  await page.evaluate(() => {
    window.__ROOT_QA_DISABLE_AUTO__ = true
  })
  const autoDisabled = await page.evaluate(() => window.__ROOT_QA_DISABLE_AUTO__ === true)
  console.log(`__ROOT_QA_DISABLE_AUTO__=${String(autoDisabled)}`)
  if (!autoDisabled) {
    throw new Error('QA auto-disable flag not set in the page')
  }
  // Let the first HUD paint see the flag before any scripted acts.
  await page.waitForTimeout(500)

  let failed = 0
  for (let index = 0; index < acts.length; index += 1) {
    const frame = acts[index]
    const label = `t${String(frame.turn)} ${frame.phase} seat${String(frame.seat)} · ${actionLabel(frame.action)}`
    try {
      await postAction(frame.action)
      const showFrame = index % actStride === 0 || index + 1 === acts.length
      if (showFrame) {
        await setCaption(page, label)
        if (frameMs > 0) await page.waitForTimeout(frameMs)
      }
      if (index < 20 || (index + 1) % 40 === 0 || index + 1 === acts.length) {
        console.log(`OK  ${String(index + 1)}/${String(acts.length)}  ${label}`)
      }
    } catch (error) {
      failed += 1
      const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
      console.error(`FAIL  ${label} — ${detail}`)
      await setCaption(page, `${label} — ${detail}`, 'FAIL')
      await page.waitForTimeout(Math.max(frameMs, 1200))
      break
    }
  }

  const last = acts[acts.length - 1]
  const done =
    failed === 0
      ? `Done · winner seat${String(last?.winner ?? '?')} · turn ${String(last?.turn ?? '?')}`
      : 'Stopped on a failed act'
  await setCaption(page, done, failed === 0 ? 'PASS' : 'FAIL')
  await page.waitForTimeout(Math.max(frameMs, 1500))
  await context.close()
  await browser.close()

  const video = isDryRun ? 'none (DRY_RUN)' : await convertToMp4(rawVideoDirectory)
  console.log(`\n${VIDEO_NAME}: ${failed === 0 ? 'PASS' : 'FAIL'} · video: ${video}\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
