import { readFileSync } from 'node:fs'
import path from 'node:path'

/** One heading of the Law of Root with the text under it. */
export type RuleSection = {
  /** `7.2.3` for numbered rules, null for appendices and front matter. */
  sectionNumber: string | null
  title: string
  text: string
}

const RULEBOOK_FILE_PATH = path.resolve(
  import.meta.dirname,
  '../../../../resources/rules/Law_of_Root.md',
)

const HEADING_PATTERN = /^#{1,6}\s+(.*)$/
const NUMBERED_TITLE_PATTERN = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/
const SECTION_NUMBER_QUERY_PATTERN = /^\d+(?:\.\d+)*$/
const SECTION_NUMBER_SEPARATOR = '.'
const QUERY_WORD_SEPARATOR = /[^a-z0-9]+/
const MINIMUM_QUERY_WORD_LENGTH = 3
/** A word in the heading says more than the same word in the body. */
const TITLE_MATCH_WEIGHT = 5

/** A whole faction chapter fits; keeps one lookup readable for the model. */
export const SECTION_NUMBER_RESULT_LIMIT = 60
export const KEYWORD_RESULT_LIMIT = 8

export function parseRulebook(markdown: string): RuleSection[] {
  const sections: RuleSection[] = []
  let current: RuleSection | null = null
  let bodyLines: string[] = []
  const closeCurrent = (): void => {
    if (current !== null) {
      sections.push({ ...current, text: bodyLines.join('\n').trim() })
    }
  }
  for (const line of markdown.split('\n')) {
    const heading = HEADING_PATTERN.exec(line)
    if (heading === null) {
      bodyLines.push(line)
      continue
    }
    closeCurrent()
    const headingText = heading[1] ?? ''
    const numbered = NUMBERED_TITLE_PATTERN.exec(headingText)
    current =
      numbered === null
        ? { sectionNumber: null, title: headingText.trim(), text: '' }
        : {
            sectionNumber: numbered[1] ?? null,
            title: (numbered[2] ?? '').trim(),
            text: '',
          }
    bodyLines = []
  }
  closeCurrent()
  return sections
}

function isSectionOrDescendant(
  section: RuleSection,
  sectionNumber: string,
): boolean {
  return (
    section.sectionNumber === sectionNumber ||
    (section.sectionNumber?.startsWith(
      `${sectionNumber}${SECTION_NUMBER_SEPARATOR}`,
    ) ??
      false)
  )
}

function countOccurrences(text: string, word: string): number {
  return text.split(word).length - 1
}

function keywordScore(section: RuleSection, words: readonly string[]): number {
  const title = section.title.toLowerCase()
  const text = section.text.toLowerCase()
  let score = 0
  for (const word of words) {
    const wordScore =
      countOccurrences(title, word) * TITLE_MATCH_WEIGHT +
      countOccurrences(text, word)
    // Every word must appear: "ambush defender" is not any text about defenders.
    if (wordScore === 0) {
      return 0
    }
    score += wordScore
  }
  return score
}

/**
 * `7.2` returns that rule and its sub-rules. Anything else is a keyword
 * search: sections holding every word, best match first.
 */
export function lookupRules(
  sections: readonly RuleSection[],
  query: string,
): RuleSection[] {
  const trimmedQuery = query.trim()
  if (SECTION_NUMBER_QUERY_PATTERN.test(trimmedQuery)) {
    return sections
      .filter((section: RuleSection): boolean =>
        isSectionOrDescendant(section, trimmedQuery),
      )
      .slice(0, SECTION_NUMBER_RESULT_LIMIT)
  }
  const words = trimmedQuery
    .toLowerCase()
    .split(QUERY_WORD_SEPARATOR)
    .filter((word: string): boolean => word.length >= MINIMUM_QUERY_WORD_LENGTH)
  if (words.length === 0) {
    return []
  }
  return sections
    .map((section: RuleSection) => ({
      section,
      score: keywordScore(section, words),
    }))
    .filter((scored): boolean => scored.score > 0)
    .sort((left, right): number => right.score - left.score)
    .slice(0, KEYWORD_RESULT_LIMIT)
    .map((scored): RuleSection => scored.section)
}

const NO_RULE_MATCH_MESSAGE =
  'No rule matches. Try a rule number or other keywords.'
const SECTION_SEPARATOR = '\n\n'

function formatRuleSection(section: RuleSection): string {
  const heading =
    section.sectionNumber === null
      ? section.title
      : `${section.sectionNumber} ${section.title}`
  return section.text === '' ? heading : `${heading}\n${section.text}`
}

/** `lookupRules` as readable text, for the `rules` tool and `root-cli rules`. */
export function formatRuleLookup(
  sections: readonly RuleSection[],
  query: string,
): string {
  const found = lookupRules(sections, query)
  return found.length === 0
    ? NO_RULE_MATCH_MESSAGE
    : found.map(formatRuleSection).join(SECTION_SEPARATOR)
}

let loadedRulebook: RuleSection[] | null = null

/** The Law of Root (rules source of truth), parsed once per process. */
export function loadRulebook(): RuleSection[] {
  loadedRulebook ??= parseRulebook(readFileSync(RULEBOOK_FILE_PATH, 'utf8'))
  return loadedRulebook
}
