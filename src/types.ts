export interface Flashcard {
  id: string
  front: string
  back: string
  deckId: string
  /** SM-2 fields */
  interval: number      // days until next review
  repetition: number    // successful reviews in a row
  easeFactor: number    // ease factor (≥1.3)
  nextReview: number    // timestamp of next review
  lastReview: number    // timestamp of last review (0 = never)
}

export interface Deck {
  id: string
  name: string
  color: string
  createdAt: number
}

export type Rating = 0 | 1 | 2 | 3 | 4 | 5
// 0 = total blackout, 1 = wrong but remembered on reveal
// 2 = wrong but easy to recall, 3 = correct with difficulty
// 4 = correct, 5 = perfect

export const RATING_LABELS: Record<Rating, string> = {
  0: 'Blackout',
  1: 'Wrong',
  2: 'Hard',
  3: 'OK',
  4: 'Good',
  5: 'Easy',
}

export const DECK_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
]

export const DEFAULT_EASE_FACTOR = 2.5
export const MIN_EASE_FACTOR = 1.3
