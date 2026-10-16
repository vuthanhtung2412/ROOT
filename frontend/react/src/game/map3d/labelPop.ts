import { MathUtils } from 'three'

/**
 * The 2D labels over the map (piece icons, clearing suits) shrink with the
 * zoom and are gone by this much of it (0 = out, 1 = in): the 3D pieces
 * stand at full size and speak for themselves. Past it, the label of what
 * the pointer is over pops up, and shrinks away once the pointer leaves.
 */
export const LABELS_GONE_FROM_ZOOM = 0.5

/** Time to pop up, or to shrink back away. */
const POP_SECONDS = 0.22
/** How far the pop overshoots before it settles (ease-out-back). */
const POP_OVERSHOOT = 1.7

/** 1 zoomed all the way out, down to 0 at the threshold. */
export function zoomedLabelScale(zoom: number): number {
  return MathUtils.clamp(1 - zoom / LABELS_GONE_FROM_ZOOM, 0, 1)
}

/** 0 → 1, past 1 for a moment before it settles back on it. */
function easeOutBack(progress: number): number {
  const shifted: number = progress - 1
  return (
    1 +
    (POP_OVERSHOOT + 1) * shifted * shifted * shifted +
    POP_OVERSHOOT * shifted * shifted
  )
}

type PopState = {
  /** How far along this pop up or shrink away is: 0 → 1. */
  progress: number
  rising: boolean
  /** The size it had when it last turned: it eases on from there. */
  fromScale: number
}

export type LabelPops<Key> = {
  /** What the pointer is over now, or null. */
  setHovered: (key: Key | null) => void
  /** Call once per frame. */
  update: (deltaSeconds: number) => void
  /** 0 = not popped up; about 1 when it is, a little more mid-pop. */
  scaleOf: (key: Key) => number
}

function scaleOfPop(pop: PopState): number {
  return pop.rising
    ? MathUtils.lerp(pop.fromScale, 1, easeOutBack(pop.progress))
    : pop.fromScale * (1 - MathUtils.smoothstep(pop.progress, 0, 1))
}

/** Turned mid-pop, it goes on from the size it has: no jump. */
function turnedPop(pop: PopState | undefined, rising: boolean): PopState {
  return {
    progress: 0,
    rising,
    fromScale: pop === undefined ? 0 : scaleOfPop(pop),
  }
}

export function createLabelPops<Key>(): LabelPops<Key> {
  let hoveredKey: Key | null = null
  const pops: Map<Key, PopState> = new Map<Key, PopState>()

  return {
    setHovered: (key: Key | null): void => {
      if (key === hoveredKey) {
        return
      }
      hoveredKey = key
      for (const [poppedKey, pop] of pops) {
        if (pop.rising) {
          pops.set(poppedKey, turnedPop(pop, false))
        }
      }
      if (key !== null) {
        pops.set(key, turnedPop(pops.get(key), true))
      }
    },
    update: (deltaSeconds: number): void => {
      const step: number = deltaSeconds / POP_SECONDS
      for (const [key, pop] of pops) {
        pop.progress = Math.min(pop.progress + step, 1)
        if (!pop.rising && pop.progress === 1) {
          pops.delete(key)
        }
      }
    },
    scaleOf: (key: Key): number => {
      const pop: PopState | undefined = pops.get(key)
      return pop === undefined ? 0 : scaleOfPop(pop)
    },
  }
}
