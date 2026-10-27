/**
 * Screenshots of the woodland moment overlays at chosen beats, injected
 * straight into the HUD store of a running dev server (no game needed).
 *
 * Usage: node woodland-moments-shots.mjs <baseUrl> <outDir>
 */
import { chromium } from 'playwright'

const [baseUrl = 'http://localhost:5173/', outDir = '.'] = process.argv.slice(2)

const MOMENTS = {
  explore: { kind: 'explore', seat: 2, faction: 'vagabond' },
  revolt: { kind: 'revolt', seat: 1, faction: 'alliance', suit: 'fox' },
  turmoil: {
    kind: 'turmoil',
    seat: 0,
    faction: 'eyrie',
    decree: [
      { columnId: 'recruit', cards: [{ suit: 'fox', isVizier: false, failed: true }, { suit: 'bird', isVizier: false, failed: false }] },
      { columnId: 'move', cards: [{ suit: 'bird', isVizier: true, failed: false }, { suit: 'mouse', isVizier: false, failed: false }] },
      { columnId: 'battle', cards: [{ suit: 'bird', isVizier: true, failed: false }] },
      { columnId: 'build', cards: [{ suit: 'rabbit', isVizier: false, failed: false }] },
    ],
    failedCard: { columnId: 'recruit', suit: 'fox' },
    humiliateLoss: 3,
    deposedLeader: 'commander',
  },
  leaderPick: {
    kind: 'leaderPick',
    seat: 0,
    faction: 'eyrie',
    chosen: 'charismatic',
    faceDown: ['commander', 'despot'],
    vizierColumns: ['recruit', 'battle'],
  },
}

/** Beats to freeze each moment at (ms from its start). */
const BEATS = {
  explore: [600],
  revolt: [800],
  turmoil: [1500, 2500, 4000],
  leaderPick: [1000, 2000],
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (error) => console.error('page error:', error.message))
await page.goto(baseUrl)
await page.waitForTimeout(2500)
// The menu sits above the HUD: hide it so the moments show over the backdrop.
await page.addStyleTag({ content: '.menu-overlay { display: none !important; }' })

let sequence = 1000
for (const [name, moment] of Object.entries(MOMENTS)) {
  for (const beat of BEATS[name]) {
    sequence += 1
    await page.evaluate(
      async ({ moment: payload, sequence: next }) => {
        const store = await import('/src/game/hudStore.ts')
        store.patchHud({ woodlandMoments: { sequence: next, moments: [payload] } })
      },
      { moment, sequence },
    )
    await page.waitForTimeout(150)
    await page.evaluate((at) => {
      for (const animation of document.getAnimations()) {
        animation.pause()
        animation.currentTime = at
      }
    }, beat)
    await page.screenshot({ path: `${outDir}/${name}-${String(beat)}.png` })
    // Skip to the next moment: drop the queue by remounting nothing.
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.finish()
    })
    await page.waitForTimeout(5200)
  }
}
await browser.close()
