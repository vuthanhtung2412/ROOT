import { ApiError, api, type ActionSpec, type GameState } from '../api/client.js'

const BUILDINGS = ['sawmill', 'workshop', 'recruiter'] as const
const FALL_PATHS: [number, number][] = [
  [0, 4],
  [0, 8],
  [0, 9],
  [1, 4],
  [1, 5],
  [1, 9],
  [2, 5],
  [2, 6],
  [2, 10],
  [3, 7],
  [3, 8],
  [3, 11],
  [5, 10],
  [6, 7],
  [6, 11],
  [8, 11],
  [9, 11],
  [10, 11],
]

const ADJ = new Map<number, number[]>()
for (const [a, b] of FALL_PATHS) {
  ADJ.set(a, [...(ADJ.get(a) ?? []), b])
  ADJ.set(b, [...(ADJ.get(b) ?? []), a])
}

function pick<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

function warriorsAt(state: GameState, seat: number, clearing: number): number {
  const c = state.clearings?.[clearing]
  if (!c) return 0
  return c.pieces.filter((p) => p.owner === seat && p.kind === 'warrior').length
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

async function tryAct(state: GameState, specs: ActionSpec[]): Promise<GameState> {
  // Pending events may require a non-current seat (ambush, field hospital, etc.).
  const candidates = shuffle([...specs])
  for (let attempt = 0; attempt < Math.min(40, Math.max(candidates.length * 3, 1)); attempt++) {
    const spec = pick(candidates)
    if (!spec) break
    const action = buildActionFor(state, spec)
    if (!action) continue
    try {
      const result = await api.act(action)
      return result.state
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) continue
      throw err
    }
  }
  const end = candidates.find((s) => s.type === 'endPhase')
  if (end) {
    const result = await api.act({ type: 'endPhase' })
    return result.state
  }
  throw new Error('no legal action could be applied')
}

function buildActionFor(state: GameState, spec: ActionSpec): unknown | null {
  const seat = spec.actor
  switch (spec.type) {
    case 'endPhase':
      return { type: 'endPhase' }
    case 'recruit':
      return { type: 'recruit' }
    case 'join':
      return null
    case 'start':
      return { type: 'start' }
    case 'birdsongWood':
      return { type: 'birdsongWood' }
    case 'eveningDraw':
      return { type: 'eveningDraw' }
    case 'spendBird': {
      const hand = state.players[seat]?.hand ?? []
      const bird = hand.find((c) => {
        // bird suit cards — defId alone insufficient; try known bird ambush/dominance roots via params later
        return c.defId.startsWith('ROOT-20') || c.defId === 'ROOT-200' || c.defId === 'ROOT-94' || c.defId === 'ROOT-95'
      })
      // Prefer params if server listed cardIds
      const listed = (spec.params?.cardIds as string[] | undefined) ?? []
      const cardId = pick(listed) ?? bird?.id
      if (!cardId) {
        // fallback: any hand card tagged bird by fetching is hard; try first hand card often fails — scan all
        const any = pick(hand)
        if (!any) return null
        return { type: 'spendBird', cardId: any.id }
      }
      return { type: 'spendBird', cardId }
    }
    case 'craft': {
      const listed = (spec.params?.cardIds as string[] | undefined) ?? []
      const hand = state.players[seat]?.hand ?? []
      const cardId = pick(listed) ?? pick(hand)?.id
      if (!cardId) return null
      return { type: 'craft', cardId }
    }
    case 'build': {
      const clearings = (spec.params?.clearing as number[] | undefined) ?? [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      ]
      const buildings = (spec.params?.building as string[] | undefined) ?? [...BUILDINGS]
      for (const clearing of shuffle(clearings)) {
        for (const building of shuffle(buildings)) {
          return { type: 'build', clearing, building }
        }
      }
      return null
    }
    case 'overwork': {
      const hand = state.players[seat]?.hand ?? []
      const clearings = (spec.params?.clearing as number[] | undefined) ?? [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      ]
      const cardIds = (spec.params?.cardIds as string[] | undefined) ?? hand.map((c) => c.id)
      for (const clearing of shuffle(clearings)) {
        for (const cardId of shuffle(cardIds)) {
          return { type: 'overwork', clearing, cardId }
        }
      }
      return null
    }
    case 'battle': {
      const clearings = (spec.params?.clearing as number[] | undefined) ?? [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      ]
      const defenders = (spec.params?.defender as number[] | undefined) ??
        state.players.map((p) => p.seat).filter((s) => s !== seat)
      for (const clearing of shuffle(clearings)) {
        for (const defender of shuffle(defenders)) {
          return { type: 'battle', clearing, defender }
        }
      }
      return null
    }
    case 'march': {
      const froms = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(
        (c) => warriorsAt(state, seat, c) > 0,
      )
      const from = pick(froms)
      if (from === undefined) return null
      const neighbors = ADJ.get(from) ?? []
      const to = pick(neighbors)
      if (to === undefined) return null
      return { type: 'march', moves: [{ from, to, count: 1 }] }
    }
    case 'discard': {
      const hand = state.players[seat]?.hand ?? []
      const listed = (spec.params?.cardIds as string[] | undefined) ?? hand.map((c) => c.id)
      const over = Math.max(0, hand.length - 5)
      if (over <= 0) return null
      return { type: 'discard', cardIds: listed.slice(0, over) }
    }
    case 'swapMeet': {
      const targets = state.players.filter((p) => p.seat !== seat && p.hand.length > 0)
      const target = pick(targets)
      const give = pick(state.players[seat]?.hand ?? [])
      if (!target || !give) return null
      return { type: 'swapMeet', target: target.seat, giveCardId: give.id }
    }
    case 'resolveEvent': {
      const p = spec.params
      // Removal stage: params.pieceIds is domain of removable piece ids
      if (Array.isArray(p?.pieceIds) && p.pieceIds.length > 0 && typeof p.pieceIds[0] === 'string') {
        return { type: 'resolveEvent', pieceIds: [...(p.pieceIds as string[])] }
      }
      // Order stage: params.order is Seat[][]
      if (Array.isArray(p?.order) && p.order.length > 0) {
        const order = pick(p.order as number[][])
        if (order) return { type: 'resolveEvent', order }
      }
      const cardId = pick((p?.cardIds as string[] | undefined) ?? [])
      if (cardId) return { type: 'resolveEvent', cardId }
      if (Array.isArray(p?.useEffect) && p.useEffect.length > 0) {
        const useEffect = pick(p.useEffect as boolean[])
        if (useEffect !== undefined) return { type: 'resolveEvent', useEffect }
      }
      if (p?.decline?.includes(true)) return { type: 'resolveEvent', decline: true }
      return { type: 'resolveEvent', decline: true }
    }
    default:
      return null
  }
}

export async function cmdAuto(turns: number, players: number) {
  await api.delete().catch(() => {})
  await api.create()
  for (let i = 0; i < players; i++) {
    await api.join(`auto-p${i}`)
  }
  let state = (await api.start()).state
  console.log(`auto start seed=${state.seed} players=${players} maxTurns=${turns}`)

  let steps = 0
  while (state.status === 'playing' && state.turn <= turns && steps < turns * 30) {
    const { actions } = await api.actions()
    state = await tryAct(state, actions)
    steps++
    if (state.status === 'finished') break
  }

  if (state.status === 'finished') {
    console.log(`winner seat ${state.winner} turn ${state.turn}`)
  } else {
    console.log(`turn cap turn=${state.turn} status=${state.status}`)
  }
  for (const p of state.players) {
    console.log(`  seat ${p.seat} vp=${p.vp}`)
  }
}
