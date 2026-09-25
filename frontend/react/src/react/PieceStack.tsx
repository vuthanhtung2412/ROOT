import type { JSX } from 'react'
import {
  allianceBaseTextureKey,
  GAME_ASSET_KEYS,
  factionTextureKey,
  imagePathForAssetKey,
  pieceTokenTextureKey,
} from '#assets/gameAssets.ts'
import { fallClearingSuit } from '#game/boardLayout.ts'
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
  if (stack.kind === 'building' && stack.type === 'base') {
    const suit = fallClearingSuit(clearingId) ?? 'fox'
    return allianceBaseTextureKey(suit)
  }
  if (stack.kind === 'warrior' && stack.factionId === 'alliance') {
    return GAME_ASSET_KEYS.tokenAllianceWarrior
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
}

export function PieceStack(props: PieceStackProps): JSX.Element {
  const clearingId = props.clearingId ?? 0
  const usesTokenArt =
    pieceTokenTextureKey(props.stack.kind, props.stack.type) !== null ||
    (props.stack.kind === 'warrior' && props.stack.factionId === 'alliance') ||
    (props.stack.kind === 'building' && props.stack.type === 'base')
  const size = usesTokenArt
    ? PIECE_DRAW.buildingIconSize
    : props.stack.kind === 'warrior'
      ? PIECE_DRAW.iconSize
      : PIECE_DRAW.buildingIconSize
  const textureKey = textureKeyForStack(props.stack, clearingId)
  const imagePath = imagePathForAssetKey(textureKey)
  return (
    <div
      className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-1/2"
      style={{
        left: props.left,
        top: props.top,
        width: size,
        height: size,
      }}
    >
      {imagePath !== null ? (
        <img
          className="block object-fill select-none"
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
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-body font-bold text-white [text-shadow:-1px_-1px_0_#1a1a1a,1px_-1px_0_#1a1a1a,-1px_1px_0_#1a1a1a,1px_1px_0_#1a1a1a]"
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
          className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-1/2 object-fill select-none"
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
          className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-full bg-[#1a2438cc] px-1 py-0.5 font-mono text-[11px] font-bold text-parchment"
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
          clearingId={clearingId}
        />,
      )
    }
  }

  return <>{nodes}</>
}
