import { useEffect, useRef, useState } from 'react'
import type { BoardEffectBatch } from '#game/boardEffects.ts'
import type { MapScene } from '#game/map3d/mapScene.ts'
import { batchLifetime } from '#react/boardEffectTiming.ts'

/**
 * While the camera moves and nothing plays over the map, the overlays (the
 * click targets, which nobody sees) follow it this often, not on each frame.
 */
const IDLE_VIEW_REFRESH_MILLISECONDS = 100

/**
 * A number that bumps when the camera moved: overlays re-project when it
 * changes. On every frame while an effect plays over the map, so it stays on
 * its pieces; a few times per second otherwise, and once the camera rests.
 */
export function useViewVersion(
  scene: MapScene | null,
  effects: BoardEffectBatch | undefined,
): number {
  const [viewVersion, setViewVersion] = useState<number>(0)
  /** Until then (page clock), an effect is on screen. */
  const effectsPlayUntilMilliseconds = useRef<number>(0)

  useEffect(() => {
    if (effects !== undefined) {
      effectsPlayUntilMilliseconds.current =
        performance.now() + batchLifetime(effects)
    }
  }, [effects])

  useEffect(() => {
    if (scene === null) {
      return undefined
    }
    let lastBumpMilliseconds = 0
    let trailingTimer: number | null = null
    const bump = (): void => {
      if (trailingTimer !== null) {
        window.clearTimeout(trailingTimer)
        trailingTimer = null
      }
      lastBumpMilliseconds = performance.now()
      setViewVersion((version: number): number => version + 1)
    }
    const stopListening: () => void = scene.onViewChanged((): void => {
      const nowMilliseconds: number = performance.now()
      const sinceLastBump: number = nowMilliseconds - lastBumpMilliseconds
      if (
        nowMilliseconds < effectsPlayUntilMilliseconds.current ||
        sinceLastBump >= IDLE_VIEW_REFRESH_MILLISECONDS
      ) {
        bump()
        return
      }
      // The last move of the camera must still be followed.
      trailingTimer ??= window.setTimeout(
        bump,
        IDLE_VIEW_REFRESH_MILLISECONDS - sinceLastBump,
      )
    })
    return (): void => {
      stopListening()
      if (trailingTimer !== null) {
        window.clearTimeout(trailingTimer)
      }
    }
  }, [scene])

  return viewVersion
}
