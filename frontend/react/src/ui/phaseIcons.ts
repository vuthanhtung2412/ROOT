import type { IconType } from 'react-icons'
import { LuMoon, LuSun, LuSunrise } from 'react-icons/lu'

/** Time of day of a turn; setup and other phases have no icon. */
const PHASE_ICONS: Readonly<Record<string, IconType>> = {
  birdsong: LuSunrise,
  daylight: LuSun,
  evening: LuMoon,
}

export function phaseIconFor(phase: string): IconType | null {
  return PHASE_ICONS[phase] ?? null
}
