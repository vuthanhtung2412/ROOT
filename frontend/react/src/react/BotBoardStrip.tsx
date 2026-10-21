import type { JSX } from 'react'
import { imagePathForAssetKey, warriorTokenTextureKey } from '#assets/gameAssets.ts'
import { SuitIcon } from '#react/SuitIcon.tsx'
import type { BotBoardViewModel, BotCardView } from '#ui/botBoardViewModel.ts'
import type { BotCardText } from '@root/lib/bot-settings'

/**
 * One line under the bot board: order card, VP, warrior supply, difficulty
 * and traits. Hover or focus a chip for its card art or text.
 */

/** Dark card panel of the Vagabond quests and Cult revealed cards. */
const STRIP_CLASS_NAME =
  'pointer-events-auto flex flex-row flex-wrap items-center gap-x-4 gap-y-2 rounded border border-[rgb(230_220_190/0.35)] bg-[rgb(20_24_18/0.86)] px-2.5 py-2 font-body text-[13px] text-[#f3ecd8]'
const GROUP_CLASS_NAME = 'flex min-w-0 flex-row flex-wrap items-center gap-1.5'
const HEADING_CLASS_NAME = 'm-0 text-[11px] font-normal tracking-heading uppercase opacity-85'
const SEPARATOR_CLASS_NAME = 'w-px self-stretch bg-[rgb(230_220_190/0.25)]'
const CHIP_CLASS_NAME =
  'group relative inline-flex cursor-help items-center gap-1 rounded-xs border-0 bg-parchment px-2 py-0.5 font-body text-[13px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-gold-light'
const TIP_CLASS_NAME =
  'absolute bottom-[calc(100%+6px)] left-0 z-10 hidden w-60 rounded-sm border border-ink/50 bg-parchment px-2 py-1.5 text-left text-xs leading-snug text-ink shadow-card group-hover:block group-focus-visible:block'
const TIP_CARD_IMAGE_CLASS_NAME = 'block h-auto w-full rounded-sm'
const SUIT_ICON_CLASS_NAME = 'size-4'
const VICTORY_POINTS_CLASS_NAME = 'font-mono tabular-nums'
const SUPPLY_CLASS_NAME = 'relative inline-flex size-8'
const SUPPLY_IMAGE_CLASS_NAME = 'block size-full object-contain drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)] select-none'
/** Same badge as the warrior supply on the human boards. */
const SUPPLY_BADGE_CLASS_NAME =
  'absolute -top-1 -right-2 rounded-xs bg-parchment/93 px-1 font-mono text-xs font-bold text-ink-deep tabular-nums'
const EMPTY_TEXT = '—'

function StripChip(props: { label: string; suit: string | null; tip: JSX.Element }): JSX.Element {
  return (
    <button type="button" className={CHIP_CLASS_NAME}>
      {props.suit !== null ? <SuitIcon suit={props.suit} className={SUIT_ICON_CLASS_NAME} /> : null}
      {props.label}
      <span className={TIP_CLASS_NAME}>{props.tip}</span>
    </button>
  )
}

function OrderCardChip(props: { card: BotCardView }): JSX.Element {
  const tip: JSX.Element =
    props.card.imagePath !== null ? (
      <img className={TIP_CARD_IMAGE_CLASS_NAME} src={props.card.imagePath} alt="" draggable={false} />
    ) : (
      <>{props.card.name}</>
    )
  return <StripChip label={props.card.name} suit={props.card.suit} tip={tip} />
}

function SettingChip(props: { card: BotCardText }): JSX.Element {
  return <StripChip label={props.card.name} suit={null} tip={<>{props.card.text}</>} />
}

function WarriorSupply(props: { view: BotBoardViewModel }): JSX.Element {
  const textureKey: string | null = warriorTokenTextureKey(props.view.kind)
  const imagePath: string | null = textureKey !== null ? imagePathForAssetKey(textureKey) : null
  return (
    <span className={SUPPLY_CLASS_NAME} title={`${String(props.view.warriors)} warriors in supply`}>
      {imagePath !== null ? (
        <img className={SUPPLY_IMAGE_CLASS_NAME} src={imagePath} alt="Warriors supply" draggable={false} />
      ) : null}
      <span className={SUPPLY_BADGE_CLASS_NAME}>{props.view.warriors}</span>
    </span>
  )
}

/** Rootbotics 3.3 — the difficulty card and the face-up trait cards. */
function BotSettingsGroup(props: { view: BotBoardViewModel }): JSX.Element {
  const { settings } = props.view
  return (
    <div className={`bot-board-settings ${GROUP_CLASS_NAME}`} aria-label="Difficulty and traits">
      <h3 className={HEADING_CLASS_NAME}>Difficulty</h3>
      <SettingChip card={settings.difficulty} />
      <h3 className={HEADING_CLASS_NAME}>Traits</h3>
      {settings.traits.length === 0 ? <span>{EMPTY_TEXT}</span> : null}
      {settings.traits.map((trait: BotCardText) => (
        <SettingChip key={trait.name} card={trait} />
      ))}
    </div>
  )
}

export function BotBoardStrip(props: { view: BotBoardViewModel }): JSX.Element {
  const { view } = props
  return (
    <div className={STRIP_CLASS_NAME}>
      <div className={GROUP_CLASS_NAME} aria-label="Order card">
        <h3 className={HEADING_CLASS_NAME}>Order</h3>
        {view.orderCard === null ? <span>{EMPTY_TEXT}</span> : <OrderCardChip card={view.orderCard} />}
      </div>
      <span className={SEPARATOR_CLASS_NAME} />
      <span className={VICTORY_POINTS_CLASS_NAME}>
        <b>{view.victoryPoints}</b> VP
      </span>
      <span className={SEPARATOR_CLASS_NAME} />
      <div className={GROUP_CLASS_NAME}>
        <h3 className={HEADING_CLASS_NAME}>Supply</h3>
        <WarriorSupply view={view} />
      </div>
      <span className={SEPARATOR_CLASS_NAME} />
      <BotSettingsGroup view={view} />
    </div>
  )
}
