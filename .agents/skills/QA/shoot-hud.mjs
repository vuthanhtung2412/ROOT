// Screenshot the HUD on a QA snapshot.
// node shoot-hud.mjs <snapshot-name> <output.png> [width] [height] [button-to-click ...]
import { chromium } from 'playwright'

const [snapshotName, outputPath, width = '1280', height = '720', ...clicks] =
  process.argv.slice(2)
const baseUrl = process.env.ROOT_REACT_URL ?? 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
})
await page.goto(`${baseUrl}/?qaSnapshot=tmp/qa/snapshots/${snapshotName}.json`)
await page.getByRole('button', { name: 'QA: Continue loaded game' }).click()
await page.getByRole('button', { name: 'Clearing 0', exact: true }).waitFor()
for (const name of clicks) {
  await page.getByRole('button', { name, exact: true }).first().click()
  await page.waitForTimeout(500)
}
await page.waitForTimeout(800)
await page.screenshot({ path: outputPath })
console.log(await page.getByRole('button').allInnerTexts())
await browser.close()
