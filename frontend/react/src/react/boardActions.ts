import { useSyncExternalStore } from 'react'
import type { ActionSpec } from '#api/client.ts'
import { getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import { filterTrayActions } from '#ui/ActionTray.ts'

/** Outline on a faction-board piece the acting player may click. */
export const BOARD_CLICKABLE_OUTLINE_CLASS_NAME =
  'pointer-events-auto cursor-pointer rounded-md ring-[3px] ring-rust'

/** Outlined small piece (item token) that also grows on hover. */
export const BOARD_CLICKABLE_CLASS_NAME = `${BOARD_CLICKABLE_OUTLINE_CLASS_NAME} transition-transform hover:scale-110`

/**
 * Legal actions of the acting local player, for click targets on a faction
 * board. Empty while another seat acts or an action is being resolved.
 */
export function useActingPlayerActions(): ActionSpec[] {
  const tray = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().actionTray,
    () => getHudSnapshot().actionTray,
  )
  if (tray === null) {
    return []
  }
  return filterTrayActions(tray.actions, tray.actorSeat, tray.options)
}
