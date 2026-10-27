/**
 * Smooth QA demo videos.
 *
 * Headless Chromium draws WebGL in software (SwiftShader, ~2 fps on the 3D
 * map): launch it on the real GPU through Metal, and encode the mp4 at a
 * steady frame rate.
 *
 * Usage:
 *   import { launchGpuBrowser, convertWebmToMp4 } from './smooth-video.mjs'
 *   const browser = await launchGpuBrowser({ headless: true })
 *   const ffmpeg = convertWebmToMp4(webmPath, mp4Path)
 *   if (ffmpeg.status !== 0) console.error(ffmpeg.stderr)
 */
import { chromium } from './node_modules/playwright/index.mjs'
import { spawnSync } from 'node:child_process'

const GPU_ARGUMENTS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
export const VIDEO_FRAMES_PER_SECOND = 24

/**
 * @param {import('playwright').LaunchOptions} [options]
 * @returns {Promise<import('playwright').Browser>}
 */
export function launchGpuBrowser(options = {}) {
  return chromium.launch({
    ...options,
    args: [...GPU_ARGUMENTS, ...(options.args ?? [])],
  })
}

/**
 * Webm → mp4 at VIDEO_FRAMES_PER_SECOND. Never overwrites an existing video
 * (`-n`): pick the name with pick-unused-video-name.mjs.
 * @param {string} webmPath
 * @param {string} mp4Path
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
export function convertWebmToMp4(webmPath, mp4Path) {
  return spawnSync(
    'ffmpeg',
    [
      '-n',
      '-i',
      webmPath,
      '-vf',
      `fps=${String(VIDEO_FRAMES_PER_SECOND)}`,
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
}
