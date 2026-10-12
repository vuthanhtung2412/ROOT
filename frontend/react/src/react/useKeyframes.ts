import { useEffect, useRef, type RefObject } from 'react'

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
