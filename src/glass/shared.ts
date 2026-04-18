import type { Rating } from '../types'

export type GlassMode = 'deckPicker' | 'study'

/** Card study phase: front → back → rating */
export type StudyPhase = 'front' | 'back' | 'rating'

export const GLASS_RATINGS: Rating[] = [2, 4, 5]  // Hard, Good, Easy
export const GLASS_RATING_LABELS: Record<number, string> = { 2: 'Hard', 4: 'Good', 5: 'Easy' }

export interface DeckOption {
  id: string
  name: string
  due: number
}

export interface SessionStats {
  total: number
  easy: number
  good: number
  hard: number
}

export interface AppSnapshot {
  /** Current glass mode */
  mode: GlassMode
  /** Available decks for the picker */
  deckOptions: DeckOption[]
  /** Currently selected deck ID (empty = all) */
  selectedDeckId: string
  /** Current card front text, or empty if no cards due */
  front: string
  /** Current card back text */
  back: string
  /** Current study phase */
  phase: StudyPhase
  /** Index into GLASS_RATINGS for the currently highlighted rating */
  ratingIndex: number
  /** Number of cards remaining in this session */
  remaining: number
  /** Total cards in this study session */
  totalCards: number
  /** Deck name for the current card */
  deckName: string
  /** Current card ID (for rating) */
  cardId: string
  /** Session stats for the completion screen */
  sessionStats: SessionStats
  /** Flash phase for splash screen */
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
  flipToBack: () => void
  flipToFront: () => void
  enterRating: () => void
  cycleRating: () => void
  confirmRating: (direction: 'next' | 'prev') => void
  prevCard: () => void
  nextCard: () => void
  selectDeck: (deckId: string) => void
  backToPicker: () => void
}
