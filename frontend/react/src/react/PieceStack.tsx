import type { JSX } from 'react'
import {
  allianceBaseTextureKey,
  GAME_ASSET_KEYS,
  factionTextureKey,
  imagePathForAssetKey,
  pieceTokenTextureKey,
  warriorTokenTextureKey,
} from '#assets/gameAssets.ts'
import {
  isSuitScopedPieceType,
  suitScopedPieceTextureKey,
} from '#assets/riverfolkExpansionAssets.ts'
import { fallClearingSuit } from '#game/boardLayout.ts'
import {
  clearingHasRuin,
  clearingOpenSlotCount,
} from '#game/clearingIndicators.ts'
import { clearingRuler } from '#game/clearingRuler.ts'
import { factionColorForSeat, PIECE_DRAW } from '#game/theme.ts'
import {
  BUILDING_PIECE_KIND,
  groupPiecesIntoStacks,
  stackOffsets,
  type PieceStackViewModel,
  type PieceViewModel,
} from '#ui/PieceView.ts'

export type BoardClearingPieces = {
  pieces: Array<{
    id: string
    kind: string
    owner: number
    type?: string
  }>
  ruin?: { items: string[] }
}

function textureKeyForStack(
  stack: PieceStackViewModel,
  clearingId: number,
): string {
  if (stack.kind === BUILDING_PIECE_KIND && stack.type === 'base') {
    const suit = fallClearingSuit(clearingId) ?? 'fox'
    return allianceBaseTextureKey(suit)
  }
  if (stack.type !== undefined && isSuitScopedPieceType(stack.type)) {
    const suit = fallClearingSuit(clearingId) ?? 'fox'
    const suitScopedKey = suitScopedPieceTextureKey(stack.type, suit)
    if (suitScopedKey !== null) {
      return suitScopedKey
    }
  }
  if (stack.kind === 'warrior') {
    const warriorKey = warriorTokenTextureKey(stack.factionId)
    if (warriorKey !== null) {
      return warriorKey
    }
  }
  const tokenKey = pieceTokenTextureKey(stack.kind, stack.type)
  if (tokenKey !== null) {
    return tokenKey
  }
  return factionTextureKey(stack.factionId)
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export type PieceStackProps = {
  stack: PieceStackViewModel
  left: number
  top: number
  clearingId?: number
  /** A single piece shown on its own (a meeple on the move): no number. */
  hidesCount?: boolean
}

export function PieceStack(props: PieceStackProps): JSX.Element {
  const clearingId = props.clearingId ?? 0
  const usesTokenArt =
    pieceTokenTextureKey(props.stack.kind, props.stack.type) !== null ||
    (props.stack.kind === 'warrior' &&
      warriorTokenTextureKey(props.stack.factionId) !== null) ||
    (props.stack.kind === BUILDING_PIECE_KIND && props.stack.type === 'base') ||
    isSuitScopedPieceType(props.stack.type)
  const size = usesTokenArt
    ? PIECE_DRAW.buildingIconSize
    : props.stack.kind === 'warrior'
      ? PIECE_DRAW.iconSize
      : PIECE_DRAW.buildingIconSize
  const textureKey = textureKeyForStack(props.stack, clearingId)
  const imagePath = imagePathForAssetKey(textureKey)
  return (
    <div
      className="pointer-events-none absolute z-3 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: props.left,
        top: props.top,
        width: size,
        height: size,
      }}
    >
      {imagePath !== null ? (
        <img
          className={
            props.stack.type === 'sympathy'
              ? 'block rounded-full object-cover select-none'
              : 'block object-fill select-none'
          }
          src={imagePath}
          alt=""
          draggable={false}
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="block rounded object-fill select-none"
          style={{
            width: size,
            height: size,
            background: colorToCss(props.stack.color),
          }}
        />
      )}
      {props.stack.kind !== BUILDING_PIECE_KIND &&
      props.hidesCount !== true ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-body font-bold text-white text-shadow-outline"
          style={{ fontSize: Math.round(size * 0.55) }}
        >
          {String(props.stack.count)}
        </span>
      ) : null}
    </div>
  )
}

function pieceViewModelsForClearing(
  clearing: BoardClearingPieces,
  factions: readonly string[],
): PieceViewModel[] {
  return clearing.pieces.map((piece) => {
    const factionId = factions[piece.owner] ?? 'marquise'
    const viewModel: PieceViewModel = {
      id: piece.id,
      kind: piece.kind,
      owner: piece.owner,
      color: factionColorForSeat(piece.owner, factions),
      factionId,
    }
    if (piece.type !== undefined) {
      return { ...viewModel, type: piece.type }
    }
    return viewModel
  })
}

/** Open building slots: a count just inside the clearing ring. */
const OPEN_SLOTS_CLASS_NAME =
  'pointer-events-none absolute z-2 -translate-x-1/2 bg-[#1a2438cc] px-1 py-0.5 font-mono text-[11px] font-bold text-parchment'
const OPEN_SLOTS_BELOW_CLASS_NAME = `${OPEN_SLOTS_CLASS_NAME} -translate-y-full`
const OPEN_SLOTS_ABOVE_CLASS_NAME = OPEN_SLOTS_CLASS_NAME
const OPEN_SLOTS_RING_INSET_PIXELS = 2

export type ClearingHitCenter = {
  centerX: number
  centerY: number
  radius: number
  /** Bottom clearings: suit and open-slot markers go above, clear of the hand. */
  markersAbove?: boolean
}

export type ClearingPieceLayerProps = {
  clearings: readonly BoardClearingPieces[]
  factions: readonly string[]
  hitCenters: ReadonlyMap<number, ClearingHitCenter>
}

export function computeRulerByClearing(
  clearings: readonly BoardClearingPieces[],
  factions: readonly string[],
  clearingIds: readonly number[],
): Map<number, number | null> {
  const rulers = new Map<number, number | null>()
  for (const clearingId of clearingIds) {
    const clearing = clearings[clearingId]
    if (clearing === undefined) {
      rulers.set(clearingId, null)
      continue
    }
    rulers.set(clearingId, clearingRuler(clearing, factions))
  }
  return rulers
}

export function ClearingPieceLayer(
  props: ClearingPieceLayerProps,
): JSX.Element {
  const nodes: JSX.Element[] = []
  const ruinPath = imagePathForAssetKey(GAME_ASSET_KEYS.markerRuin)

  for (const [clearingId, center] of props.hitCenters) {
    const clearing = props.clearings[clearingId]
    if (clearing === undefined) {
      continue
    }

    if (clearingHasRuin(clearing) && ruinPath !== null) {
      const ruinSize = center.radius * 0.5
      nodes.push(
        <img
          key={`ruin-${String(clearingId)}`}
          className="pointer-events-none absolute z-2 -translate-x-1/2 -translate-y-1/2 object-fill select-none"
          src={ruinPath}
          alt=""
          draggable={false}
          style={{
            left: center.centerX - center.radius * 0.55,
            top: center.centerY - center.radius * 0.55,
            width: ruinSize,
            height: ruinSize,
          }}
        />,
      )
    }

    const openSlots = clearingOpenSlotCount(clearingId, clearing)
    if (openSlots > 0) {
      nodes.push(
        <span
          key={`slots-${String(clearingId)}`}
          className={
            center.markersAbove === true
              ? OPEN_SLOTS_ABOVE_CLASS_NAME
              : OPEN_SLOTS_BELOW_CLASS_NAME
          }
          style={{
            left: center.centerX,
            top:
              center.markersAbove === true
                ? center.centerY - center.radius + OPEN_SLOTS_RING_INSET_PIXELS
                : center.centerY + center.radius - OPEN_SLOTS_RING_INSET_PIXELS,
          }}
        >
          {String(openSlots)}
        </span>,
      )
    }

    const stacks = groupPiecesIntoStacks(
      pieceViewModelsForClearing(clearing, props.factions),
    )
    const offsets = stackOffsets(stacks.length)
    for (let index = 0; index < stacks.length; index += 1) {
      const stack = stacks[index]
      const offset = offsets[index]
      if (stack === undefined || offset === undefined) {
        continue
      }
      nodes.push(
        <PieceStack
          key={`${String(clearingId)}-${stack.kind}-${stack.type ?? ''}-${String(stack.owner)}`}
          stack={stack}
          left={center.centerX + offset.x}
          top={center.centerY + offset.y}
          clearingId={clearingId}
        />,
      )
    }
  }

  return <>{nodes}</>
}
