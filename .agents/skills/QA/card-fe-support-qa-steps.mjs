/**
 * Steps of the crafted-card demo (replay-card-fe-support-qa.mjs).
 * Plan: resources/notes/QA-plan-card-fe-support.md — titles carry the plan step
 * numbers and the case ids (C1…C8) each step shows.
 *
 * One step: `play` clicks through the UI, `verify` checks the server state and
 * returns the caption detail.
 */
const MARQUISE = 0
const ALLIANCE = 1

const FALSE_ORDERS_ORIGIN = 1
const FALSE_ORDERS_DESTINATION = 5
const PROPAGANDA_CLEARING = 6
const ALLIANCE_CLEARING = 9
const LEAGUE_DESTINATION = 4

const CARD = {
  ambushFox: 'ROOT-202',
  mouseInASack: 'ROOT-218',
  sword: 'ROOT-224',
  travelGearMouse: 'ROOT-226',
  boatBuilders: 'ROOT-57',
  coffinMakers: 'ROOT-62',
  eyrieEmigre: 'ROOT-71',
  falseOrders: 'ROOT-72',
  saboteurs: 'ROOT-93',
  tunnels: 'ROOT-108',
}

/** How long a prompt stays on screen before the next click. */
const PROMPT_LOOK_MS = 1400
const MOVE_SLIDE_MS = 1600
const BATTLE_RESULT_LOOK_MS = 2400

function expectThat(condition, message) {
  if (!condition) throw new Error(message)
}

function expectEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  expectThat(actualText === expectedText, `${label} = ${actualText}, expected ${expectedText}`)
}

const handOf = (state, seat) => state.players[seat].hand.map((card) => card.defId)
const playAreaOf = (state, seat) => state.players[seat].playArea.map((card) => card.defId)
const discardCount = (state) => state.deck.discard.length

function warriorsIn(state, clearingId, owner) {
  return state.clearings[clearingId].pieces.filter(
    (piece) => piece.kind === 'warrior' && piece.owner === owner,
  ).length
}

function coffinMakersCount(state) {
  const coffinMakers = state.players[ALLIANCE].playArea.find(
    (card) => card.defId === CARD.coffinMakers,
  )
  return coffinMakers?.heldWarriors ?? 0
}

export const CARD_FE_SUPPORT_STEPS = [
  {
    title: '1 · Alliance Birdsong: the card buttons are in the tray',
    play: async (ui) => {
      // The Marquise Evening has only "end phase" left: the UI ends it alone.
      await ui.waitForButton('saboteurs')
      const seen = {
        swapMeet: await ui.seesButton('swap meet'),
        falseOrders: await ui.seesButton('false orders'),
        league: await ui.seesButton('league: move'),
      }
      await ui.pause(PROMPT_LOOK_MS)
      return seen
    },
    verify: (state, seen) => {
      expectEqual(state.currentSeat, ALLIANCE, 'current seat')
      expectEqual(state.phase, 'birdsong', 'phase')
      expectEqual(seen, { swapMeet: true, falseOrders: true, league: false }, 'tray buttons')
      return 'saboteurs, swap meet, false orders offered; no Daylight card yet'
    },
  },
  {
    title: '2–3 · Saboteurs: enemy, then one of their crafted cards (C2)',
    play: async (ui) => {
      await ui.button('saboteurs')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.button('marquise')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.galleryCard(CARD.boatBuilders)
    },
    verify: (state) => {
      expectEqual(playAreaOf(state, MARQUISE), [CARD.tunnels], 'Marquise crafted cards')
      expectThat(!playAreaOf(state, ALLIANCE).includes(CARD.saboteurs), 'Saboteurs still in play')
      expectEqual(discardCount(state), 4, 'Discarded pile')
      return 'Boat Builders and Saboteurs discarded; Tunnels kept'
    },
  },
  {
    title: '4–5 · Swap Meet: random card taken first, then the card to give (C4)',
    play: async (ui) => {
      await ui.button('swap meet')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.button('marquise')
      // The give prompt opens by itself, with the taken Sword in hand.
      await ui.waitForText('Swap Meet — pick a card to give')
      const handDuringPrompt = handOf(await ui.fetchState(), ALLIANCE)
      await ui.pause(PROMPT_LOOK_MS)
      await ui.handCard(CARD.travelGearMouse)
      return { handDuringPrompt }
    },
    verify: (state, seen) => {
      expectThat(seen.handDuringPrompt.includes(CARD.sword), 'Sword not taken before the give prompt')
      expectEqual(seen.handDuringPrompt.length, 4, 'hand during the give prompt')
      expectEqual(handOf(state, MARQUISE), [CARD.travelGearMouse], 'Marquise hand')
      expectEqual(handOf(state, ALLIANCE).length, 3, 'Alliance hand')
      return 'Sword taken, then Travel Gear given: 4 cards to choose from'
    },
  },
  {
    title: '6–7 · False Orders: enemy, origin, destination (C7)',
    play: async (ui) => {
      await ui.button('false orders')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.button('marquise')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.clearing(FALSE_ORDERS_ORIGIN)
      await ui.pause(PROMPT_LOOK_MS)
      await ui.clearing(FALSE_ORDERS_DESTINATION)
      await ui.pause(MOVE_SLIDE_MS)
    },
    verify: (state) => {
      expectEqual(warriorsIn(state, FALSE_ORDERS_ORIGIN, MARQUISE), 1, 'Cat warriors on 1')
      expectEqual(warriorsIn(state, FALSE_ORDERS_DESTINATION, MARQUISE), 2, 'Cat warriors on 5')
      expectThat(!playAreaOf(state, ALLIANCE).includes(CARD.falseOrders), 'False Orders still in play')
      return '2 of 3 Cat warriors (half, rounded up) moved 1 → 5; card discarded'
    },
  },
  {
    title: '8–9 · Eyrie Émigré: forced move when Birdsong ends, then battle (C8)',
    play: async (ui) => {
      // Birdsong has only "end phase" left: the UI ends it, and the card holds it.
      await ui.waitForText('Eyrie Émigré — you must move: pick origin')
      const phaseDuringPrompt = (await ui.fetchState()).phase
      await ui.pause(PROMPT_LOOK_MS)
      await ui.clearing(ALLIANCE_CLEARING)
      await ui.pause(PROMPT_LOOK_MS)
      await ui.clearing(FALSE_ORDERS_ORIGIN)
      await ui.button('>')
      await ui.button('>')
      await ui.button('OK')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.button('marquise')
      await ui.pause(MOVE_SLIDE_MS)
      await ui.button('Skip ambush')
      await ui.pause(BATTLE_RESULT_LOOK_MS)
      await ui.buttonIfVisible('Dismiss battle result')
      await ui.button('Decline Field Hospitals')
      await ui.buttonIfVisible('Dismiss battle result')
      await ui.waitForButton('league: move')
      return { phaseDuringPrompt }
    },
    verify: (state, seen) => {
      expectEqual(seen.phaseDuringPrompt, 'birdsong', 'phase while the move is forced')
      expectEqual(state.phase, 'daylight', 'phase')
      expectEqual(warriorsIn(state, FALSE_ORDERS_ORIGIN, ALLIANCE), 3, 'Alliance warriors on 1')
      expectEqual(warriorsIn(state, FALSE_ORDERS_ORIGIN, MARQUISE), 0, 'Cat warriors on 1')
      expectThat(playAreaOf(state, ALLIANCE).includes(CARD.eyrieEmigre), 'Eyrie Émigré discarded')
      expectEqual(coffinMakersCount(state), 1, 'Coffin Makers')
      return '9 → 1 with 3 warriors, battle won; card kept; Coffin Makers holds 1'
    },
  },
  {
    title: '10–12 · League of Adventurous Mice: item, then a move (C3)',
    play: async (ui) => {
      const battleOffered = await ui.seesButton('league: battle')
      await ui.button('league: move')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.button('Boot')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.clearing(FALSE_ORDERS_ORIGIN)
      await ui.clearing(LEAGUE_DESTINATION)
      await ui.button('OK')
      await ui.pause(MOVE_SLIDE_MS)
      return { battleOffered, moveStillOffered: await ui.seesButton('league: move') }
    },
    verify: (state, seen) => {
      expectEqual(seen, { battleOffered: false, moveStillOffered: false }, 'league buttons')
      expectEqual(warriorsIn(state, LEAGUE_DESTINATION, ALLIANCE), 1, 'Alliance warriors on 4')
      expectEqual(
        state.players[ALLIANCE].craftedItems.map((item) => item.exhausted),
        [true, false],
        'crafted items exhausted',
      )
      return 'Boot exhausted, 1 warrior moved 1 → 4; once per Daylight'
    },
  },
  {
    title: '13–14 · Propaganda Bureau: clearing, enemy, card to spend (C1)',
    play: async (ui) => {
      await ui.button('propaganda bureau')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.clearing(PROPAGANDA_CLEARING)
      await ui.pause(PROMPT_LOOK_MS)
      await ui.button('marquise')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.handCard(CARD.mouseInASack)
      // Replace = remove then place: the Marquise may answer with Field Hospitals.
      const pendingAfterReplace = (await ui.fetchState()).pending[0]?.type
      await ui.button('Decline Field Hospitals')
      return { pendingAfterReplace }
    },
    verify: (state, seen) => {
      expectEqual(seen.pendingAfterReplace, 'fieldHospital', 'pending after the replace')
      expectEqual(warriorsIn(state, PROPAGANDA_CLEARING, MARQUISE), 1, 'Cat warriors on 6')
      expectEqual(warriorsIn(state, PROPAGANDA_CLEARING, ALLIANCE), 1, 'Alliance warriors on 6')
      expectEqual(coffinMakersCount(state), 1, 'Coffin Makers')
      expectEqual(discardCount(state), 6, 'Discarded pile')
      return 'Cat warrior replaced on 6; Field Hospitals offered; Coffin Makers still 1'
    },
  },
  {
    title: '15–16 · Charm Offensive at the start of Evening (C5)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.waitForButton('charm offensive')
      await ui.button('charm offensive')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.button('marquise')
    },
    verify: (state) => {
      expectEqual(state.phase, 'evening', 'phase')
      expectEqual(state.players[MARQUISE].vp, 1, 'Marquise VP')
      expectEqual(handOf(state, ALLIANCE).length, 3, 'Alliance hand')
      return 'Alliance drew 1 card; the Marquise scored 1 point'
    },
  },
  {
    title: '17–18 · Informants: an ambush card instead of the draw (C6)',
    play: async (ui) => {
      // Only "end phase" was left after Charm Offensive: the UI went on to the
      // draw step by itself, where Informants holds the draw back.
      await ui.waitForButton('informants')
      const drawOffered = await ui.seesButton('draw')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.button('informants')
      await ui.pause(PROMPT_LOOK_MS)
      await ui.galleryCard(CARD.ambushFox)
      return { drawOffered }
    },
    verify: (state, seen) => {
      expectThat(seen.drawOffered, 'the normal draw was not offered next to informants')
      expectThat(handOf(state, ALLIANCE).includes(CARD.ambushFox), 'Ambush not in hand')
      expectEqual(handOf(state, ALLIANCE).length, 4, 'Alliance hand')
      expectEqual(discardCount(state), 5, 'Discarded pile')
      return 'Draw waited; fox Ambush taken from the Discarded pile, no card drawn'
    },
  },
]
