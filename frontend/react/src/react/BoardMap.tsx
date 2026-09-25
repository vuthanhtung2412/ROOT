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
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import { factionColorForSeat } from '#game/theme.ts'
import type { ViewportLayoutMode } from '#game/viewportLayout.ts'
import {
  ClearingPieceLayer,
  computeRulerByClearing,
  type BoardClearingPieces,
} from '#react/PieceStack.tsx'

export type ClearingSelectedHandler = (clearingId: number) => void

const MAP_BORDER_WIDTH_PIXELS = 4

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
  clearings?: readonly BoardClearingPieces[]
  factions?: readonly string[]
  onClearingSelected?: ClearingSelectedHandler
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

  const hitCenters = useMemo(() => {
    const map = new Map<
      number,
      { centerX: number; centerY: number; radius: number }
    >()
    for (const target of targets) {
      map.set(target.clearingId, {
        centerX: target.centerX,
        centerY: target.centerY,
        radius: target.radius,
      })
    }
    return map
  }, [targets])

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

  const onClearingSelected = props.onClearingSelected

  const handleClearingClick = useCallback(
    (clearingId: number) => {
      if (onClearingSelected !== undefined) {
        onClearingSelected(clearingId)
      }
    },
    [onClearingSelected],
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
            className="pointer-events-none absolute z-[0] bg-parchment shadow-[inset_0_0_0_1px_var(--color-ink-soft)]"
            style={{
              left: metrics.mapLeft - MAP_BORDER_WIDTH_PIXELS,
              top: metrics.mapTop - MAP_BORDER_WIDTH_PIXELS,
              width: metrics.mapDisplayWidth + MAP_BORDER_WIDTH_PIXELS * 2,
              height: metrics.mapDisplayHeight + MAP_BORDER_WIDTH_PIXELS * 2,
            }}
          />
          <img
            className="pointer-events-none absolute z-[1] block select-none"
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
          <div className="pointer-events-none absolute inset-0 z-[3]">
            {props.clearings !== undefined && props.factions !== undefined ? (
              <ClearingPieceLayer
                clearings={props.clearings}
                factions={props.factions}
                hitCenters={hitCenters}
              />
            ) : null}
          </div>
          {targets.map((target) => {
            const isHighlighted = highlighted.has(target.clearingId)
            const hasAnyHighlight = highlighted.size > 0
            const rulerSeat = rulerByClearing.get(target.clearingId) ?? null
            let ringColor = 'rgba(240, 230, 211, 0.35)'
            let ringWidth = 2
            let ringExtraClass = ''
            if (isHighlighted) {
              ringExtraClass =
                'shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-gold)_75%,transparent)]'
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
                className="pointer-events-auto absolute z-[4] m-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
                aria-label={`Clearing ${String(target.clearingId)}`}
                onClick={() => {
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
                      top: diameter + 2,
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
