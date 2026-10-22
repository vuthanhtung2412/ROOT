/**
 * Token-lean browser driver for frontend QA. One headless Chromium stays up
 * between calls (CDP), each call prints only what an agent needs:
 * short visible texts (`> text`) and controls a click would really hit (`- name`).
 *
 *   node .agents/skills/QA/qa-ui.ts open <snapshot.json | url>
 *   node .agents/skills/QA/qa-ui.ts view            full view
 *   node .agents/skills/QA/qa-ui.ts click <name>    click, print view diff (+/-)
 *   node .agents/skills/QA/qa-ui.ts shot <name>     tmp/artifacts/<name>.png, never overwrites
 *   node .agents/skills/QA/qa-ui.ts close
 *
 * Env: ROOT_REACT_URL (default http://localhost:5173), QA_UI_PORT (default 9333).
 */
import { chromium, type Browser, type BrowserContext, type CDPSession, type Locator, type Page } from 'playwright'
import { spawn, type ChildProcess } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skillDirectory: string = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot: string = path.resolve(skillDirectory, '../../..')
const artifactsDirectory: string = path.join(repositoryRoot, 'tmp/artifacts')
const lastViewFile: string = path.join(repositoryRoot, 'tmp/qa/qa-ui-last-view.txt')
const reactUrl: string = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const DEFAULT_DEBUGGING_PORT = '9333'
const debuggingPort: string = process.env.QA_UI_PORT ?? DEFAULT_DEBUGGING_PORT
const cdpUrl: string = `http://127.0.0.1:${debuggingPort}`
const VIEWPORT_WIDTH = 1280
const VIEWPORT_HEIGHT = 800
const BROWSER_START_ATTEMPTS = 50
const BROWSER_START_POLL_MILLISECONDS = 100
const SETTLE_MILLISECONDS = 700
const QA_CONTINUE_BUTTON = 'QA: Continue loaded game'
const QA_CONTINUE_TIMEOUT_MILLISECONDS = 20_000
const SNAPSHOT_EXTENSION = '.json'
const INDEX_ATTRIBUTE = 'data-qa-ui-index'

interface ViewEntry {
  kind: 'text' | 'control'
  label: string
  /** Set on controls: value of INDEX_ATTRIBUTE on the element. */
  index: number
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function isBrowserUp(): Promise<boolean> {
  try {
    const response: Response = await fetch(`${cdpUrl}/json/version`)
    return response.ok
  } catch {
    return false
  }
}

async function launchBrowser(): Promise<void> {
  const profileDirectory: string = await mkdtemp(path.join(tmpdir(), 'qa-ui-'))
  const child: ChildProcess = spawn(
    chromium.executablePath(),
    [
      '--headless=new',
      `--remote-debugging-port=${debuggingPort}`,
      `--user-data-dir=${profileDirectory}`,
      `--window-size=${String(VIEWPORT_WIDTH)},${String(VIEWPORT_HEIGHT)}`,
      '--no-first-run',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  )
  child.unref()
  for (let attempt: number = 0; attempt < BROWSER_START_ATTEMPTS; attempt += 1) {
    if (await isBrowserUp()) return
    await sleep(BROWSER_START_POLL_MILLISECONDS)
  }
  throw new Error(`browser did not start on ${cdpUrl}`)
}

async function connect(): Promise<{ browser: Browser; page: Page }> {
  if (!(await isBrowserUp())) await launchBrowser()
  const browser: Browser = await chromium.connectOverCDP(cdpUrl)
  const context: BrowserContext = browser.contexts()[0] ?? (await browser.newContext())
  const page: Page = context.pages()[0] ?? (await context.newPage())
  await page.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT })
  return { browser, page }
}

/** Runs in the page: tags hit-testable controls, returns texts + controls in DOM order. */
function collectView(indexAttribute: string): ViewEntry[] {
  const MAX_TEXT_LENGTH: number = 80
  const CONTROL_SELECTOR: string = 'button,a[href],input,select,textarea,[role=button],[role=tab]'
  const TEXT_SELECTOR: string = 'h1,h2,h3,p,[role=dialog] > div'
  const entries: ViewEntry[] = []
  const nameOf = (element: HTMLElement): string =>
    (
      element.getAttribute('aria-label') ||
      element.innerText.trim() ||
      element.querySelector('img')?.getAttribute('alt') ||
      element.getAttribute('title') ||
      element.getAttribute('placeholder') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
  const isHittable = (element: HTMLElement): boolean => {
    const box: DOMRect = element.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return false
    if (getComputedStyle(element).pointerEvents === 'none') return false
    if (element.hasAttribute('disabled')) return false
    const hit: Element | null = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return hit !== null && (hit === element || element.contains(hit))
  }
  document.querySelectorAll(`[${indexAttribute}]`).forEach((element) => {
    element.removeAttribute(indexAttribute)
  })
  const seenLabels: Map<string, number> = new Map()
  let nextIndex: number = 0
  document.querySelectorAll<HTMLElement>(`${CONTROL_SELECTOR},${TEXT_SELECTOR}`).forEach((element) => {
    if (element.matches(CONTROL_SELECTOR)) {
      const name: string = nameOf(element)
      if (name === '' || !isHittable(element)) return
      const count: number = (seenLabels.get(name) ?? 0) + 1
      seenLabels.set(name, count)
      element.setAttribute(indexAttribute, String(nextIndex))
      entries.push({ kind: 'control', label: count > 1 ? `${name} (${String(count)})` : name, index: nextIndex })
      nextIndex += 1
      return
    }
    if (element.closest(CONTROL_SELECTOR) !== null || element.checkVisibility() === false) return
    const text: string = element.innerText.replace(/\s+/g, ' ').trim()
    const isRepeated: boolean = entries.some((entry) => entry.kind === 'text' && entry.label.toLowerCase() === text.toLowerCase())
    if (text !== '' && text.length <= MAX_TEXT_LENGTH && !isRepeated) entries.push({ kind: 'text', label: text, index: -1 })
  })
  return entries
}

async function readView(page: Page): Promise<ViewEntry[]> {
  return page.evaluate(collectView, INDEX_ATTRIBUTE)
}

function formatView(entries: ViewEntry[]): string[] {
  return entries.map((entry) => `${entry.kind === 'text' ? '>' : '-'} ${entry.label}`)
}

async function rememberView(lines: string[]): Promise<void> {
  await mkdir(path.dirname(lastViewFile), { recursive: true })
  await writeFile(lastViewFile, lines.join('\n'))
}

async function printFullView(page: Page): Promise<void> {
  const lines: string[] = formatView(await readView(page))
  await rememberView(lines)
  console.log(lines.join('\n'))
}

async function printViewDifference(page: Page): Promise<void> {
  const previous: string[] = (await readFile(lastViewFile, 'utf8').catch(() => '')).split('\n')
  const lines: string[] = formatView(await readView(page))
  await rememberView(lines)
  const removed: string[] = previous.filter((line) => line !== '' && !lines.includes(line)).map((line) => `  gone ${line}`)
  const added: string[] = lines.filter((line) => !previous.includes(line)).map((line) => `  new  ${line}`)
  const difference: string[] = [...removed, ...added]
  console.log(difference.length === 0 ? '(view unchanged)' : difference.join('\n'))
}

function findControl(entries: ViewEntry[], wanted: string): ViewEntry {
  const controls: ViewEntry[] = entries.filter((entry) => entry.kind === 'control')
  const lowered: string = wanted.toLowerCase()
  const match: ViewEntry | undefined =
    controls.find((entry) => entry.label === wanted) ??
    controls.find((entry) => entry.label.toLowerCase() === lowered) ??
    controls.find((entry) => entry.label.toLowerCase().includes(lowered))
  if (match === undefined) {
    throw new Error(`no clickable "${wanted}". Clickable: ${controls.map((entry) => entry.label).join(' | ')}`)
  }
  return match
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function pickUnusedScreenshotPath(name: string): Promise<string> {
  const wanted: string = path.join(artifactsDirectory, `${name}.png`)
  if (!(await fileExists(wanted))) return wanted
  const timestamp: string = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(artifactsDirectory, `${name}-rerun-${timestamp}.png`)
}

function targetUrl(target: string): string {
  if (!target.endsWith(SNAPSHOT_EXTENSION)) return target
  const snapshotPath: string = target.includes('/') ? target : `tmp/qa/snapshots/${target}`
  return `${reactUrl}/?qaSnapshot=${snapshotPath}`
}

async function open(page: Page, target: string): Promise<void> {
  await page.goto(targetUrl(target))
  if (target.endsWith(SNAPSHOT_EXTENSION)) {
    const continueButton: Locator = page.getByRole('button', { name: QA_CONTINUE_BUTTON })
    await continueButton.waitFor({ timeout: QA_CONTINUE_TIMEOUT_MILLISECONDS })
    await continueButton.click()
  }
  await sleep(SETTLE_MILLISECONDS * 2)
  await printFullView(page)
}

async function click(page: Page, wanted: string): Promise<void> {
  const control: ViewEntry = findControl(await readView(page), wanted)
  await page.locator(`[${INDEX_ATTRIBUTE}="${String(control.index)}"]`).click()
  await sleep(SETTLE_MILLISECONDS)
  await printViewDifference(page)
}

async function screenshot(page: Page, name: string): Promise<void> {
  await mkdir(artifactsDirectory, { recursive: true })
  const screenshotPath: string = await pickUnusedScreenshotPath(name)
  await page.screenshot({ path: screenshotPath })
  console.log(path.relative(repositoryRoot, screenshotPath))
}

async function closeBrowser(): Promise<void> {
  if (!(await isBrowserUp())) return
  const browser: Browser = await chromium.connectOverCDP(cdpUrl)
  const session: CDPSession = await browser.newBrowserCDPSession()
  await session.send('Browser.close').catch(() => undefined)
}

const USAGE = 'usage: qa-ui.ts open <snapshot.json|url> | view | click <name> | shot <name> | close'

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  const argument: string = rest.join(' ')
  if (command === 'close') return closeBrowser()
  if (command === undefined || (command !== 'view' && argument === '')) throw new Error(USAGE)
  const { browser, page } = await connect()
  try {
    if (command === 'open') await open(page, argument)
    else if (command === 'view') await printFullView(page)
    else if (command === 'click') await click(page, argument)
    else if (command === 'shot') await screenshot(page, argument)
    else throw new Error(USAGE)
  } finally {
    await browser.close()
  }
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exit(1)
})
