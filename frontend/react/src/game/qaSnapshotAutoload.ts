/** Dev-server route that serves a snapshot JSON file from the repository. */
export const QA_SNAPSHOT_ROUTE = '/qa/snapshot'
/** Query parameter of `QA_SNAPSHOT_ROUTE` holding the file path. */
export const QA_SNAPSHOT_PATH_PARAMETER = 'path'
/** Page URL parameter, e.g. `?qaSnapshot=tmp/qa/snapshots/ui-busy.json`. */
export const QA_SNAPSHOT_URL_PARAMETER = 'qaSnapshot'

/**
 * Snapshot file "QA: Continue loaded game" loads before entering the game.
 * Page URL parameter wins over `ROOT_QA_SNAPSHOT_PATH`; null = keep the slot.
 */
export function readQaSnapshotPath(
  locationSearch: string,
  environmentPath: string | undefined,
): string | null {
  const urlPath: string | null = new URLSearchParams(locationSearch).get(
    QA_SNAPSHOT_URL_PARAMETER,
  )
  const snapshotPath: string = urlPath ?? environmentPath ?? ''
  return snapshotPath.length > 0 ? snapshotPath : null
}

/** Reads the snapshot file through the Vite dev server (not the game API). */
export async function fetchQaSnapshot(snapshotPath: string): Promise<unknown> {
  const query: string = new URLSearchParams({
    [QA_SNAPSHOT_PATH_PARAMETER]: snapshotPath,
  }).toString()
  const response: Response = await fetch(`${QA_SNAPSHOT_ROUTE}?${query}`)
  if (!response.ok) {
    throw new Error(`QA snapshot not readable: ${snapshotPath}`)
  }
  const snapshot: unknown = await response.json()
  return snapshot
}
