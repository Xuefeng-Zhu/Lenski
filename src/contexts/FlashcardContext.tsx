import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Flashcard, Deck, Rating, ReviewLog } from '../types'
import { DEFAULT_EASE_FACTOR, MIN_EASE_FACTOR, DECK_COLORS } from '../types'

interface FlashcardContextValue {
  decks: Deck[]
  cards: Flashcard[]
  reviewLogs: ReviewLog[]
  addDeck: (name: string) => Deck
  deleteDeck: (id: string) => void
  renameDeck: (id: string, name: string) => void
  addCard: (deckId: string, front: string, back: string) => Flashcard
  updateCard: (id: string, front: string, back: string) => void
  deleteCard: (id: string) => void
  reviewCard: (id: string, rating: Rating) => void
  getDueCards: (deckId?: string) => Flashcard[]
  getDeckStats: (deckId: string) => { total: number; due: number; learned: number; new: number }
  getTotalDue: () => number
}

const FlashcardContext = createContext<FlashcardContextValue | null>(null)

const DECKS_KEY = 'lenski-decks'
const CARDS_KEY = 'lenski-cards'
const LOGS_KEY = 'lenski-review-logs'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** SM-2 algorithm — compute next interval and ease factor from a rating */
function sm2(card: Flashcard, rating: Rating): Pick<Flashcard, 'interval' | 'repetition' | 'easeFactor' | 'nextReview' | 'lastReview'> {
  const now = Date.now()
  let { interval, repetition, easeFactor } = card

  if (rating < 3) {
    // Failed — reset
    repetition = 0
    interval = 1
  } else {
    // Passed
    if (repetition === 0) {
      interval = 1
    } else if (repetition === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetition += 1
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  if (easeFactor < MIN_EASE_FACTOR) easeFactor = MIN_EASE_FACTOR

  const nextReview = now + interval * 24 * 60 * 60 * 1000

  return { interval, repetition, easeFactor, nextReview, lastReview: now }
}

function generateSampleData(): { decks: Deck[]; cards: Flashcard[] } {
  const now = Date.now()
  const DAY = 86400000

  const decks: Deck[] = [
    { id: 'deck-spanish', name: 'Spanish Basics', color: DECK_COLORS[0], createdAt: now - 7 * DAY },
    { id: 'deck-capitals', name: 'World Capitals', color: DECK_COLORS[4], createdAt: now - 3 * DAY },
  ]

  const spanishCards: [string, string][] = [
    ['Hola', 'Hello'],
    ['Gracias', 'Thank you'],
    ['Por favor', 'Please'],
    ['Buenos días', 'Good morning'],
    ['Adiós', 'Goodbye'],
    ['¿Cómo estás?', 'How are you?'],
    ['Lo siento', "I'm sorry"],
    ['De nada', "You're welcome"],
    ['Sí', 'Yes'],
    ['No', 'No'],
  ]

  const capitalCards: [string, string][] = [
    ['France', 'Paris'],
    ['Japan', 'Tokyo'],
    ['Brazil', 'Brasília'],
    ['Australia', 'Canberra'],
    ['Egypt', 'Cairo'],
    ['Canada', 'Ottawa'],
    ['Germany', 'Berlin'],
    ['India', 'New Delhi'],
  ]

  const cards: Flashcard[] = []

  for (let i = 0; i < spanishCards.length; i++) {
    const [front, back] = spanishCards[i]
    const reviewed = i < 5
    cards.push({
      id: `card-es-${i}`,
      front,
      back,
      deckId: 'deck-spanish',
      interval: reviewed ? (i < 3 ? 6 : 1) : 0,
      repetition: reviewed ? (i < 3 ? 2 : 1) : 0,
      easeFactor: DEFAULT_EASE_FACTOR,
      nextReview: reviewed ? now - (i < 3 ? 2 : 0) * DAY : 0,
      lastReview: reviewed ? now - (i < 3 ? 8 : 1) * DAY : 0,
    })
  }

  for (let i = 0; i < capitalCards.length; i++) {
    const [front, back] = capitalCards[i]
    const reviewed = i < 3
    cards.push({
      id: `card-cap-${i}`,
      front,
      back,
      deckId: 'deck-capitals',
      interval: reviewed ? 1 : 0,
      repetition: reviewed ? 1 : 0,
      easeFactor: DEFAULT_EASE_FACTOR,
      nextReview: reviewed ? now - DAY : 0,
      lastReview: reviewed ? now - DAY : 0,
    })
  }

  return { decks, cards }
}

function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(DECKS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return generateSampleData().decks
}

function loadCards(): Flashcard[] {
  try {
    const raw = localStorage.getItem(CARDS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return generateSampleData().cards
}

function loadLogs(): ReviewLog[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return []
}

export function FlashcardProvider({ children }: { children: ReactNode }) {
  const [decks, setDecks] = useState<Deck[]>(loadDecks)
  const [cards, setCards] = useState<Flashcard[]>(loadCards)
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>(loadLogs)

  useEffect(() => {
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks))
  }, [decks])

  useEffect(() => {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards))
  }, [cards])

  useEffect(() => {
    localStorage.setItem(LOGS_KEY, JSON.stringify(reviewLogs))
  }, [reviewLogs])

  const addDeck = useCallback((name: string): Deck => {
    const deck: Deck = {
      id: generateId(),
      name,
      color: DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)],
      createdAt: Date.now(),
    }
    setDecks((prev) => [deck, ...prev])
    return deck
  }, [])

  const deleteDeck = useCallback((id: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== id))
    setCards((prev) => prev.filter((c) => c.deckId !== id))
  }, [])

  const renameDeck = useCallback((id: string, name: string) => {
    setDecks((prev) => prev.map((d) => d.id === id ? { ...d, name } : d))
  }, [])

  const addCard = useCallback((deckId: string, front: string, back: string): Flashcard => {
    const card: Flashcard = {
      id: generateId(),
      front,
      back,
      deckId,
      interval: 0,
      repetition: 0,
      easeFactor: DEFAULT_EASE_FACTOR,
      nextReview: 0,
      lastReview: 0,
    }
    setCards((prev) => [card, ...prev])
    return card
  }, [])

  const updateCard = useCallback((id: string, front: string, back: string) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, front, back } : c))
  }, [])

  const deleteCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const reviewCard = useCallback((id: string, rating: Rating) => {
    setCards((prev) => prev.map((c) => {
      if (c.id !== id) return c
      return { ...c, ...sm2(c, rating) }
    }))
    // Log the review
    const card = cards.find((c) => c.id === id)
    if (card) {
      const log: ReviewLog = {
        id: generateId(),
        cardId: id,
        deckId: card.deckId,
        rating,
        timestamp: Date.now(),
      }
      setReviewLogs((prev) => [log, ...prev])
    }
  }, [cards])

  const getDueCards = useCallback((deckId?: string): Flashcard[] => {
    const now = Date.now()
    return cards
      .filter((c) => {
        if (deckId && c.deckId !== deckId) return false
        return c.nextReview <= now // includes never-reviewed (nextReview = 0)
      })
      .sort((a, b) => a.nextReview - b.nextReview)
  }, [cards])

  const getDeckStats = useCallback((deckId: string) => {
    const now = Date.now()
    const deckCards = cards.filter((c) => c.deckId === deckId)
    const due = deckCards.filter((c) => c.nextReview <= now).length
    const newCards = deckCards.filter((c) => c.lastReview === 0).length
    const learned = deckCards.filter((c) => c.lastReview > 0 && c.nextReview > now).length
    return { total: deckCards.length, due, learned, new: newCards }
  }, [cards])

  const getTotalDue = useCallback(() => {
    const now = Date.now()
    return cards.filter((c) => c.nextReview <= now).length
  }, [cards])

  return (
    <FlashcardContext.Provider
      value={{
        decks,
        cards,
        reviewLogs,
        addDeck,
        deleteDeck,
        renameDeck,
        addCard,
        updateCard,
        deleteCard,
        reviewCard,
        getDueCards,
        getDeckStats,
        getTotalDue,
      }}
    >
      {children}
    </FlashcardContext.Provider>
  )
}

export function useFlashcards() {
  const ctx = useContext(FlashcardContext)
  if (!ctx) throw new Error('useFlashcards must be used within FlashcardProvider')
  return ctx
}
