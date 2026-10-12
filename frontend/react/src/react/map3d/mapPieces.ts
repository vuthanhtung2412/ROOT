import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  vagabondPawnTextureKey,
} from '#assets/gameAssets.ts'
import {
  clearingHasRuin,
  FALL_CLEARING_SLOT_COUNTS,
} from '#game/clearingIndicators.ts'
import type { ForestPawnMarker } from '#game/forestLayout.ts'
import type { ForestGround } from '#game/map3d/groundMarkers.ts'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import type { MapPiece, MapPieceShape } from '#game/map3d/pieceMeshes.ts'
import {
  groundClearOfRiver,
  type SlotSite,
} from '#game/map3d/riverClearance.ts'
import { createSeededRandom } from '#game/map3d/treePlacement.ts'
import { factionColorForSeat, FACTION_COLORS } from '#game/theme.ts'
import {
  pieceViewModelsForClearing,
  textureKeyForStack,
  type BoardClearingPieces,
} from '#react/PieceStack.tsx'
import {
  groupPiecesIntoStacks,
  type PieceStackViewModel,
  type PieceViewModel,
} from '#ui/PieceView.ts'

export type MapPiecesInput = {
  clearings: readonly BoardClearingPieces[]
  factions: readonly string[]
  clearingGrounds: readonly ClearingGround[]
  forestGrounds: readonly ForestGround[]
  forestPawns: readonly ForestPawnMarker[]
  /** The river as a dense line of points: slots keep out of it. */
  river: readonly MapGroundPoint[]
}

const BUILDING_KIND = 'building'
/** Piece kinds drawn as meeples. */
const FIGURE_KINDS: ReadonlySet<string> = new Set<string>(['warrior', 'pawn'])

/**
 * Where the building slots of a clearing lie, by how many it has: loosely
 * dotted over the back half, as ratios of the clearing radius (x right,
 * z towards the viewer). Each clearing then shifts and turns them a little
 * its own way, so no two clearings look laid out with a ruler.
 */
const SLOT_SPOTS_BY_COUNT: Readonly<
  Record<number, ReadonlyArray<readonly [number, number]>>
> = {
  1: [[-0.12, -0.44]],
  2: [
    [-0.4, -0.5],
    [0.3, -0.3],
  ],
  3: [
    [-0.54, -0.26],
    [-0.04, -0.62],
    // The third sits apart, in the front right corner.
    [0.68, 0.42],
  ],
}
/** How far a slot may shift from its spot (ratio of the clearing radius). */
const SLOT_JITTER_RATIO = 0.07
/** How far a slot may turn either way, radians. */
const SLOT_MAXIMUM_TURN = 0.5
/** Clearings with more slots than a pattern knows fall back to a row. */
const SLOT_ROW_DEPTH_RATIO = -0.42
const SLOT_ROW_SPACING = 2.6
/** Each clearing rolls its own dice. */
const SLOT_SEED_STEP = 7919
/** Tokens and meeples stand in rows across the front of the clearing. */
const STACK_ROW_DEPTH_RATIO = 0.24
const STACK_ROW_SPACING = 2.1
const STACK_SPACING = 2.1
const STACKS_PER_ROW = 4
const HALF = 0.5
const DOUBLE = 2

type SlotSpot = {
  ground: MapGroundPoint
  /** Turn of the plot (and of the building on it), radians. */
  rotation: number
}

/** The slots of a clearing: same every time for the same clearing. */
function slotSpots(site: SlotSite, count: number): SlotSpot[] {
  return patternSpots(site.clearing, count).reduce(
    (dry: SlotSpot[], spot: SlotSpot): SlotSpot[] => [
      ...dry,
      {
        ...spot,
        ground: groundClearOfRiver(
          spot.ground,
          site,
          dry.map((placed: SlotSpot): MapGroundPoint => placed.ground),
        ),
      },
    ],
    [],
  )
}

/** The slots where the pattern puts them, river or not. */
function patternSpots(clearing: ClearingGround, count: number): SlotSpot[] {
  const random: () => number = createSeededRandom(
    (clearing.clearingId + 1) * SLOT_SEED_STEP,
  )
  // Every other clearing mirrors the pattern.
  const mirror: number = clearing.clearingId % DOUBLE === 0 ? 1 : -1
  const pattern: ReadonlyArray<readonly [number, number]> | undefined =
    SLOT_SPOTS_BY_COUNT[count]
  const jitter = (): number =>
    (random() - HALF) * DOUBLE * SLOT_JITTER_RATIO * clearing.radius
  if (pattern === undefined) {
    return rowGrounds(clearing, {
      count,
      spacing: SLOT_ROW_SPACING,
      depth: clearing.radius * SLOT_ROW_DEPTH_RATIO,
    }).map((ground: MapGroundPoint): SlotSpot => ({ ground, rotation: 0 }))
  }
  return pattern.map(
    ([ratioX, ratioZ]: readonly [number, number]): SlotSpot => ({
      ground: {
        x:
          clearing.center.x +
          // A front spot keeps its side: only the back half is mirrored.
          (ratioZ > 0 ? 1 : mirror) * ratioX * clearing.radius +
          jitter(),
        z: clearing.center.z + ratioZ * clearing.radius + jitter(),
      },
      rotation: (random() - HALF) * DOUBLE * SLOT_MAXIMUM_TURN,
    }),
  )
}

/** `count` spots in a row, centred on the clearing, `spacing` apart. */
function rowGrounds(
  clearing: ClearingGround,
  row: { count: number; spacing: number; depth: number },
): MapGroundPoint[] {
  return Array.from(
    { length: row.count },
    (_, index: number): MapGroundPoint => ({
      x: clearing.center.x + (index - (row.count - 1) * HALF) * row.spacing,
      z: clearing.center.z + row.depth,
    }),
  )
}

/** One piece (not a stack) as a map piece: a building owns a whole slot. */
function singlePiece(
  piece: PieceViewModel,
  clearingId: number,
  shape: MapPieceShape,
): MapPiece {
  const [stack]: PieceStackViewModel[] = groupPiecesIntoStacks([piece])
  const textureKey: string =
    stack === undefined ? '' : textureKeyForStack(stack, clearingId)
  return {
    key: `${String(clearingId)}-${piece.id}`,
    shape,
    textureKey,
    texturePath: imagePathForAssetKey(textureKey),
    color: piece.color,
    count: 1,
    ground: { x: 0, z: 0 },
  }
}

/**
 * The building slots of a clearing: the ruin and each building take one,
 * every slot left over shows as an empty plot. Rule: Board > Slots
 */
function slotPieces(
  site: SlotSite,
  clearing: BoardClearingPieces,
  pieces: readonly PieceViewModel[],
): MapPiece[] {
  const clearingGround: ClearingGround = site.clearing
  const clearingId: number = clearingGround.clearingId
  const ruin: MapPiece[] = clearingHasRuin(clearing)
    ? [
        {
          key: `${String(clearingId)}-ruin`,
          shape: 'piece',
          textureKey: GAME_ASSET_KEYS.markerRuin,
          texturePath: imagePathForAssetKey(GAME_ASSET_KEYS.markerRuin),
          color: FACTION_COLORS.neutral,
          count: 1,
          ground: clearingGround.center,
        },
      ]
    : []
  const buildings: MapPiece[] = pieces
    .filter((piece: PieceViewModel): boolean => piece.kind === BUILDING_KIND)
    .map(
      (piece: PieceViewModel): MapPiece =>
        singlePiece(piece, clearingId, 'piece'),
    )
  const occupants: MapPiece[] = [...ruin, ...buildings]
  const slotCount: number = Math.max(
    FALL_CLEARING_SLOT_COUNTS[clearingId] ?? 0,
    occupants.length,
  )
  return slotSpots(site, slotCount).map(
    (spot: SlotSpot, slotIndex: number): MapPiece => {
      const occupant: MapPiece | undefined = occupants[slotIndex]
      if (occupant !== undefined) {
        return { ...occupant, ground: spot.ground, rotation: spot.rotation }
      }
      return {
        key: `${String(clearingId)}-slot-${String(slotIndex)}`,
        shape: 'slot',
        textureKey: '',
        texturePath: null,
        color: FACTION_COLORS.neutral,
        count: 1,
        ground: spot.ground,
        rotation: spot.rotation,
      }
    },
  )
}

/** Tokens, then warriors and pawns, as stacks in rows at the front. */
function stackPieces(
  clearingGround: ClearingGround,
  pieces: readonly PieceViewModel[],
): MapPiece[] {
  const clearingId: number = clearingGround.clearingId
  const stacks: PieceStackViewModel[] = groupPiecesIntoStacks(
    pieces.filter(
      (piece: PieceViewModel): boolean => piece.kind !== BUILDING_KIND,
    ),
  )
  const ordered: PieceStackViewModel[] = [
    ...stacks.filter(
      (stack: PieceStackViewModel): boolean => !FIGURE_KINDS.has(stack.kind),
    ),
    ...stacks.filter((stack: PieceStackViewModel): boolean =>
      FIGURE_KINDS.has(stack.kind),
    ),
  ]
  return ordered.map((stack: PieceStackViewModel, index: number): MapPiece => {
    const rowIndex: number = Math.floor(index / STACKS_PER_ROW)
    const rowCount: number = Math.min(
      ordered.length - rowIndex * STACKS_PER_ROW,
      STACKS_PER_ROW,
    )
    const grounds: MapGroundPoint[] = rowGrounds(clearingGround, {
      count: rowCount,
      spacing: STACK_SPACING,
      depth:
        clearingGround.radius * STACK_ROW_DEPTH_RATIO +
        rowIndex * STACK_ROW_SPACING,
    })
    const textureKey: string = textureKeyForStack(stack, clearingId)
    return {
      key: `${String(clearingId)}-${stack.kind}-${stack.type ?? ''}-${String(stack.owner)}`,
      shape: 'piece',
      textureKey,
      texturePath: imagePathForAssetKey(textureKey),
      color: stack.color,
      count: stack.count,
      ground: grounds[index % STACKS_PER_ROW] ?? clearingGround.center,
    }
  })
}

function averageGround(points: readonly MapGroundPoint[]): MapGroundPoint {
  const total: MapGroundPoint = points.reduce(
    (sum: MapGroundPoint, point: MapGroundPoint): MapGroundPoint => ({
      x: sum.x + point.x,
      z: sum.z + point.z,
    }),
    { x: 0, z: 0 },
  )
  return { x: total.x / points.length, z: total.z / points.length }
}

/** Everything to stand on the 3D map for the current board. */
export function mapPiecesForBoard(input: MapPiecesInput): MapPiece[] {
  const pieces: MapPiece[] = input.clearingGrounds.flatMap(
    (clearingGround: ClearingGround): MapPiece[] => {
      const clearing: BoardClearingPieces = input.clearings[
        clearingGround.clearingId
      ] ?? { pieces: [] }
      const viewModels: PieceViewModel[] = pieceViewModelsForClearing(
        clearing,
        input.factions,
      )
      return [
        ...slotPieces(
          { clearing: clearingGround, river: input.river },
          clearing,
          viewModels,
        ),
        ...stackPieces(clearingGround, viewModels),
      ]
    },
  )
  const forestPawnPieces: MapPiece[] = input.forestPawns.flatMap(
    (marker: ForestPawnMarker): MapPiece[] => {
      const forest: ForestGround | undefined = input.forestGrounds.find(
        (entry: ForestGround): boolean =>
          entry.forestIndex === marker.forestIndex,
      )
      if (forest === undefined) {
        return []
      }
      const textureKey: string = vagabondPawnTextureKey(marker.character)
      return [
        {
          key: `forest-pawn-${String(marker.seat)}`,
          shape: 'piece',
          textureKey,
          texturePath: imagePathForAssetKey(textureKey),
          color: factionColorForSeat(marker.seat, input.factions),
          count: 1,
          ground: averageGround(forest.corners),
        },
      ]
    },
  )
  return [...pieces, ...forestPawnPieces]
}
