import type { JSX } from 'react'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  pieceTokenTextureKey,
} from '#assets/gameAssets.ts'
import {
  clearingHasRuin,
  clearingOpenSlotCount,
} from '#game/clearingIndicators.ts'
import { clearingRuler } from '#game/clearingRuler.ts'
import { factionColorForSeat, PIECE_DRAW } from '#game/theme.ts'
import {
  groupPiecesIntoStacks,
  stackOffsets,
  type PieceStackViewModel,
  type PieceViewModel,
} from '#ui/PieceView.ts'
import '#react/PieceStack.css'

export type BoardClearingPieces = {
  pieces: Array<{
    id: string
    kind: string
    owner: number
    type?: string
  }>
  ruin?: { items: string[] }
}

function factionTextureKey(factionId: string): string {
  if (factionId === 'eyrie') {
    return GAME_ASSET_KEYS.factionEyrie
  }
  return GAME_ASSET_KEYS.factionMarquise
}

function textureKeyForStack(stack: PieceStackViewModel): string {
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
}

export function PieceStack(props: PieceStackProps): JSX.Element {
  const usesTokenArt =
    pieceTokenTextureKey(props.stack.kind, props.stack.type) !== null
  const size = usesTokenArt
    ? PIECE_DRAW.buildingIconSize
    : props.stack.kind === 'warrior'
      ? PIECE_DRAW.iconSize
      : PIECE_DRAW.buildingIconSize
  const textureKey = textureKeyForStack(props.stack)
  const imagePath = imagePathForAssetKey(textureKey)
  return (
    <div
      className="piece-stack"
      style={{
        left: props.left,
        top: props.top,
        width: size,
        height: size,
      }}
    >
      {imagePath !== null ? (
        <img
          className="piece-stack__icon"
          src={imagePath}
          alt=""
          draggable={false}
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="piece-stack__icon piece-stack__icon--fallback"
          style={{
            width: size,
            height: size,
            background: colorToCss(props.stack.color),
          }}
        />
      )}
      <span
        className="piece-stack__count"
        style={{ fontSize: Math.round(size * 0.55) }}
      >
        {String(props.stack.count)}
      </span>
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

export type ClearingHitCenter = {
  centerX: number
  centerY: number
  radius: number
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
          className="piece-stack__ruin"
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
          className="piece-stack__slots"
          style={{
            left: center.centerX,
            top: center.centerY + center.radius - 2,
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
        />,
      )
    }
  }

  return <>{nodes}</>
}
