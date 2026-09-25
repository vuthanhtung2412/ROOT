import { useEffect, useState, type JSX } from 'react'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import type { BoardLayout } from '#game/boardLayout.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import { BoardMap } from '#react/BoardMap.tsx'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'
import '#react/GameScreen.css'

export type GameScreenProps = {
  layout: BoardLayout | null
  clearings: readonly BoardClearingPieces[] | null
  factions: readonly string[] | null
  highlightedClearingIds: readonly number[]
  onClearingSelected: (clearingId: number) => void
}

function useLetterboxScale(): number {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const updateScale = (): void => {
      const next = Math.min(
        window.innerWidth / GAME_LOGICAL_WIDTH,
        window.innerHeight / GAME_LOGICAL_HEIGHT,
      )
      setScale(next)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
    }
  }, [])
  return scale
}

export function GameScreen(props: GameScreenProps): JSX.Element {
  const wallpaperPath = imagePathForAssetKey(GAME_ASSET_KEYS.gameWallpaper)
  const scale = useLetterboxScale()
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
      <div className="game-screen__letterbox">
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
              clearings={props.clearings ?? undefined}
              factions={props.factions ?? undefined}
              highlightedClearingIds={props.highlightedClearingIds}
              onClearingSelected={props.onClearingSelected}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
