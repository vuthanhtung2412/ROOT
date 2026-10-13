import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react'
import {
  autumnMapPublicPath,
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import {
  FALL_BOARD_LAYOUT,
  fallClearingSuit,
  type BoardLayout,
  type ClearingPixelHitTarget,
  type ClearingSuit,
} from '#game/boardLayout.ts'
import {
  clearingHitTargetsForMap,
  computeBoardMapDisplayMetrics,
  type BoardMapDisplayMetrics,
} from '#game/boardMapLayout.ts'
import {
  allForestPixelLayouts,
  type ForestPawnMarker,
  type ForestPixelLayout,
} from '#game/forestLayout.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import { factionColorForSeat } from '#game/theme.ts'
import type { ViewportLayoutMode } from '#game/viewportLayout.ts'
import type { BoardEffectBatch } from '#game/boardEffects.ts'
import type { ClearingFlash } from '#game/clearingFlash.ts'
import { ClearingFlashMark } from '#react/ClearingFlashMark.tsx'
import {
  BoardEffectsLayer,
  type BoardEffectPosition,
} from '#react/BoardEffectsLayer.tsx'
import { ForestPawnLayer } from '#react/ForestPawnLayer.tsx'
import {
  ClearingPieceLayer,
  computeRulerByClearing,
  type BoardClearingPieces,
  type ClearingHitCenter,
} from '#react/PieceStack.tsx'
import { clearingMarkersGoAbove } from '#game/clearingIndicators.ts'

export type ClearingSelectedHandler = (clearingId: number) => void
export type ForestSelectedHandler = (forestIndex: number) => void

const MAP_BORDER_WIDTH_PIXELS = 4
/** Gap between the clearing ring and its suit marker. */
const SUIT_MARKER_GAP_PIXELS = 2
/** Themed finger cursor; only on clearings / forests the player can pick. */
const CLICKABLE_CLEARING_CLASS_NAME =
  'pointer-events-auto absolute z-4 m-0 cursor-root-pointer rounded-full border-0 bg-transparent p-0'
const IDLE_CLEARING_CLASS_NAME =
  'pointer-events-none absolute z-4 m-0 cursor-root-default rounded-full border-0 bg-transparent p-0'
const CLICKABLE_FOREST_CLASS_NAME =
  'pointer-events-auto absolute inset-0 z-5 m-0 cursor-root-pointer border-0 bg-transparent p-0'

function suitTextureKey(suit: ClearingSuit): string {
  if (suit === 'fox') {
    return GAME_ASSET_KEYS.suitFox
  }
  if (suit === 'mouse') {
    return GAME_ASSET_KEYS.suitMouse
  }
  return GAME_ASSET_KEYS.suitRabbit
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export type BoardMapProps = {
  layout?: BoardLayout
  layoutMode?: ViewportLayoutMode
  viewWidth?: number
  viewHeight?: number
  highlightedClearingIds?: readonly number[]
  highlightedForestIndexes?: readonly number[]
  clearings?: readonly BoardClearingPieces[]
  factions?: readonly string[]
  forestPawns?: readonly ForestPawnMarker[]
  /** What the last server update changed on the map. */
  effects?: BoardEffectBatch
  /** Game log: the clearing to point at for a moment. */
  flashedClearing?: ClearingFlash | null
  onClearingSelected?: ClearingSelectedHandler
  onForestSelected?: ForestSelectedHandler
}

export function BoardMap(props: BoardMapProps): JSX.Element {
  const layout = props.layout ?? FALL_BOARD_LAYOUT
  const layoutMode = props.layoutMode ?? 'landscape'
  const viewWidth = props.viewWidth ?? GAME_LOGICAL_WIDTH
  const viewHeight = props.viewHeight ?? GAME_LOGICAL_HEIGHT
  const mapPath = autumnMapPublicPath()
  const [naturalSize, setNaturalSize] = useState<{
    width: number
    height: number
  } | null>(null)

  const metrics: BoardMapDisplayMetrics | null = useMemo(() => {
    if (naturalSize === null) {
      return null
    }
    return computeBoardMapDisplayMetrics({
      viewWidth,
      viewHeight,
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
      layoutMode,
    })
  }, [naturalSize, layoutMode, viewWidth, viewHeight])

  const targets: ClearingPixelHitTarget[] = useMemo(() => {
    if (metrics === null) {
      return []
    }
    return clearingHitTargetsForMap(layout, metrics)
  }, [layout, metrics])

  const flash: ClearingFlash | null = props.flashedClearing ?? null
  const flashedTarget: ClearingPixelHitTarget | undefined = targets.find(
    (target: ClearingPixelHitTarget): boolean =>
      target.clearingId === flash?.clearingId,
  )

  const hitCenters = useMemo(() => {
    const map = new Map<number, ClearingHitCenter>()
    for (const target of targets) {
      map.set(target.clearingId, {
        centerX: target.centerX,
        centerY: target.centerY,
        radius: target.radius,
        markersAbove:
          metrics !== null &&
          clearingMarkersGoAbove(target.centerY, {
            top: metrics.mapTop,
            height: metrics.mapDisplayHeight,
          }),
      })
    }
    return map
  }, [targets, metrics])

  const rulerByClearing = useMemo(() => {
    if (props.clearings === undefined || props.factions === undefined) {
      return new Map<number, number | null>()
    }
    return computeRulerByClearing(
      props.clearings,
      props.factions,
      [...hitCenters.keys()],
    )
  }, [props.clearings, props.factions, hitCenters])

  const highlighted = useMemo(
    () => new Set(props.highlightedClearingIds ?? []),
    [props.highlightedClearingIds],
  )

  const highlightedForests = useMemo(
    () => new Set(props.highlightedForestIndexes ?? []),
    [props.highlightedForestIndexes],
  )

  const forestLayouts = useMemo(() => {
    if (metrics === null) return []
    return allForestPixelLayouts(metrics)
  }, [metrics])

  /** Where a forest pawn is drawn, so a move into or out of a forest lands on it. */
  const forestCenters = useMemo(
    () =>
      new Map<number, BoardEffectPosition>(
        forestLayouts.map(
          (layout: ForestPixelLayout): [number, BoardEffectPosition] => [
            layout.forestIndex,
            { left: layout.centroid.x, top: layout.centroid.y },
          ],
        ),
      ),
    [forestLayouts],
  )

  const forestPawns = props.forestPawns ?? []

  const onClearingSelected = props.onClearingSelected
  const onForestSelected = props.onForestSelected

  const handleClearingClick = useCallback(
    (clearingId: number) => {
      if (onClearingSelected !== undefined) {
        onClearingSelected(clearingId)
      }
    },
    [onClearingSelected],
  )

  const handleForestClick = useCallback(
    (forestIndex: number) => {
      if (onForestSelected !== undefined) {
        onForestSelected(forestIndex)
      }
    },
    [onForestSelected],
  )

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.src = mapPath
  }, [mapPath])

  return (
    <div
      className="relative shrink-0 overflow-hidden pointer-events-none"
      style={{
        width: viewWidth,
        height: viewHeight,
      }}
    >
      {metrics !== null ? (
        <>
          <div
            className="pointer-events-none absolute z-0 bg-parchment shadow-inset-line-ink"
            style={{
              left: metrics.mapLeft - MAP_BORDER_WIDTH_PIXELS,
              top: metrics.mapTop - MAP_BORDER_WIDTH_PIXELS,
              width: metrics.mapDisplayWidth + MAP_BORDER_WIDTH_PIXELS * 2,
              height: metrics.mapDisplayHeight + MAP_BORDER_WIDTH_PIXELS * 2,
            }}
          />
          <img
            className="pointer-events-none absolute z-1 block select-none"
            src={mapPath}
            alt="Autumn map"
            draggable={false}
            style={{
              left: metrics.mapLeft,
              top: metrics.mapTop,
              width: metrics.mapDisplayWidth,
              height: metrics.mapDisplayHeight,
            }}
          />
          <div className="pointer-events-none absolute inset-0 z-3">
            {forestPawns.length > 0 ? (
              <ForestPawnLayer
                forestLayouts={forestLayouts}
                forestPawns={forestPawns}
              />
            ) : null}
            {highlightedForests.size > 0 ? (
              <svg
                className="pointer-events-none absolute inset-0 z-2 overflow-visible"
                width="100%"
                height="100%"
                aria-hidden
              >
                {forestLayouts.map((layout) => {
                  if (!highlightedForests.has(layout.forestIndex)) {
                    return null
                  }
                  const points = layout.corners
                    .map((corner) => `${String(corner.x)},${String(corner.y)}`)
                    .join(' ')
                  return (
                    <polygon
                      key={`forest-highlight-${String(layout.forestIndex)}`}
                      points={points}
                      fill="color-mix(in srgb, var(--color-gold) 28%, transparent)"
                      stroke="var(--color-gold)"
                      strokeWidth={3}
                    />
                  )
                })}
              </svg>
            ) : null}
            {props.clearings !== undefined && props.factions !== undefined ? (
              <ClearingPieceLayer
                clearings={props.clearings}
                factions={props.factions}
                hitCenters={hitCenters}
              />
            ) : null}
          </div>
          {highlightedForests.size > 0
            ? forestLayouts.map((layout) => {
                if (!highlightedForests.has(layout.forestIndex)) {
                  return null
                }
                const points = layout.corners
                  .map((corner) => `${String(corner.x)},${String(corner.y)}`)
                  .join(' ')
                return (
                  <button
                    key={`forest-hit-${String(layout.forestIndex)}`}
                    type="button"
                    className={CLICKABLE_FOREST_CLASS_NAME}
                    aria-label={`Forest ${String(layout.forestIndex)}`}
                    onClick={() => {
                      handleForestClick(layout.forestIndex)
                    }}
                    style={{
                      clipPath: `polygon(${points
                        .split(' ')
                        .map((point) => {
                          const [x, y] = point.split(',')
                          return `${x}px ${y}px`
                        })
                        .join(', ')})`,
                    }}
                  />
                )
              })
            : null}
          {props.effects !== undefined && props.factions !== undefined ? (
            <BoardEffectsLayer
              batch={props.effects}
              factions={props.factions}
              hitCenters={hitCenters}
              forestCenters={forestCenters}
            />
          ) : null}
          {flashedTarget !== undefined && flash !== null ? (
            <ClearingFlashMark key={flash.flashNumber} target={flashedTarget} />
          ) : null}
          {targets.map((target) => {
            const isHighlighted = highlighted.has(target.clearingId)
            const hasAnyHighlight = highlighted.size > 0
            const rulerSeat = rulerByClearing.get(target.clearingId) ?? null
            let ringColor = 'rgba(240, 230, 211, 0.35)'
            let ringWidth = 2
            let ringExtraClass = ''
            if (isHighlighted) {
              ringExtraClass =
                'shadow-gold-glow'
              ringColor = '#c9a04a'
              ringWidth = 3
            } else if (hasAnyHighlight) {
              ringColor = 'rgba(240, 230, 211, 0.2)'
            } else if (rulerSeat !== null && props.factions !== undefined) {
              ringColor = colorToCss(
                factionColorForSeat(rulerSeat, props.factions),
              )
              ringWidth = 3
            }
            const suit = fallClearingSuit(target.clearingId)
            const suitPath =
              suit === null
                ? null
                : imagePathForAssetKey(suitTextureKey(suit))
            const diameter = target.radius * 2
            return (
              <button
                key={target.clearingId}
                type="button"
                className={
                  isHighlighted
                    ? CLICKABLE_CLEARING_CLASS_NAME
                    : IDLE_CLEARING_CLASS_NAME
                }
                aria-label={`Clearing ${String(target.clearingId)}`}
                data-clearing-id={target.clearingId}
                tabIndex={isHighlighted ? 0 : -1}
                onClick={() => {
                  if (!isHighlighted) {
                    return
                  }
                  handleClearingClick(target.clearingId)
                }}
                style={{
                  left: target.centerX - target.radius,
                  top: target.centerY - target.radius,
                  width: diameter,
                  height: diameter,
                }}
              >
                <span
                  className={`pointer-events-none absolute inset-0 box-border rounded-full border-solid ${ringExtraClass}`}
                  style={{
                    borderColor: ringColor,
                    borderWidth: ringWidth,
                  }}
                />
                {suitPath !== null ? (
                  <img
                    className="pointer-events-none absolute left-1/2 block -translate-x-1/2 select-none"
                    src={suitPath}
                    alt=""
                    draggable={false}
                    style={{
                      ...(hitCenters.get(target.clearingId)?.markersAbove ===
                      true
                        ? { bottom: diameter + SUIT_MARKER_GAP_PIXELS }
                        : { top: diameter + SUIT_MARKER_GAP_PIXELS }),
                      maxWidth: target.radius * 0.45,
                      maxHeight: target.radius * 0.45,
                    }}
                  />
                ) : null}
              </button>
            )
          })}
        </>
      ) : null}
    </div>
  )
}
