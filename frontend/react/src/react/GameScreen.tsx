import { useEffect, useState, type JSX } from 'react'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import type { BoardLayout } from '#game/boardLayout.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import type { ViewportLayoutMode } from '#game/viewportLayout.ts'
import { BoardMap } from '#react/BoardMap.tsx'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'
import '#react/GameScreen.css'

export type GameScreenProps = {
  layout: BoardLayout | null
  layoutMode: ViewportLayoutMode
  clearings: readonly BoardClearingPieces[] | null
  factions: readonly string[] | null
  highlightedClearingIds: readonly number[]
  onClearingSelected: (clearingId: number) => void
}

function useLetterboxScale(layoutMode: ViewportLayoutMode): number {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const updateScale = (): void => {
      const widthScale = window.innerWidth / GAME_LOGICAL_WIDTH
      const heightScale = window.innerHeight / GAME_LOGICAL_HEIGHT
      const next =
        layoutMode === 'portrait'
          ? widthScale
          : Math.min(widthScale, heightScale)
      setScale(next)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    window.addEventListener('orientationchange', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      window.removeEventListener('orientationchange', updateScale)
    }
  }, [layoutMode])
  return scale
}

export function GameScreen(props: GameScreenProps): JSX.Element {
  const wallpaperPath = imagePathForAssetKey(GAME_ASSET_KEYS.gameWallpaper)
  const scale = useLetterboxScale(props.layoutMode)
  const letterboxClassName =
    props.layoutMode === 'portrait'
      ? 'game-screen__letterbox game-screen__letterbox--portrait'
      : 'game-screen__letterbox'
  return (
    <div className="game-screen">
      {wallpaperPath !== null ? (
        <img
          className="game-screen__wallpaper"
          src={wallpaperPath}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="game-screen__wallpaper game-screen__wallpaper--fallback" />
      )}
      <div className={letterboxClassName}>
        <div
          className="game-screen__stage"
          style={{
            width: GAME_LOGICAL_WIDTH,
            height: GAME_LOGICAL_HEIGHT,
            transform: `scale(${String(scale)})`,
          }}
        >
          {props.layout !== null ? (
            <BoardMap
              layout={props.layout}
              layoutMode={props.layoutMode}
              {...(props.clearings !== null
                ? { clearings: props.clearings }
                : {})}
              {...(props.factions !== null
                ? { factions: props.factions }
                : {})}
              highlightedClearingIds={props.highlightedClearingIds}
              onClearingSelected={props.onClearingSelected}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
