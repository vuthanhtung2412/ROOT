import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchQaSnapshot,
  readQaSnapshotPath,
} from '#game/qaSnapshotAutoload.ts'
import { makeFetchResponse, makeGameState } from '#test/factories.ts'

const SNAPSHOT_PATH = 'tmp/qa/snapshots/ui-busy.json'

describe('readQaSnapshotPath', () => {
  it('returns null when neither the URL nor the environment names a file', () => {
    expect(readQaSnapshotPath('', undefined)).toBeNull()
    expect(readQaSnapshotPath('?qaSnapshot=', '')).toBeNull()
  })

  it('falls back to the environment path', () => {
    expect(readQaSnapshotPath('', SNAPSHOT_PATH)).toBe(SNAPSHOT_PATH)
  })

  it('prefers the page URL parameter over the environment path', () => {
    expect(
      readQaSnapshotPath(`?qaSnapshot=${SNAPSHOT_PATH}`, 'other.json'),
    ).toBe(SNAPSHOT_PATH)
  })
})

describe('fetchQaSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the file through the dev-server route', async () => {
    const snapshot = { state: makeGameState() }
    const fetchMock = vi.fn(async () => makeFetchResponse(snapshot))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchQaSnapshot(SNAPSHOT_PATH)).resolves.toEqual(snapshot)
    expect(fetchMock).toHaveBeenCalledWith(
      '/qa/snapshot?path=tmp%2Fqa%2Fsnapshots%2Fui-busy.json',
    )
  })

  it('throws when the dev server cannot read the file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => makeFetchResponse({}, 404)),
    )

    await expect(fetchQaSnapshot(SNAPSHOT_PATH)).rejects.toThrow(
      `QA snapshot not readable: ${SNAPSHOT_PATH}`,
    )
  })
})
