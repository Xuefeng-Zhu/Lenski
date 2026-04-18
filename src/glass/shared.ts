import type { Rating } from '../types'

export type GlassMode = 'deckPicker' | 'study'

export interface DeckOption {
  id: string
  name: string
  due: number
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
  /** Whether the answer is currently revealed */
  revealed: boolean
  /** Number of cards remaining in this session */
  remaining: number
  /** Deck name for the current card */
  deckName: string
  /** Current card ID (for rating) */
  cardId: string
  /** Flash phase for splash screen */
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
  reveal: () => void
  rate: (rating: Rating) => void
  nextCard: () => void
  selectDeck: (deckId: string) => void
  backToPicker: () => void
}
