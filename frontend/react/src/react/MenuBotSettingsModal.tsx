import { useEffect, type JSX } from 'react'
import { LuCheck, LuX } from 'react-icons/lu'
import type { BotFactionId } from '@root/lib/bot-factions'
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_CARDS,
  BOT_TRAIT_CARDS,
  BOT_TRAITS,
  DEFAULT_VAGABOT_CHARACTER,
  VAGABOT_CHARACTER_CARDS,
  VAGABOT_CHARACTERS,
  type BotDifficulty,
  type BotSettings,
  type BotTrait,
  type VagabotCharacter,
} from '@root/lib/bot-settings'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import { factionDisplayName } from '#game/menuPartySetup.ts'
import { factionTintCss } from '#react/MenuLobbySeats.tsx'
import { PRIMARY_BUTTON_CLASS_NAME, SECTION_TITLE_CLASS_NAME } from '#react/MenuParts.tsx'

const CLOSE_KEY = 'Escape'

/** Over the whole menu screen, outside the solo run zoom. */
const MODAL_CLASS_NAME =
  'menu-bot-settings-modal fixed inset-0 z-10 box-border flex items-center justify-center p-4'
const BACKDROP_CLASS_NAME =
  'absolute inset-0 m-0 cursor-root-pointer border-0 bg-forest-deep/72 p-0'
/** The paper stays put; only the body scrolls (a scrolled sheet slides its `::before` paper away). */
const SHEET_CLASS_NAME =
  'menu-bot-settings root-paper relative z-1 box-border flex max-h-full w-full max-w-5xl flex-col overflow-hidden'
const SHEET_BODY_CLASS_NAME =
  'flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-5 md:px-8 md:py-6'
const HEADER_CLASS_NAME = 'flex flex-row items-center gap-4 pr-10'
const PORTRAIT_FRAME_CLASS_NAME =
  'root-paper box-border size-16 flex-none -rotate-2 p-1 [--root-paper-color:currentColor] md:size-20'
const PORTRAIT_CLASS_NAME = 'block size-full object-cover select-none'
const TITLE_CLASS_NAME =
  'm-0 font-display text-2xl leading-tight tracking-display text-ink md:text-3xl'
const SUBTITLE_CLASS_NAME = 'm-0 font-body text-sm text-ink-soft italic md:text-base'
const CLOSE_CLASS_NAME =
  'menu-bot-settings-close root-paper root-medallion root-paper-press absolute top-3 right-3 z-1 m-0 flex size-11 items-center justify-center p-0 text-xl text-paper-bright [--root-paper-color:var(--color-rust)]'
const SECTION_CLASS_NAME = 'flex flex-col gap-2'
const DIFFICULTY_GRID_CLASS_NAME = 'grid grid-cols-2 gap-3 md:grid-cols-4'
const TRAIT_GRID_CLASS_NAME = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5'
const CHARACTER_GRID_CLASS_NAME = 'grid grid-cols-1 gap-3 sm:grid-cols-3'
const VAGABOT_FACTION_ID: BotFactionId = 'vagabot'
/** A card from the Rootbotics deck: name on top, its text under it. */
const CARD_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press relative m-0 box-border flex h-full flex-col items-start gap-1 px-3.5 py-2.5 text-left text-ink'
const CARD_PICKED_CLASS_NAME = 'shadow-gold-ring-wide [--root-paper-color:var(--color-gold-light)]'
const CARD_UNPICKED_CLASS_NAME = 'opacity-80 [--root-paper-color:var(--color-parchment)]'
const CARD_NAME_CLASS_NAME = 'font-display text-lg leading-tight md:text-xl'
const CARD_TEXT_CLASS_NAME = 'font-body text-[13px] leading-snug text-ink-soft md:text-sm'
const CARD_CHECK_CLASS_NAME =
  'root-paper root-medallion absolute -top-3 -right-3 flex size-8 items-center justify-center text-base text-ink-deep [--root-paper-color:var(--color-confirm)]'
const FOOTER_CLASS_NAME = 'flex flex-row justify-center pt-1'
/** Groups the cards so a guest's view disables them all; no box of its own. */
const CARDS_FIELDSET_CLASS_NAME = 'contents'

function cardClassName(isPicked: boolean): string {
  return `${CARD_CLASS_NAME} ${isPicked ? CARD_PICKED_CLASS_NAME : CARD_UNPICKED_CLASS_NAME}`
}

function traitCountLabel(traitCount: number): string {
  if (traitCount === 0) return 'none picked'
  return `${String(traitCount)} picked`
}

function BotCard(props: {
  hookClassName: string
  name: string
  text: string
  isPicked: boolean
  onPick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      className={`${props.hookClassName} ${cardClassName(props.isPicked)}`}
      aria-pressed={props.isPicked}
      onClick={props.onPick}
    >
      <span className={CARD_NAME_CLASS_NAME}>{props.name}</span>
      <span className={CARD_TEXT_CLASS_NAME}>{props.text}</span>
      {props.isPicked ? (
        <span className={CARD_CHECK_CLASS_NAME} aria-hidden="true">
          <LuCheck />
        </span>
      ) : null}
    </button>
  )
}

export type MenuBotSettingsModalProps = {
  faction: BotFactionId
  settings: BotSettings
  onDifficultyChange: (difficulty: BotDifficulty) => void
  onTraitToggle: (trait: BotTrait) => void
  /** Vagabot only — its character card (Rootbotics 7.3.1). */
  onCharacterChange?: (character: VagabotCharacter) => void
  onClose: () => void
  /** Online guests: the host's choice, shown but not changed. */
  isReadOnly?: boolean
}

/** Rootbotics 3.3 — one bot's difficulty card and trait cards, every card text shown. */
export function MenuBotSettingsModal(props: MenuBotSettingsModalProps): JSX.Element {
  const { faction, settings, onClose } = props
  const name: string = factionDisplayName(faction)
  const portraitPath: string | null = factionPortraitPath(faction)

  useEffect((): (() => void) => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === CLOSE_KEY) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return (): void => {
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  return (
    <div
      className={MODAL_CLASS_NAME}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} difficulty and traits`}
    >
      <button
        type="button"
        className={BACKDROP_CLASS_NAME}
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className={SHEET_CLASS_NAME}>
        <button type="button" className={CLOSE_CLASS_NAME} aria-label="Close" onClick={onClose}>
          <LuX aria-hidden="true" />
        </button>
        <div className={SHEET_BODY_CLASS_NAME}>
        <header className={HEADER_CLASS_NAME}>
          {portraitPath !== null ? (
            <div className={PORTRAIT_FRAME_CLASS_NAME} style={{ color: factionTintCss(faction) }}>
              <img className={PORTRAIT_CLASS_NAME} src={portraitPath} alt="" draggable={false} />
            </div>
          ) : null}
          <div>
            <h3 className={TITLE_CLASS_NAME}>{name}</h3>
            <p className={SUBTITLE_CLASS_NAME}>
              {props.isReadOnly === true
                ? 'Set by the host'
                : 'Pick a difficulty and any trait cards'}
            </p>
          </div>
        </header>
        <fieldset className={CARDS_FIELDSET_CLASS_NAME} disabled={props.isReadOnly === true}>
        <section className={SECTION_CLASS_NAME} aria-label="Difficulty">
          <h4 className={SECTION_TITLE_CLASS_NAME}>Difficulty</h4>
          <div className={DIFFICULTY_GRID_CLASS_NAME}>
            {BOT_DIFFICULTIES.map((difficulty: BotDifficulty): JSX.Element => (
              <BotCard
                key={difficulty}
                hookClassName={`menu-bot-difficulty menu-bot-difficulty-${difficulty}`}
                name={BOT_DIFFICULTY_CARDS[faction][difficulty].name}
                text={BOT_DIFFICULTY_CARDS[faction][difficulty].text}
                isPicked={settings.difficulty === difficulty}
                onPick={(): void => {
                  props.onDifficultyChange(difficulty)
                }}
              />
            ))}
          </div>
        </section>
        <section className={SECTION_CLASS_NAME} aria-label="Traits">
          <h4 className={SECTION_TITLE_CLASS_NAME}>
            Traits · {traitCountLabel(settings.traits.length)}
          </h4>
          <div className={TRAIT_GRID_CLASS_NAME}>
            {BOT_TRAITS[faction].map((trait: BotTrait): JSX.Element => (
              <BotCard
                key={trait}
                hookClassName="menu-bot-trait"
                name={BOT_TRAIT_CARDS[trait].name}
                text={BOT_TRAIT_CARDS[trait].text}
                isPicked={settings.traits.includes(trait)}
                onPick={(): void => {
                  props.onTraitToggle(trait)
                }}
              />
            ))}
          </div>
        </section>
        {faction === VAGABOT_FACTION_ID && props.onCharacterChange !== undefined ? (
          <section className={SECTION_CLASS_NAME} aria-label="Character">
            <h4 className={SECTION_TITLE_CLASS_NAME}>Character</h4>
            <div className={CHARACTER_GRID_CLASS_NAME}>
              {VAGABOT_CHARACTERS.map((character: VagabotCharacter): JSX.Element => (
                <BotCard
                  key={character}
                  hookClassName={`menu-bot-character menu-bot-character-${character}`}
                  name={VAGABOT_CHARACTER_CARDS[character].name}
                  text={VAGABOT_CHARACTER_CARDS[character].text}
                  isPicked={(settings.character ?? DEFAULT_VAGABOT_CHARACTER) === character}
                  onPick={(): void => {
                    props.onCharacterChange?.(character)
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}
        </fieldset>
        <div className={FOOTER_CLASS_NAME}>
          <button
            type="button"
            className={`menu-bot-settings-done ${PRIMARY_BUTTON_CLASS_NAME}`}
            onClick={onClose}
          >
            Done
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
