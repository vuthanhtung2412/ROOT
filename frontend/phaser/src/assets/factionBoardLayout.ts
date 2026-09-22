/**
 * Pixel layouts from board-layout-helper exports.
 * Source twin: resources/reference/character-boards/{faction}/*.layout.json
 */
import eyrieDynastiesFrontLayoutJson from './layouts/eyrie-dynasties-front.layout.json'
import marquiseDeCatFrontLayoutJson from './layouts/marquise-de-cat-front.layout.json'

export type BoardLayoutRegion = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type BoardLayoutTrack = {
  id: string
  cells: number
  cellSize: number
  gaps: number[]
  x: number
  y: number
}

export type FactionBoardPixelLayout = {
  naturalWidth: number
  naturalHeight: number
  tracks: readonly BoardLayoutTrack[]
  regions: readonly BoardLayoutRegion[]
}

export type ScaledBoardRect = {
  x: number
  y: number
  width: number
  height: number
}

export type BoardImagePlacement = {
  left: number
  top: number
  scale: number
  displayWidth: number
  displayHeight: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRegion(value: unknown): BoardLayoutRegion | null {
  if (!isRecord(value)) {
    return null
  }
  const id = value.id
  const x = value.x
  const y = value.y
  const width = value.width
  const height = value.height
  if (
    typeof id !== 'string' ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return null
  }
  return { id, x, y, width, height }
}

function parseTrack(value: unknown): BoardLayoutTrack | null {
  if (!isRecord(value)) {
    return null
  }
  const id = value.id
  const cells = value.cells
  const cellSize = value.cellSize
  const x = value.x
  const y = value.y
  const gapsRaw = value.gaps
  if (
    typeof id !== 'string' ||
    typeof cells !== 'number' ||
    typeof cellSize !== 'number' ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Array.isArray(gapsRaw)
  ) {
    return null
  }
  const gaps: number[] = []
  for (const gap of gapsRaw) {
    if (typeof gap !== 'number') {
      return null
    }
    gaps.push(gap)
  }
  return { id, cells, cellSize, gaps, x, y }
}

function parseFactionBoardPixelLayout(
  value: unknown,
): FactionBoardPixelLayout | null {
  if (!isRecord(value)) {
    return null
  }
  const naturalWidth = value.naturalWidth
  const naturalHeight = value.naturalHeight
  const tracksRaw = value.tracks
  const regionsRaw = value.regions
  if (
    typeof naturalWidth !== 'number' ||
    typeof naturalHeight !== 'number' ||
    !Array.isArray(tracksRaw) ||
    !Array.isArray(regionsRaw)
  ) {
    return null
  }
  const tracks: BoardLayoutTrack[] = []
  for (const track of tracksRaw) {
    const parsed = parseTrack(track)
    if (parsed === null) {
      return null
    }
    tracks.push(parsed)
  }
  const regions: BoardLayoutRegion[] = []
  for (const region of regionsRaw) {
    const parsed = parseRegion(region)
    if (parsed === null) {
      return null
    }
    regions.push(parsed)
  }
  return { naturalWidth, naturalHeight, tracks, regions }
}

function requireLayout(
  value: unknown,
  label: string,
): FactionBoardPixelLayout {
  const parsed = parseFactionBoardPixelLayout(value)
  if (parsed === null) {
    throw new Error(`Invalid faction board layout: ${label}`)
  }
  return parsed
}

export const MARQUISE_BOARD_LAYOUT: FactionBoardPixelLayout = requireLayout(
  marquiseDeCatFrontLayoutJson,
  'marquise',
)

export const EYRIE_BOARD_LAYOUT: FactionBoardPixelLayout = requireLayout(
  eyrieDynastiesFrontLayoutJson,
  'eyrie',
)

export function factionBoardLayoutForKind(
  kind: 'marquise' | 'eyrie',
): FactionBoardPixelLayout {
  if (kind === 'marquise') {
    return MARQUISE_BOARD_LAYOUT
  }
  return EYRIE_BOARD_LAYOUT
}

export function findBoardLayoutRegion(
  layout: FactionBoardPixelLayout,
  regionId: string,
): BoardLayoutRegion | null {
  const match = layout.regions.find((region) => region.id === regionId)
  if (match === undefined) {
    return null
  }
  return match
}

/** Prefer exported cell region; else derive from track + gaps. */
export function trackCellRegion(
  layout: FactionBoardPixelLayout,
  trackId: string,
  cellIndex: number,
): BoardLayoutRegion | null {
  const fromRegions = findBoardLayoutRegion(layout, `${trackId}-${String(cellIndex)}`)
  if (fromRegions !== null) {
    return fromRegions
  }
  const track = layout.tracks.find((entry) => entry.id === trackId)
  if (track === undefined) {
    return null
  }
  if (cellIndex < 0 || cellIndex >= track.cells) {
    return null
  }
  let x = track.x
  for (let cursor = 0; cursor < cellIndex; cursor += 1) {
    x += track.cellSize + (track.gaps[cursor] ?? 0)
  }
  return {
    id: `${trackId}-${String(cellIndex)}`,
    x,
    y: track.y,
    width: track.cellSize,
    height: track.cellSize,
  }
}

export function scaleBoardLayoutRegion(
  region: BoardLayoutRegion,
  placement: BoardImagePlacement,
): ScaledBoardRect {
  return {
    x: placement.left + region.x * placement.scale,
    y: placement.top + region.y * placement.scale,
    width: region.width * placement.scale,
    height: region.height * placement.scale,
  }
}

export function placeBoardImage(options: {
  viewWidth: number
  viewHeight: number
  naturalWidth: number
  naturalHeight: number
  maxWidthRatio: number
  maxHeightRatio: number
  topRatio: number
}): BoardImagePlacement {
  const maxWidth = options.viewWidth * options.maxWidthRatio
  const maxHeight = options.viewHeight * options.maxHeightRatio
  const scale = Math.min(
    maxWidth / options.naturalWidth,
    maxHeight / options.naturalHeight,
  )
  const displayWidth = options.naturalWidth * scale
  const displayHeight = options.naturalHeight * scale
  return {
    left: options.viewWidth / 2 - displayWidth / 2,
    top: options.viewHeight * options.topRatio,
    scale,
    displayWidth,
    displayHeight,
  }
}
