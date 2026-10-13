import type { ActionSpec, GameState } from '#api/client.ts'
import { CARD_ACTION_LABELS } from '#game/resolution/cardActionFlows.ts'

/** `ready`: can be played now. `played`: used this turn. `off`: not now. */
export type CardActionRowState = 'ready' | 'played' | 'off'

/** One line of the dock's Cards panel: an action a crafted card grants. */
export type CardActionRow = {
  actionType: string
  label: string
  /** The crafted card that grants the action. */
  defId: string
  /** Phase the action belongs to. */
  phase: string
  state: CardActionRowState
  /** The legal action to start; null unless `ready`. */
  spec: ActionSpec | null
}

type CardActionDefinition = {
  actionType: string
  defId: string
  phase: string
  /** `turnScratch` flag set once the card was used this turn; null when none. */
  usedFlag: string | null
}

const LEAGUE_OF_ADVENTUROUS_MICE_DEF_ID = 'ROOT-81'
const LEAGUE_USED_FLAG = 'leagueUsed'
const BIRDSONG = 'birdsong'
const DAYLIGHT = 'daylight'
const EVENING = 'evening'

/**
 * Optional actions of crafted persistent cards, in turn order. The forced
 * Eyrie Émigré opens by itself and stays out of the panel.
 */
const CARD_ACTION_DEFINITIONS: readonly CardActionDefinition[] = [
  { actionType: 'saboteurs', defId: 'ROOT-93', phase: BIRDSONG, usedFlag: 'saboteursUsed' },
  { actionType: 'swapMeet', defId: 'ROOT-103', phase: BIRDSONG, usedFlag: 'swapMeetUsed' },
  { actionType: 'falseOrders', defId: 'ROOT-72', phase: BIRDSONG, usedFlag: 'falseOrdersUsed' },
  {
    actionType: 'leagueMove',
    defId: LEAGUE_OF_ADVENTUROUS_MICE_DEF_ID,
    phase: DAYLIGHT,
    usedFlag: LEAGUE_USED_FLAG,
  },
  {
    actionType: 'leagueBattle',
    defId: LEAGUE_OF_ADVENTUROUS_MICE_DEF_ID,
    phase: DAYLIGHT,
    usedFlag: LEAGUE_USED_FLAG,
  },
  { actionType: 'propagandaBureau', defId: 'ROOT-86', phase: DAYLIGHT, usedFlag: 'propagandaUsed' },
  { actionType: 'charmOffensive', defId: 'ROOT-59', phase: EVENING, usedFlag: 'charmOffensiveUsed' },
  { actionType: 'informantsTakeAmbush', defId: 'ROOT-79', phase: EVENING, usedFlag: null },
]

function wasUsedThisTurn(state: GameState, usedFlag: string | null): boolean {
  const scratch = state.turnScratch
  if (usedFlag === null || typeof scratch !== 'object' || scratch === null) {
    return false
  }
  return Reflect.get(scratch, usedFlag) === true
}

/**
 * Card actions of the seat's crafted cards, whatever the phase: the ones of
 * another phase and the ones already played show as lines that are off.
 */
export function cardActionRows(
  state: GameState | undefined,
  actorSeat: number,
  legalActions: readonly ActionSpec[],
): CardActionRow[] {
  if (state === undefined) {
    return []
  }
  const actor = state.players.find((player) => player.seat === actorSeat)
  const craftedDefIds: ReadonlySet<string> = new Set(
    (actor?.playArea ?? []).map((card) => card.defId),
  )
  return CARD_ACTION_DEFINITIONS.filter((definition) =>
    craftedDefIds.has(definition.defId),
  ).map((definition): CardActionRow => {
    const spec: ActionSpec | null =
      legalActions.find(
        (legal) =>
          legal.type === definition.actionType && legal.actor === actorSeat,
      ) ?? null
    const isPlayed: boolean =
      definition.phase === state.phase &&
      wasUsedThisTurn(state, definition.usedFlag)
    const rowState: CardActionRowState =
      spec !== null ? 'ready' : isPlayed ? 'played' : 'off'
    return {
      actionType: definition.actionType,
      label: CARD_ACTION_LABELS[definition.actionType] ?? definition.actionType,
      defId: definition.defId,
      phase: definition.phase,
      state: rowState,
      spec,
    }
  })
}

/** Cards tab: card actions played over the card actions of the current phase. */
export function cardActionTally(
  rows: readonly CardActionRow[],
  phase: string,
): string {
  const ofPhase: readonly CardActionRow[] = rows.filter(
    (row) => row.phase === phase,
  )
  const played: number = ofPhase.filter((row) => row.state === 'played').length
  return `${String(played)}/${String(ofPhase.length)} played`
}
