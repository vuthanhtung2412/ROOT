import { useCallback, useState } from 'react'

/** The flat painted map, or the 3D scene built on it. */
export type MapViewMode = 'flat' | '3d'

export const MAP_VIEW_MODE_STORAGE_KEY = 'root.mapViewMode'
const DEFAULT_MAP_VIEW_MODE: MapViewMode = 'flat'

function isMapViewMode(value: string | null): value is MapViewMode {
  return value === 'flat' || value === '3d'
}

function readStoredMapViewMode(): MapViewMode {
  try {
    const stored: string | null = window.localStorage.getItem(
      MAP_VIEW_MODE_STORAGE_KEY,
    )
    return isMapViewMode(stored) ? stored : DEFAULT_MAP_VIEW_MODE
  } catch {
    // Storage can be blocked (private window): the choice just is not kept.
    return DEFAULT_MAP_VIEW_MODE
  }
}

export type MapViewModeState = {
  mapViewMode: MapViewMode
  toggleMapViewMode: () => void
}

/** Which map the player looks at; remembered in this browser. */
export function useMapViewMode(): MapViewModeState {
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>(
    readStoredMapViewMode,
  )
  const toggleMapViewMode = useCallback((): void => {
    setMapViewMode((current: MapViewMode): MapViewMode => {
      const next: MapViewMode = current === 'flat' ? '3d' : 'flat'
      try {
        window.localStorage.setItem(MAP_VIEW_MODE_STORAGE_KEY, next)
      } catch {
        // Same as above: without storage the choice lasts until reload.
      }
      return next
    })
  }, [])
  return { mapViewMode, toggleMapViewMode }
}
