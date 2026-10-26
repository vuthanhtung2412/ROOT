/**
 * Pace of the woodland moments (explore, revolt, turmoil, leader pick).
 * Their beats are written at the speed of the mockup; every beat plays this
 * many times slower in the game, so the table can follow what happens.
 */
export const MOMENT_SLOWDOWN = 2
/** The Eyrie moments (turmoil, leader pick) are long already. */
export const EYRIE_MOMENT_SLOWDOWN = 1.5

/** A beat of a moment, from its mockup time to its time in the game. */
export function momentMs(
  mockupMs: number,
  slowdown: number = MOMENT_SLOWDOWN,
): number {
  return mockupMs * slowdown
}

/** The timing of a moment animation, at the moment pace. */
export function atMomentPace(
  options: KeyframeAnimationOptions,
  slowdown: number = MOMENT_SLOWDOWN,
): KeyframeAnimationOptions {
  const paced: KeyframeAnimationOptions = {
    ...options,
    delay: momentMs(options.delay ?? 0, slowdown),
  }
  return typeof options.duration === 'number'
    ? { ...paced, duration: momentMs(options.duration, slowdown) }
    : paced
}
