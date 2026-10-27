import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type Context,
  type RefObject,
} from 'react'
import { atMomentPace, MOMENT_SLOWDOWN } from '#game/momentPace.ts'

/** How many times slower than the mockup the moment around plays. */
export const MomentSlowdownContext: Context<number> =
  createContext<number>(MOMENT_SLOWDOWN)

/** Run a Web Animation on the element for as long as it is mounted. */
export function useKeyframes(
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): RefObject<HTMLDivElement | null> {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const keyframesRef = useRef<Keyframe[]>(keyframes)
  const optionsRef = useRef<KeyframeAnimationOptions>(options)
  useEffect(() => {
    const element = elementRef.current
    if (element === null || typeof element.animate !== 'function') {
      return undefined
    }
    const animation = element.animate(keyframesRef.current, optionsRef.current)
    return () => {
      animation.cancel()
    }
  }, [])
  return elementRef
}

/** One animation of an element that plays several, each at its own delay. */
export type KeyframeStep = {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
}

/** `useKeyframeSteps` at the pace of the woodland moments (`momentPace`). */
export function useMomentKeyframeSteps(
  steps: readonly KeyframeStep[],
): RefObject<HTMLDivElement | null> {
  const slowdown: number = useContext(MomentSlowdownContext)
  return useKeyframeSteps(
    steps.map(
      (step: KeyframeStep): KeyframeStep => ({
        keyframes: step.keyframes,
        options: atMomentPace(step.options, slowdown),
      }),
    ),
  )
}

/** Run several Web Animations on the element for as long as it is mounted. */
export function useKeyframeSteps(
  steps: readonly KeyframeStep[],
): RefObject<HTMLDivElement | null> {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const stepsRef = useRef<readonly KeyframeStep[]>(steps)
  useEffect(() => {
    const element = elementRef.current
    if (element === null || typeof element.animate !== 'function') {
      return undefined
    }
    const animations: Animation[] = stepsRef.current.map(
      (step: KeyframeStep): Animation =>
        element.animate(step.keyframes, step.options),
    )
    return () => {
      for (const animation of animations) {
        animation.cancel()
      }
    }
  }, [])
  return elementRef
}
