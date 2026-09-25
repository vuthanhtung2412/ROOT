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
import '#react/BoardMap.css'

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
  highlightedClearingIds?: readonly number[]
  rulerByClearing?: ReadonlyMap<number, number | null>
  factions?: readonly string[]
  onClearingSelected?: ClearingSelectedHandler
  children?: JSX.Element | readonly JSX.Element[] | null
}

export function BoardMap(props: BoardMapProps): JSX.Element {
  const layout = props.layout ?? FALL_BOARD_LAYOUT
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
      viewWidth: GAME_LOGICAL_WIDTH,
      viewHeight: GAME_LOGICAL_HEIGHT,
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
    })
  }, [naturalSize])

  const targets: ClearingPixelHitTarget[] = useMemo(() => {
    if (metrics === null) {
      return []
    }
    return clearingHitTargetsForMap(layout, metrics)
  }, [layout, metrics])

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
      className="board-map"
      style={{
        width: GAME_LOGICAL_WIDTH,
        height: GAME_LOGICAL_HEIGHT,
      }}
    >
      {metrics !== null ? (
        <>
          <div
            className="board-map__border"
            style={{
              left: metrics.mapLeft - MAP_BORDER_WIDTH_PIXELS,
              top: metrics.mapTop - MAP_BORDER_WIDTH_PIXELS,
              width: metrics.mapDisplayWidth + MAP_BORDER_WIDTH_PIXELS * 2,
              height: metrics.mapDisplayHeight + MAP_BORDER_WIDTH_PIXELS * 2,
            }}
          />
          <img
            className="board-map__art"
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
          <div className="board-map__pieces">{props.children}</div>
          {targets.map((target) => {
            const isHighlighted = highlighted.has(target.clearingId)
            const hasAnyHighlight = highlighted.size > 0
            const rulerSeat =
              props.rulerByClearing?.get(target.clearingId) ?? null
            let ringClass = 'board-map__ring'
            let ringColor = 'rgba(240, 230, 211, 0.35)'
            let ringWidth = 2
            if (isHighlighted) {
              ringClass = 'board-map__ring board-map__ring--highlight'
              ringColor = '#7ec8ff'
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
                className="board-map__hit"
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
                  className={ringClass}
                  style={{
                    borderColor: ringColor,
                    borderWidth: ringWidth,
                  }}
                />
                {suitPath !== null ? (
                  <img
                    className="board-map__suit"
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
