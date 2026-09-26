import { ApiError, api, type ActionSpec, type GameState } from '#api/client.js'

const MAX_AUTO_ATTEMPTS = 40
const ATTEMPT_MULTIPLIER = 3
const HAND_SIZE_LIMIT = 5
const MAX_STEPS_PER_TURN = 30

type BuildOption = { clearing: number; building: string }
type OverworkOption = { cardId: string; clearing: number }
type BattleTarget = { clearing: number; defender: number }
type MarchMove = { from: number; to: number; count: number }
type DecreeCardOption = { cardId: string; column: string }

function pick<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let index = out.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[out[index], out[swapIndex]] = [out[swapIndex]!, out[index]!]
  }
  return out
}

function readStringList(values: unknown[] | undefined): string[] {
  if (!values) return []
  return values.filter((value): value is string => typeof value === 'string')
}

function readNumberList(values: unknown[] | undefined): number[] {
  if (!values) return []
  return values.filter((value): value is number => typeof value === 'number')
}

function readBooleanList(values: unknown[] | undefined): boolean[] {
  if (!values) return []
  return values.filter((value): value is boolean => typeof value === 'boolean')
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function readNumberMatrix(values: unknown[] | undefined): number[][] {
  if (!values) return []
  return values.filter(isNumberList)
}

function readBuildOptions(values: unknown[] | undefined): BuildOption[] {
  if (!values) return []
  const options: BuildOption[] = []
  for (const item of values) {
    if (typeof item !== 'object' || item === null) continue
    const clearing = Reflect.get(item, 'clearing')
    const building = Reflect.get(item, 'building')
    if (typeof clearing === 'number' && typeof building === 'string') {
      options.push({ clearing, building })
    }
  }
  return options
}

function readOverworkOptions(values: unknown[] | undefined): OverworkOption[] {
  if (!values) return []
  const options: OverworkOption[] = []
  for (const item of values) {
    if (typeof item !== 'object' || item === null) continue
    const cardId = Reflect.get(item, 'cardId')
    const clearing = Reflect.get(item, 'clearing')
    if (typeof cardId === 'string' && typeof clearing === 'number') {
      options.push({ cardId, clearing })
    }
  }
  return options
}

function readBattleTargets(values: unknown[] | undefined): BattleTarget[] {
  if (!values) return []
  const targets: BattleTarget[] = []
  for (const item of values) {
    if (typeof item !== 'object' || item === null) continue
    const clearing = Reflect.get(item, 'clearing')
    const defender = Reflect.get(item, 'defender')
    if (typeof clearing === 'number' && typeof defender === 'number') {
      targets.push({ clearing, defender })
    }
  }
  return targets
}

function readMarchMoves(values: unknown[] | undefined): MarchMove[] {
  if (!values) return []
  const moves: MarchMove[] = []
  for (const item of values) {
    if (typeof item !== 'object' || item === null) continue
    const from = Reflect.get(item, 'from')
    const to = Reflect.get(item, 'to')
    const count = Reflect.get(item, 'count')
    if (
      typeof from === 'number' &&
      typeof to === 'number' &&
      typeof count === 'number'
    ) {
      moves.push({ from, to, count })
    }
  }
  return moves
}

function readDecreeCardOptions(values: unknown[] | undefined): DecreeCardOption[] {
  if (!values) return []
  const options: DecreeCardOption[] = []
  for (const item of values) {
    if (typeof item !== 'object' || item === null) continue
    const cardId = Reflect.get(item, 'cardId')
    const column = Reflect.get(item, 'column')
    if (typeof cardId === 'string' && typeof column === 'string') {
      options.push({ cardId, column })
    }
  }
  return options
}

function paramList(
  params: ActionSpec['params'],
  key: string,
): unknown[] | undefined {
  if (!params) return undefined
  const value = Reflect.get(params, key)
  return Array.isArray(value) ? value : undefined
}

async function tryAct(
  initialState: GameState,
  specs: ActionSpec[],
): Promise<GameState> {
  let state = initialState
  // Pending events may require a non-current seat (ambush, field hospital, etc.).
  if (specs.some((spec) => spec.type === 'discard')) {
    state = (await api.getGame()).state
    const discardSpec = specs.find((spec) => spec.type === 'discard')
    if (discardSpec) {
      const action = buildActionFor(state, discardSpec)
      if (action) {
        const result = await api.submitAction(action)
        return result.state
      }
    }
  }
  if (specs.some((spec) => spec.type === 'turmoil')) {
    try {
      const result = await api.submitAction({ type: 'turmoil' })
      return result.state
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 400)) throw err
    }
  }
  const candidates = shuffle([...specs])
  const attemptLimit = Math.min(
    MAX_AUTO_ATTEMPTS,
    Math.max(candidates.length * ATTEMPT_MULTIPLIER, 1),
  )
  for (let attempt = 0; attempt < attemptLimit; attempt++) {
    const spec = pick(candidates)
    if (!spec) break
    const action = buildActionFor(state, spec)
    if (!action) continue
    try {
      const result = await api.submitAction(action)
      return result.state
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) continue
      throw err
    }
  }
  const end = candidates.find((spec) => spec.type === 'endPhase')
  if (end) {
    try {
      const result = await api.submitAction({ type: 'endPhase' })
      return result.state
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        throw new Error('no legal action could be applied', { cause: err })
      }
      throw err
    }
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
      const listed = readStringList(paramList(spec.params, 'cardIds'))
      const cardId = pick(listed)
      if (!cardId) return null
      return { type: 'spendBird', cardId }
    }
    case 'craft': {
      const listed = readStringList(paramList(spec.params, 'cardIds'))
      const cardId = pick(listed)
      if (!cardId) return null
      return { type: 'craft', cardId }
    }
    case 'build': {
      const paired = readBuildOptions(paramList(spec.params, 'options'))
      const choice = pick(paired)
      if (!choice) return null
      return {
        type: 'build',
        clearing: choice.clearing,
        building: choice.building,
      }
    }
    case 'overwork': {
      const paired = readOverworkOptions(paramList(spec.params, 'options'))
      const choice = pick(paired)
      if (!choice) return null
      return {
        type: 'overwork',
        clearing: choice.clearing,
        cardId: choice.cardId,
      }
    }
    case 'battle': {
      const targets = readBattleTargets(paramList(spec.params, 'targets'))
      const choice = pick(targets)
      if (!choice) return null
      return {
        type: 'battle',
        clearing: choice.clearing,
        defender: choice.defender,
      }
    }
    case 'march': {
      const listed = readMarchMoves(paramList(spec.params, 'moves'))
      const move = pick(listed)
      if (!move) return null
      return { type: 'march', moves: [move] }
    }
    case 'discard': {
      const actor = state.currentSeat
      const hand = state.players[actor]?.hand ?? []
      const over = Math.max(0, hand.length - HAND_SIZE_LIMIT)
      if (over <= 0) return null
      return {
        type: 'discard',
        cardIds: hand.map((card) => card.id).slice(0, over),
      }
    }
    case 'swapMeet': {
      const targets = state.players.filter(
        (player) => player.seat !== seat && player.hand.length > 0,
      )
      const target = pick(targets)
      const give = pick(state.players[seat]?.hand ?? [])
      if (!target || !give) return null
      return { type: 'swapMeet', target: target.seat, giveCardId: give.id }
    }
    case 'emergencyOrders':
      return { type: 'emergencyOrders' }
    case 'eveningScore':
      return { type: 'eveningScore' }
    case 'turmoil':
      return { type: 'turmoil' }
    case 'addToDecree': {
      const options = readDecreeCardOptions(paramList(spec.params, 'options'))
      const birdIds = new Set(readStringList(paramList(spec.params, 'birdCardIds')))
      if (options.length > 0) {
        const cardCount = Math.min(2, Math.random() < 0.5 ? 1 : 2)
        const picked: DecreeCardOption[] = []
        let birds = 0
        for (const option of shuffle(options)) {
          if (picked.length >= cardCount) break
          if (picked.some((pickedOption) => pickedOption.cardId === option.cardId)) {
            continue
          }
          const isBird = birdIds.has(option.cardId)
          if (isBird && birds >= 1) continue
          picked.push(option)
          if (isBird) birds += 1
        }
        if (picked.length === 0) return null
        return { type: 'addToDecree', cards: picked }
      }
      return null
    }
    case 'newRoost': {
      const clearings =
        readNumberList(paramList(spec.params, 'clearings')).length > 0
          ? readNumberList(paramList(spec.params, 'clearings'))
          : readNumberList(paramList(spec.params, 'clearing'))
      const clearing = pick(clearings)
      if (clearing === undefined) return null
      return { type: 'newRoost', clearing }
    }
    case 'decree': {
      const column = pick(readStringList(paramList(spec.params, 'column')))
      const cardId = pick(readStringList(paramList(spec.params, 'cardIds')))
      if (!column || !cardId) return null
      if (column === 'recruit' || column === 'build') {
        const clearings =
          readNumberList(paramList(spec.params, 'clearings')).length > 0
            ? readNumberList(paramList(spec.params, 'clearings'))
            : readNumberList(paramList(spec.params, 'clearing'))
        const clearing = pick(clearings)
        if (clearing === undefined) return null
        return { type: 'decree', column, cardId, clearing }
      }
      if (column === 'battle') {
        const targets = readBattleTargets(paramList(spec.params, 'targets'))
        const choice = pick(targets)
        if (!choice) return null
        return {
          type: 'decree',
          column,
          cardId,
          clearing: choice.clearing,
          defender: choice.defender,
        }
      }
      if (column === 'move') {
        const moves = readMarchMoves(paramList(spec.params, 'moves'))
        const move = pick(moves)
        if (!move) return null
        return { type: 'decree', column, cardId, moves: [move] }
      }
      return null
    }
    case 'revolt': {
      const options = paramList(spec.params, 'options')
      const choice = pick(
        options.filter(
          (entry): entry is { clearing: number; supporterIds: string[] } =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { clearing?: unknown }).clearing === 'number' &&
            Array.isArray((entry as { supporterIds?: unknown }).supporterIds),
        ),
      )
      if (choice === undefined) return null
      return {
        type: 'revolt',
        clearing: choice.clearing,
        supporterIds: choice.supporterIds,
      }
    }
    case 'spreadSympathy': {
      const clearings = readNumberList(paramList(spec.params, 'clearings'))
      const clearing = pick(clearings)
      const supporterIds = readStringList(paramList(spec.params, 'supporterIds'))
      if (clearing === undefined || supporterIds.length === 0) return null
      return { type: 'spreadSympathy', clearing, supporterIds }
    }
    case 'mobilize': {
      const cardId = pick(readStringList(paramList(spec.params, 'cardIds')))
      if (!cardId) return null
      return { type: 'mobilize', cardId }
    }
    case 'train': {
      const cardId = pick(readStringList(paramList(spec.params, 'cardIds')))
      if (!cardId) return null
      return { type: 'train', cardId }
    }
    case 'militaryOp': {
      const op = pick(readStringList(paramList(spec.params, 'op')))
      if (op === 'move') {
        const move = pick(readMarchMoves(paramList(spec.params, 'moves')))
        if (!move) return null
        return {
          type: 'militaryOp',
          op: 'move',
          from: move.from,
          to: move.to,
          count: move.count,
        }
      }
      if (op === 'battle') {
        const choice = pick(readBattleTargets(paramList(spec.params, 'targets')))
        if (!choice) return null
        return {
          type: 'militaryOp',
          op: 'battle',
          clearing: choice.clearing,
          defender: choice.defender,
        }
      }
      if (op === 'recruit' || op === 'organize') {
        const clearing = pick(readNumberList(paramList(spec.params, 'clearings')))
        if (clearing === undefined) return null
        return { type: 'militaryOp', op, clearing }
      }
      return null
    }
    case 'refresh':
      return { type: 'refresh' }
    case 'rest':
      return { type: 'rest' }
    case 'explore':
      return { type: 'explore' }
    case 'slip': {
      const forests = readNumberList(paramList(spec.params, 'forests'))
      const clearings = readNumberList(paramList(spec.params, 'clearings'))
      if (forests.length > 0 && Math.random() < 0.5) {
        const forest = pick(forests)
        if (forest === undefined) return null
        return { type: 'slip', to: `forest:${forest}` }
      }
      const clearing = pick(clearings)
      if (clearing !== undefined) return { type: 'slip', to: clearing }
      const forest = pick(forests)
      if (forest === undefined) return null
      return { type: 'slip', to: `forest:${forest}` }
    }
    case 'vbMove': {
      const vbMovesRaw = paramList(spec.params, 'vbMoves')
      if (vbMovesRaw !== undefined && vbMovesRaw.length > 0) {
        const choices = vbMovesRaw.filter(
          (entry): entry is { to: number; allySeat?: number; allyCount?: number } =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { to?: unknown }).to === 'number',
        )
        const choice = pick(choices)
        if (choice === undefined) return null
        if (choice.allySeat !== undefined && choice.allyCount !== undefined) {
          return {
            type: 'vbMove',
            to: choice.to,
            allySeat: choice.allySeat,
            allyCount: choice.allyCount,
          }
        }
        return { type: 'vbMove', to: choice.to }
      }
      const to = pick(readNumberList(paramList(spec.params, 'clearings')))
      if (to === undefined) return null
      return { type: 'vbMove', to }
    }
    case 'vbBattle': {
      const choice = pick(readBattleTargets(paramList(spec.params, 'targets')))
      if (!choice) return null
      const allied = readNumberList(paramList(spec.params, 'alliedSeat'))
      if (allied[0] !== undefined) {
        return {
          type: 'vbBattle',
          defender: choice.defender,
          alliedSeat: allied[0],
        }
      }
      return { type: 'vbBattle', defender: choice.defender }
    }
    case 'vbRearrange': {
      const itemTypes = readStringList(paramList(spec.params, 'itemTypes'))
      const fromList = readStringList(paramList(spec.params, 'rearrangeFrom'))
      const itemType = pick(itemTypes)
      const from = pick(fromList)
      if (
        (itemType !== 'tea' && itemType !== 'coin' && itemType !== 'bag') ||
        (from !== 'track' && from !== 'satchel')
      ) {
        return null
      }
      return { type: 'vbRearrange', itemType, from }
    }
    case 'aid': {
      const cardId = pick(readStringList(paramList(spec.params, 'cardIds')))
      const target = pick(readNumberList(paramList(spec.params, 'defender')))
      if (!cardId || target === undefined) return null
      return { type: 'aid', cardId, target }
    }
    case 'strike': {
      const choice = pick(readBattleTargets(paramList(spec.params, 'targets')))
      if (!choice) return null
      return { type: 'strike', defender: choice.defender }
    }
    case 'repair': {
      const itemIndex = pick(readNumberList(paramList(spec.params, 'clearings')))
      if (itemIndex === undefined) return null
      return { type: 'repair', itemIndex }
    }
    case 'vbCraft': {
      const cardId = pick(readStringList(paramList(spec.params, 'cardIds')))
      if (!cardId) return null
      return { type: 'vbCraft', cardId }
    }
    case 'steal': {
      const target = pick(readNumberList(paramList(spec.params, 'defender')))
      if (target === undefined) return null
      return { type: 'steal', target }
    }
    case 'resolveEvent': {
      const params = spec.params
      const clearingList = paramList(params, 'clearing')
      // Setup chooseKeep: params.clearing = corner ids
      if (
        clearingList &&
        clearingList.length > 0 &&
        typeof clearingList[0] === 'number'
      ) {
        const clearing = pick(readNumberList(clearingList))
        if (clearing !== undefined) return { type: 'resolveEvent', clearing }
      }
      // Setup / depose chooseLeader
      const leaders = paramList(params, 'leaders')
      if (leaders && leaders.length > 0 && typeof leaders[0] === 'string') {
        const leader = pick(readStringList(leaders))
        if (leader) return { type: 'resolveEvent', leader }
      }
      // Removal stage: params.pieceIds is domain of removable piece ids
      const pieceIds = paramList(params, 'pieceIds')
      if (pieceIds && pieceIds.length > 0 && typeof pieceIds[0] === 'string') {
        return { type: 'resolveEvent', pieceIds: readStringList(pieceIds) }
      }
      // Order stage: params.order is Seat[][]
      const orderList = paramList(params, 'order')
      if (orderList && orderList.length > 0) {
        const order = pick(readNumberMatrix(orderList))
        if (order) return { type: 'resolveEvent', order }
      }
      const cardId = pick(readStringList(paramList(params, 'cardIds')))
      if (cardId) return { type: 'resolveEvent', cardId }
      const useEffectList = paramList(params, 'useEffect')
      if (useEffectList && useEffectList.length > 0) {
        const useEffect = pick(readBooleanList(useEffectList))
        if (useEffect !== undefined) return { type: 'resolveEvent', useEffect }
      }
      const declineList = readBooleanList(paramList(params, 'decline'))
      if (declineList.includes(true)) return { type: 'resolveEvent', decline: true }
      return { type: 'resolveEvent', decline: true }
    }
    default:
      return null
  }
}

export async function cmdAuto(
  turns: number,
  players: number,
  factions?: string[],
): Promise<void> {
  await api.deleteGame().catch(() => {})
  const created = await api.createGame({
    ...(factions === undefined ? {} : { factions }),
    replace: true,
  })
  const roster = created.state.factions.slice(0, players)
  if (roster.length < 2) {
    throw new Error(`need ≥2 factions to auto-play, got ${roster.length}`)
  }
  // playerId = faction id (marquise, eyrie, …); suffix if duplicate seats
  const seen = new Map<string, number>()
  for (const faction of roster) {
    const nextCount = (seen.get(faction) ?? 0) + 1
    seen.set(faction, nextCount)
    const playerId = nextCount === 1 ? faction : `${faction}-${nextCount}`
    await api.join(playerId)
  }
  let state = (await api.start()).state
  console.log(
    `auto start factions=${roster.join(',')} maxTurns=${turns} (new+join+start)`,
  )

  let steps = 0
  while (
    (state.status === 'playing' || state.status === 'setup') &&
    state.turn <= turns &&
    steps < turns * MAX_STEPS_PER_TURN
  ) {
    const { actions } = await api.legalActions()
    state = await tryAct(state, actions)
    steps++
    if (state.status === 'finished') break
  }

  if (state.status === 'finished') {
    const winner = state.players.find((player) => player.seat === state.winner)
    const who = winner ? winner.playerId : 'unknown'
    console.log(`winner ${who} turn ${state.turn}`)
  } else {
    console.log(`turn cap turn=${state.turn} status=${state.status}`)
  }
  for (const player of state.players) {
    console.log(`  ${player.playerId} vp=${player.vp}`)
  }
}
