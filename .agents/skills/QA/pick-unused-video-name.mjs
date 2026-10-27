/**
 * Never overwrite an earlier QA video: a re-run gets its own file name so the
 * recording of a passed scenario stays as evidence.
 */
import { access } from 'node:fs/promises'
import path from 'node:path'

const VIDEO_EXTENSIONS = ['.webm', '.mp4']
const RERUN_LABEL = 'rerun'

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} artifactsDirectory
 * @param {string} videoName file name without extension
 * @returns {Promise<string>} `videoName`, or a timestamped name when a video already uses it
 */
export async function pickUnusedVideoName(artifactsDirectory, videoName) {
  const existing = await Promise.all(
    VIDEO_EXTENSIONS.map((extension) =>
      fileExists(path.join(artifactsDirectory, `${videoName}${extension}`)),
    ),
  )
  if (!existing.includes(true)) return videoName
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${videoName}-${RERUN_LABEL}-${timestamp}`
}
