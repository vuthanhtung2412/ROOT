/**
 * Autonomous click highlight for Playwright video demos.
 *
 * Install once — every real pointerdown paints a quick red circle blink.
 * Synthetic Phaser/evaluate actions: call flashGameClick / flashPageClick.
 *
 * Usage:
 *   import { installAutonomousClickHighlight, flashGameClick } from './click-highlight.mjs'
 *   await installAutonomousClickHighlight(page)
 *   await page.goto(url)
 */

/**
 * @typedef {{ durationMs?: number, color?: string, sizePx?: number }} ClickHighlightOptions
 */

/**
 * Inject listener before navigation (survives reload).
 * @param {import('playwright').Page} page
 * @param {ClickHighlightOptions} [options]
 */
export async function installAutonomousClickHighlight(page, options = {}) {
  const durationMs = options.durationMs ?? 500
  const color = options.color ?? '#ff0000'
  const sizePx = options.sizePx ?? 28

  await page.addInitScript(
    ({ durationMs: duration, color: dotColor, sizePx: dotSize }) => {
      if (window.__ROOT_QA_CLICK_HIGHLIGHT__ !== undefined) {
        return
      }

      const styleElement = document.createElement('style')
      styleElement.textContent = `
        .root-qa-click-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2147483647;
          overflow: hidden;
        }
        .root-qa-click-dot {
          position: absolute;
          width: ${String(dotSize)}px;
          height: ${String(dotSize)}px;
          margin-left: -${String(dotSize / 2)}px;
          margin-top: -${String(dotSize / 2)}px;
          border-radius: 50%;
          background: ${dotColor};
          border: 2px solid #ffffff;
          opacity: 1;
        }
      `
      const ensureLayer = () => {
        let layer = document.querySelector('.root-qa-click-layer')
        if (layer === null) {
          layer = document.createElement('div')
          layer.className = 'root-qa-click-layer'
          document.documentElement.appendChild(layer)
        }
        if (!document.head.contains(styleElement)) {
          document.head.appendChild(styleElement)
        }
        return layer
      }

      /**
       * @param {number} clientX
       * @param {number} clientY
       */
      const flash = (clientX, clientY) => {
        const layer = ensureLayer()
        const dot = document.createElement('div')
        dot.className = 'root-qa-click-dot'
        dot.style.left = `${String(clientX)}px`
        dot.style.top = `${String(clientY)}px`
        layer.appendChild(dot)
        window.setTimeout(() => {
          dot.remove()
        }, duration)
      }

      const onPointerDown = (event) => {
        if (event.isPrimary === false) return
        flash(event.clientX, event.clientY)
      }

      document.addEventListener('pointerdown', onPointerDown, true)

      window.__ROOT_QA_CLICK_HIGHLIGHT__ = {
        flash,
        durationMs: duration,
      }
    },
    { durationMs, color, sizePx },
  )
}

/**
 * Flash at page/client coordinates (for synthetic non-mouse actions).
 * @param {import('playwright').Page} page
 * @param {number} clientX
 * @param {number} clientY
 */
export async function flashPageClick(page, clientX, clientY) {
  await page.evaluate(
    ({ x, y }) => {
      window.__ROOT_QA_CLICK_HIGHLIGHT__?.flash(x, y)
    },
    { x: clientX, y: clientY },
  )
}

/**
 * Flash at game (1280×720) coordinates relative to canvas.
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} canvas
 * @param {number} gameX
 * @param {number} gameY
 * @param {number} [holdMs] pause so blink visible in video
 */
export async function flashGameClick(page, canvas, gameX, gameY, holdMs = 500) {
  const box = await canvas.boundingBox()
  if (box === null) {
    throw new Error('canvas missing for click highlight')
  }
  const scaleX = box.width / 1280
  const scaleY = box.height / 720
  const clientX = box.x + gameX * scaleX
  const clientY = box.y + gameY * scaleY
  await flashPageClick(page, clientX, clientY)
  if (holdMs > 0) {
    await page.waitForTimeout(holdMs)
  }
}
