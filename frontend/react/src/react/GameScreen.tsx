import { useEffect, useState, type JSX } from 'react'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import type { BoardLayout } from '#game/boardLayout.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import {
  portraitMapHostSize,
  type ViewportLayoutMode,
} from '#game/viewportLayout.ts'
import { BoardMap } from '#react/BoardMap.tsx'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'

export type GameScreenProps = {
  layout: BoardLayout | null
  layoutMode: ViewportLayoutMode
  clearings: readonly BoardClearingPieces[] | null
  factions: readonly string[] | null
  highlightedClearingIds: readonly number[]
  onClearingSelected: (clearingId: number) => void
}

type ViewportPixelSize = {
  width: number
  height: number
}

function useViewportPixelSize(): ViewportPixelSize {
  const [size, setSize] = useState<ViewportPixelSize>(() => ({
    width: typeof window === 'undefined' ? GAME_LOGICAL_WIDTH : window.innerWidth,
    height:
      typeof window === 'undefined' ? GAME_LOGICAL_HEIGHT : window.innerHeight,
  }))
  useEffect(() => {
    const updateSize = (): void => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    window.addEventListener('orientationchange', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('orientationchange', updateSize)
    }
  }, [])
  return size
}

function useLandscapeLetterboxScale(): number {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const updateScale = (): void => {
      setScale(
        Math.min(
          window.innerWidth / GAME_LOGICAL_WIDTH,
          window.innerHeight / GAME_LOGICAL_HEIGHT,
        ),
      )
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    window.addEventListener('orientationchange', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      window.removeEventListener('orientationchange', updateScale)
    }
  }, [])
  return scale
}

export function GameScreen(props: GameScreenProps): JSX.Element {
  const wallpaperPath = imagePathForAssetKey(GAME_ASSET_KEYS.gameWallpaper)
  const viewport = useViewportPixelSize()
  const landscapeScale = useLandscapeLetterboxScale()
  const isPortrait = props.layoutMode === 'portrait'
  const portraitHost = portraitMapHostSize(viewport)

  const boardMap =
    props.layout !== null ? (
      <BoardMap
        layout={props.layout}
        layoutMode={props.layoutMode}
        viewWidth={isPortrait ? portraitHost.width : GAME_LOGICAL_WIDTH}
        viewHeight={isPortrait ? portraitHost.height : GAME_LOGICAL_HEIGHT}
        {...(props.clearings !== null ? { clearings: props.clearings } : {})}
        {...(props.factions !== null ? { factions: props.factions } : {})}
        highlightedClearingIds={props.highlightedClearingIds}
        onClearingSelected={props.onClearingSelected}
      />
    ) : null

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden bg-forest-deep">
      {wallpaperPath !== null ? (
        <img
          className="pointer-events-none absolute inset-0 size-full object-cover select-none brightness-[0.92] contrast-[1.03] saturate-90"
          src={wallpaperPath}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-forest-deep" />
      )}
      {isPortrait ? (
        <div className="absolute top-[var(--root-portrait-map-top-inset)] right-0 bottom-[var(--root-portrait-map-bottom-inset)] left-0 z-[1] box-border flex items-center justify-center overflow-hidden px-2.5">
          <div
            className="relative max-h-full max-w-full shrink-0"
            style={{
              width: portraitHost.width,
              height: portraitHost.height,
            }}
          >
            {boardMap}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-[1] flex items-center justify-center overflow-hidden">
          <div
            className="relative max-h-full max-w-full shrink-0 origin-center"
            style={{
              width: GAME_LOGICAL_WIDTH,
              height: GAME_LOGICAL_HEIGHT,
              transform: `scale(${String(landscapeScale)})`,
            }}
          >
            {boardMap}
          </div>
        </div>
      )}
    </div>
  )
}
