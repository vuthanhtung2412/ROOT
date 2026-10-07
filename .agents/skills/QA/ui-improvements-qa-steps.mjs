/**
 * Steps of the UI improvements demo (replay-ui-improvements-qa.mjs).
 * Plan: resources/notes/QA-plan-ui-improvements.md — titles carry the plan step
 * numbers and the feature ids (U1…U12) each step shows.
 *
 * One step: `play` clicks through the UI and returns what it saw on the page,
 * `verify` checks the server state and the page evidence, and returns the
 * caption detail.
 */
const VAGABOND = 0
const MARQUISE = 1
const LIZARD = 2
const RIVERFOLK = 3

const KEEP_CLEARING = 2
const SLIP_CLEARING = 1
const BATTLE_CLEARING = 9
const RECRUIT_CLEARING = 8
const SAWMILL_CLEARINGS = [2, 6, 10]
const RIVERFOLK_START_CLEARINGS = [3, 3, 4, 4]
const VAGABOND_START_FOREST = 4

const CARD = {
  anvil: 'ROOT-204',
  birdyBindle: 'ROOT-208',
  foxfolkSteel: 'ROOT-215',
  mouseInASack: 'ROOT-218',
  protectionRacket: 'ROOT-219',
  travelGearFox: 'ROOT-225',
  bakeSale: 'ROOT-207',
}
const MARQUISE_DISCARDS = [CARD.travelGearFox, CARD.protectionRacket, CARD.foxfolkSteel]

/** How long each animation needs on screen before the next click. */
const SUIT_ICONS_LOOK_MS = 1500
const SERVICE_ICONS_LOOK_MS = 1800
const SLIP_SLIDE_MS = 1800
const BOUGHT_CARD_AND_WOOD_MS = 4200
const CRAFT_ANVIL_MS = 4000
const BATTLE_BADGE_LOOK_MS = 1600
const BATTLE_RESULT_LOOK_MS = 2600
const DIMMED_HAND_LOOK_MS = 1800
const REVEAL_FLIP_MS = 3600
const ANIMATION_START_WAIT_MS = 2500

const SELECTOR = {
  suitIcon: (suit) => `button[aria-label="${suit}"] img`,
  serviceIcon: (label) => `button:has-text("${label}") svg`,
  cardFlight: '.card-flight',
  craftAnvil: '.card-flight__anvil',
  moveTrail: '.board-effects svg line',
  battleBadge: '.battle-clearing-badge',
  battlePortrait: '.battle-overlay__side img[src*="/assets/portraits/"]',
  dimmedHandCard: 'button.opacity-45:has(> img[alt^="ROOT-"])',
  railPortrait: '[data-rail-seat] img[src*="/assets/portraits/"]',
}

function expectThat(condition, message) {
  if (!condition) throw new Error(message)
}

function expectEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  expectThat(actualText === expectedText, `${label} = ${actualText}, expected ${expectedText}`)
}

const board = (state, seat) => state.players[seat].board
const handOf = (state, seat) => state.players[seat].hand.map((card) => card.defId)

function warriorsIn(state, clearingId, owner) {
  return state.clearings[clearingId].pieces.filter(
    (piece) => piece.kind === 'warrior' && piece.owner === owner,
  ).length
}

function clearingsHolding(state, pieceType) {
  return state.clearings
    .map((clearing, clearingId) =>
      clearing.pieces.some((piece) => piece.type === pieceType) ? clearingId : null,
    )
    .filter((clearingId) => clearingId !== null)
}

function pawnClearing(state, seat) {
  return state.clearings.findIndex((clearing) =>
    clearing.pieces.some((piece) => piece.kind === 'pawn' && piece.owner === seat),
  )
}

/** One battle of the Marquise on the battle clearing, up to the dice. */
async function startBattle(ui) {
  await ui.button('battle')
  await ui.clearing(BATTLE_CLEARING)
  // Ambush step: no battle panel yet, the clearing wears the two sides already.
  const badgeDuringAmbush = await ui.sees(SELECTOR.battleBadge)
  await ui.pause(BATTLE_BADGE_LOOK_MS)
  await ui.button('Skip ambush')
  return badgeDuringAmbush
}

export const UI_IMPROVEMENTS_STEPS = [
  {
    title: '1 · Cult setup: the Outcast suit is picked from suit icons (U1)',
    play: async (ui) => {
      const suitIcons = await Promise.all(
        ['fox', 'rabbit', 'mouse'].map((suit) => ui.sees(SELECTOR.suitIcon(suit))),
      )
      await ui.pause(SUIT_ICONS_LOOK_MS)
      await ui.button('fox')
      return { suitIcons }
    },
    verify: (state, seen) => {
      expectEqual(seen.suitIcons, [true, true, true], 'suit icon buttons')
      expectEqual(board(state, LIZARD).outcast, 'fox', 'outcast')
      return 'Three suit icon tiles, no text; fox picked → Outcast fox'
    },
  },
  {
    title: '2 · Riverfolk setup: 4 warriors, starting costs 1 / 1 / 1',
    play: async (ui) => {
      for (const clearingId of RIVERFOLK_START_CLEARINGS) {
        await ui.clearing(clearingId)
      }
      await ui.button('OK')
      await ui.waitForButton('skip service')
    },
    verify: (state) => {
      expectEqual(warriorsIn(state, 3, RIVERFOLK) + warriorsIn(state, 4, RIVERFOLK), 4, 'Riverfolk warriors')
      expectEqual(state.pending[0], { type: 'buyServices', buyer: VAGABOND, bought: 0 }, 'pending')
      expectEqual(board(state, VAGABOND).forest, VAGABOND_START_FOREST, 'Vagabond forest')
      return 'Setup done: the Vagabond turn opens with the Riverfolk service prompt'
    },
  },
  {
    title: '3 · Service prompt: icons on the services, "Skip Service" in the tray (U2 U3)',
    play: async (ui) => {
      await ui.button('buy service')
      const serviceIcons = await Promise.all(
        ['Hand Card', 'Riverboats'].map((label) => ui.sees(SELECTOR.serviceIcon(label))),
      )
      await ui.pause(SERVICE_ICONS_LOOK_MS)
      await ui.button('X')
      const skipLabel = await ui.textOf('skip service')
      await ui.button('skip service')
      return { serviceIcons, skipLabel }
    },
    verify: (state, seen) => {
      expectEqual(seen.serviceIcons, [true, true], 'service icons')
      expectThat(/skip service/i.test(seen.skipLabel ?? ''), `tray label = ${seen.skipLabel}`)
      expectEqual(state.pending.length, 0, 'pending')
      expectEqual(handOf(state, VAGABOND).length, 2, 'Vagabond hand')
      return 'Icon before each service; the decline action reads "Skip Service"; nothing bought'
    },
  },
  {
    title: '4 · Vagabond slips out of the forest: the pawn slides, no "+" pop (U4)',
    play: async (ui) => {
      await ui.button('slip')
      await ui.clearing(SLIP_CLEARING)
      const moveTrail = await ui.sees(SELECTOR.moveTrail)
      const effectsText = await ui.textOfSelector('.board-effects')
      await ui.pause(SLIP_SLIDE_MS)
      return { moveTrail, effectsText }
    },
    verify: (state, seen) => {
      expectEqual(pawnClearing(state, VAGABOND), SLIP_CLEARING, 'pawn clearing')
      expectEqual(board(state, VAGABOND).forest, null, 'Vagabond forest')
      expectThat(seen.moveTrail, 'no move trail drawn for the slip')
      expectThat(!seen.effectsText.includes('+'), `"+" badge shown: ${seen.effectsText}`)
      return `Pawn on ${String(SLIP_CLEARING)}; drawn as a move with its trail, no placement badge`
    },
  },
  {
    title: '5 · Marquise buys Birdy Bindle: card flies to her; wood sawmill by sawmill (U5 U6)',
    play: async (ui) => {
      // The rest of the Vagabond turn: the UI ends it when nothing is left to do.
      await ui.buttonIfVisible('end phase')
      await ui.waitForButton('buy service')
      await ui.button('buy service')
      const serviceIcons = await ui.sees(SELECTOR.serviceIcon('Mercenaries'))
      await ui.button('Hand Card')
      await ui.galleryCard(CARD.birdyBindle)
      const cardFlight = await ui.sees(SELECTOR.cardFlight)
      const woodWhileFlying = await ui.woodClearingsOnBoard()
      await ui.pause(BOUGHT_CARD_AND_WOOD_MS)
      const woodAfter = await ui.woodClearingsOnBoard()
      return { serviceIcons, cardFlight, woodWhileFlying, woodAfter }
    },
    verify: (state, seen) => {
      expectEqual(state.currentSeat, MARQUISE, 'seat')
      expectThat(handOf(state, MARQUISE).includes(CARD.birdyBindle), 'card not in the Marquise hand')
      expectThat(!handOf(state, RIVERFOLK).includes(CARD.birdyBindle), 'card still in the Riverfolk hand')
      expectEqual(clearingsHolding(state, 'wood'), SAWMILL_CLEARINGS, 'wood clearings')
      expectThat(seen.cardFlight, 'no card flew out of the Riverfolk rail tile')
      expectThat(
        seen.woodWhileFlying.length < SAWMILL_CLEARINGS.length,
        `wood appeared all at once: ${JSON.stringify(seen.woodWhileFlying)}`,
      )
      expectEqual(seen.woodAfter, SAWMILL_CLEARINGS, 'wood drawn at the end')
      return `Card flew Riverfolk → Marquise; wood drawn on ${seen.woodWhileFlying.join(',') || 'none'} first, then on all of ${SAWMILL_CLEARINGS.join(', ')}`
    },
  },
  {
    title: '6 · Marquise crafts Anvil: anvil, hammer strikes, the card pops out (U7)',
    play: async (ui) => {
      await ui.waitForButton('craft')
      await ui.button('craft')
      await ui.handCard(CARD.anvil)
      const anvil = await ui.sees(SELECTOR.craftAnvil)
      await ui.pause(CRAFT_ANVIL_MS)
      return { anvil }
    },
    verify: (state, seen) => {
      expectThat(!handOf(state, MARQUISE).includes(CARD.anvil), 'Anvil still in hand')
      expectEqual(state.players[MARQUISE].craftedItems.length, 1, 'crafted items')
      expectThat(seen.anvil, 'no anvil animation')
      return 'Anvil crafted at the fox workshop; the anvil and hammer played before the card'
    },
  },
  {
    title: '7 · Battle on 9 rolls 0 – 0: the result still shows; portraits, clearing badge (U8 U9 U10)',
    play: async (ui) => {
      await ui.waitForButton('battle')
      const badgeDuringAmbush = await startBattle(ui)
      const resultShown = await ui.seesButton('Dismiss battle result')
      const portraits = await ui.count(SELECTOR.battlePortrait)
      const badgeDuringResult = await ui.sees(SELECTOR.battleBadge)
      const strap = await ui.textOfSelector('.battle-overlay__headline')
      await ui.pause(BATTLE_RESULT_LOOK_MS)
      await ui.button('Dismiss battle result')
      const badgeAfter = await ui.count(SELECTOR.battleBadge)
      return { badgeDuringAmbush, resultShown, portraits, badgeDuringResult, strap, badgeAfter }
    },
    verify: (state, seen) => {
      expectEqual(warriorsIn(state, BATTLE_CLEARING, MARQUISE), 3, 'Cat on 9')
      expectEqual(warriorsIn(state, BATTLE_CLEARING, LIZARD), 2, 'Cult on 9')
      expectThat(seen.resultShown, 'the 0–0 result never showed')
      expectEqual(seen.portraits, 2, 'head portraits on the battle tiles')
      expectThat(seen.badgeDuringAmbush, 'no badge on the clearing during the ambush step')
      expectThat(seen.badgeDuringResult, 'no badge on the clearing during the result')
      expectEqual(seen.badgeAfter, 0, 'badge left after the result')
      return `Nobody hit, result held on screen ("${seen.strap}"); badge from ambush to result, then gone`
    },
  },
  {
    title: '8 · Second battle rolls 2 – 1: both Cult warriors fall, one Cat warrior',
    play: async (ui) => {
      await startBattle(ui)
      await ui.buttonIfVisible('remove')
      await ui.buttonIfVisible('OK')
      await ui.buttonIfVisible('Dismiss battle result')
      await ui.buttonIfVisible('Decline Field Hospitals')
      await ui.buttonIfVisible('Dismiss battle result')
    },
    verify: (state) => {
      expectEqual(warriorsIn(state, BATTLE_CLEARING, LIZARD), 0, 'Cult on 9')
      expectEqual(warriorsIn(state, BATTLE_CLEARING, MARQUISE), 2, 'Cat on 9')
      expectEqual(board(state, LIZARD).acolytes, 2, 'acolytes (Revenge)')
      expectEqual(state.pending.length, 0, 'pending')
      return 'Dice 2 / 1: Cult warriors → acolytes (Revenge), one Cat warrior removed'
    },
  },
  {
    title: '9 · Evening discard: with 3 picked the other cards dim and cannot be added (U11)',
    play: async (ui) => {
      await ui.button('end phase')
      await ui.waitForButton('discard')
      await ui.button('discard')
      for (const cardDefinitionId of MARQUISE_DISCARDS) {
        await ui.handCard(cardDefinitionId)
      }
      const dimmed = await ui.count(SELECTOR.dimmedHandCard)
      await ui.pause(DIMMED_HAND_LOOK_MS)
      // A fourth pick is refused: the hand stays at three picked.
      await ui.handCard(CARD.bakeSale)
      const dimmedAfterExtraPick = await ui.count(SELECTOR.dimmedHandCard)
      await ui.button('OK')
      return { dimmed, dimmedAfterExtraPick }
    },
    verify: (state, seen) => {
      expectEqual(seen.dimmed, 5, 'dimmed cards with 3 picked')
      expectEqual(seen.dimmedAfterExtraPick, 5, 'dimmed cards after a fourth click')
      expectEqual(handOf(state, MARQUISE).length, 5, 'Marquise hand')
      expectThat(handOf(state, MARQUISE).includes(CARD.bakeSale), 'the fourth card was discarded')
      return '8 in hand → 3 picked, the 5 others dim; fourth click ignored; hand back to 5'
    },
  },
  {
    title: '10 · Cult reveals Mouse-in-a-sack: the card flies in face down, then flips (U12)',
    play: async (ui) => {
      await ui.waitForButton('skip service')
      await ui.button('skip service')
      await ui.button('end phase')
      await ui.waitForButton('recruit')
      await ui.button('recruit')
      await ui.handCard(CARD.mouseInASack)
      await ui.clearing(RECRUIT_CLEARING)
      const cardFlight = await ui.sees(SELECTOR.cardFlight)
      const cardBack = await ui.sees('.card-flight img[src*="card-back"]')
      await ui.pause(REVEAL_FLIP_MS)
      const railPortraits = await ui.count(SELECTOR.railPortrait)
      return { cardFlight, cardBack, railPortraits }
    },
    verify: (state, seen) => {
      expectEqual(state.currentSeat, LIZARD, 'seat')
      expectEqual(warriorsIn(state, RECRUIT_CLEARING, LIZARD), 2, 'Cult on 8')
      expectEqual(
        board(state, LIZARD).revealed.map((card) => card.defId),
        [CARD.mouseInASack],
        'revealed',
      )
      expectThat(seen.cardFlight, 'no card flew out of the Cult rail tile')
      expectThat(seen.cardBack, 'the flying card has no back face')
      expectEqual(seen.railPortraits, 4, 'head portraits on the rail')
      return `+1 Cult warrior on ${String(RECRUIT_CLEARING)}; the revealed card flew face down and flipped`
    },
  },
]

export { ANIMATION_START_WAIT_MS, KEEP_CLEARING }
